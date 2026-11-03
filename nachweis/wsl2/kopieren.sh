#!/usr/bin/env bash
# ── nachweis/wsl2/kopieren.sh ────────────────────────────────────────────
# Läuft unter Windows in Git Bash. as-nachweis hat weder Interop noch
# eingehängte Laufwerke; hinein und heraus geht es nur über eine Pipe in
# wsl.exe (docs/kern-integration.md §2.4, Vorbedingung 3).
#
#   kopieren.sh hin       Quelle des Commits HEAD samt Submodul → /root/quelle
#   kopieren.sh zurueck   /root/nachweis der Distribution → nachweis/ im Repo
#
# Kopiert wird, was committet ist (git archive), nicht der Arbeitsbaum: so
# hängt der Nachweis an einem Commit, und eine .env kann nicht mitwandern.

set -euo pipefail
export MSYS_NO_PATHCONV=1

DISTRO=as-nachweis
# Aus `docker image inspect node:24-bookworm-slim`, 2026-11-03 (D2).
IMAGE_DIGEST="node@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c"
ROOTFS_TAR=${AS_NACHWEIS_TAR:-/c/wsl/as-nachweis.tar}

die() {
  printf 'kopieren: %s\n' "$*" >&2
  exit 1
}

in_distro() { wsl.exe -d "$DISTRO" -u root --exec "$@"; }

cd "$(git rev-parse --show-toplevel)"

case "${1:-}" in
  hin)
    [ -z "$(git status --porcelain -- src vendor package.json package-lock.json nachweis/wsl2)" ] ||
      die "nicht committete Änderungen — der Nachweis soll an einem Commit hängen"
    in_distro sh -c 'test ! -e /root/quelle' || die "/root/quelle existiert — Distribution neu importieren"
    [ -f "$ROOTFS_TAR" ] || die "$ROOTFS_TAR fehlt (AS_NACHWEIS_TAR setzen)"
    in_distro install -d -m 0700 /root/quelle
    # autocrlf aus: sonst kämen Shell-Skripte mit CRLF an, und bash bräche ab.
    git -c core.autocrlf=false archive --prefix=agentic-starter/ HEAD |
      in_distro tar -xf - -C /root/quelle
    git -C vendor/security-core -c core.autocrlf=false archive \
      --prefix=agentic-starter/vendor/security-core/ HEAD |
      in_distro tar -xf - -C /root/quelle
    {
      printf 'agentic-starter %s\n' "$(git rev-parse HEAD)"
      printf 'security-core %s (%s)\n' "$(git -C vendor/security-core rev-parse HEAD)" \
        "$(git -C vendor/security-core describe --tags --always)"
      printf 'image %s\n' "$IMAGE_DIGEST"
      printf 'rootfs-tar-sha256 %s\n' "$(sha256sum "$ROOTFS_TAR" | cut -d' ' -f1)"
      printf 'kopiert %s\n' "$(date -Iseconds)"
    } | in_distro sh -c 'cat > /root/quelle/herkunft.txt'
    in_distro cat /root/quelle/herkunft.txt
    ;;
  zurueck)
    in_distro test -d /root/nachweis || die "/root/nachweis fehlt — pruefen.sh lief noch nicht"
    mkdir -p nachweis
    in_distro tar -cf - -C /root/nachweis . | tar -xf - -C nachweis
    ls nachweis
    ;;
  *)
    die "Aufruf: kopieren.sh hin | zurueck"
    ;;
esac
