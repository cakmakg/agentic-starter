#!/usr/bin/env bash
# ── nachweis/wsl2/pruefen.sh ─────────────────────────────────────────────
# Teil 5 der Kern-Integration (docs/kern-integration.md §2.4): belegt die
# Trennung, die der lokale Lauf unter Windows nicht belegen kann — drei
# Linux-Benutzer, Unix-Sockets, Dateirechte. Läuft als root in der
# Distribution as-nachweis; es handelt als Operator.
#
# Vorbild zum Lesen, keine Kopiervorlage:
#   vendor/security-core/minimal-core/deploy/linux/evidence.sh
#
# Vorher: nachweis/wsl2/kopieren.sh hin (unter Windows). Ein Lauf braucht eine
# frisch importierte Distribution. Es gibt bewusst kein Zurücksetzen: ein
# zweiter Lauf beginnt mit wsl --unregister und wsl --import aus demselben Tar,
# so trägt kein Lauf Reste des vorigen.
#
# Ergebnis: /root/nachweis/<datum>-wsl2/. Exit 0 nur, wenn jede Prüfung und
# jede Gegenprobe so ausfällt wie erwartet.

set -euo pipefail
umask 077
cd /

QUELLE=/root/quelle/agentic-starter
INSTALL=/opt/agentic-starter
NODE=/usr/local/bin/node
SAFE_PATH=/usr/local/bin:/usr/bin:/bin
AGENT=as-agent
CORE=as-core
PORTAL=as-portal
AGENT_HOME=/var/lib/as-agent
CORE_SOCKET=/run/as-core/core.sock
PORTAL_SOCKET=/run/as-portal/portal.sock
KEY=/etc/as-core/portal.key
HASH=/etc/as-portal/portal.hash
AUS=/root/nachweis/$(date +%F)-wsl2
# .txt statt .log: *.log steht in .gitignore, der Nachweis soll ins Repo.
AUSGABEN=$AUS/ausgaben
ERGEBNIS=$AUS/ergebnis.txt
GRUEN="C2=gruen C3=gruen C4=gruen C5=gruen"
GESAMT=0

die() {
  printf 'pruefen: %s\n' "$*" >&2
  exit 1
}

notiere() { printf '%s\n' "$*" | tee -a "$ERGEBNIS"; }

# ergebnis <id> <0 = wie erwartet> <text>
ergebnis() {
  local id="$1" ok="$2"
  shift 2
  if [ "$ok" = 0 ]; then
    notiere "$(printf '%-4s PASS  %s' "$id" "$*")"
  else
    notiere "$(printf '%-4s FAIL  %s' "$id" "$*")"
    GESAMT=1
  fi
}

vergleiche() {
  local id="$1" soll="$2" ist="$3"
  shift 3
  if [ "$soll" = "$ist" ]; then
    ergebnis "$id" 0 "$* → $ist"
  else
    ergebnis "$id" 1 "$* → $ist (erwartet: $soll)"
  fi
}

# --- Vorbedingungen ----------------------------------------------------------
[ "$(id -u)" = 0 ] || die "muss als root laufen"
for tool in runuser useradd groupadd gpasswd od stat sha256sum npm readlink paste; do
  command -v "$tool" >/dev/null || die "Werkzeug fehlt: $tool"
done
[ "$("$NODE" -p 'process.versions.node.split(".")[0]')" = 24 ] || die "Node 24 erwartet"
# Ohne -q: grep -q endet beim ersten Treffer, und pipefail machte aus dem
# SIGPIPE des ersten grep einen Fehlschlag.
grep -A3 '^\[interop\]' /etc/wsl.conf | grep '^enabled=false' >/dev/null || die "Interop ist nicht abgeschaltet"
grep -A3 '^\[automount\]' /etc/wsl.conf | grep '^enabled=false' >/dev/null || die "Automount ist nicht abgeschaltet"
! grep -qE ' /mnt/[a-z] ' /proc/mounts || die "ein Windows-Laufwerk ist eingehängt"
! id "$AGENT" >/dev/null 2>&1 || die "$AGENT existiert schon — Distribution neu importieren"
[ -d "$QUELLE" ] && [ -f /root/quelle/herkunft.txt ] || die "Quelle fehlt — vorher kopieren.sh hin"
[ -z "$(find "$QUELLE" \( -name .env -o -name '.env.*' \) ! -name .env.example -print -quit)" ] ||
  die "eine .env liegt in der Quelle"
NODE_ECHT=$(readlink -f "$NODE")

install -d -m 0700 "$AUS" "$AUSGABEN"
: >"$ERGEBNIS"

{
  echo "== Herkunft"
  cat /root/quelle/herkunft.txt
  echo "== System"
  (. /etc/os-release && echo "$PRETTY_NAME")
  uname -r
  echo "node $("$NODE" --version) · npm $(npm --version)"
  echo "== /etc/wsl.conf"
  cat /etc/wsl.conf
  echo "== Windows-Laufwerke in /proc/mounts"
  grep -E ' /mnt/[a-z] ' /proc/mounts || echo "keine"
  echo "== Lauf"
  date -Is
} >"$AUS/umgebung.txt"

# --- Benutzer und Gruppen ----------------------------------------------------
useradd --system --user-group --no-create-home --shell /usr/sbin/nologin --home-dir "$AGENT_HOME" "$AGENT"
for user in "$CORE" "$PORTAL"; do
  useradd --system --user-group --no-create-home --shell /usr/sbin/nologin "$user"
done
groupadd --system as-core-clients
groupadd --system as-portal-clients
gpasswd -a "$AGENT" as-core-clients >/dev/null
gpasswd -a "$CORE" as-portal-clients >/dev/null

# --- Installation: root gehört alles, der Agent schreibt nirgends hinein (S2) -
install -d -m 0755 -o root -g root "$INSTALL"
cp -a "$QUELLE/." "$INSTALL/"
printf 'pruefen: npm ci …\n'
(cd "$INSTALL" && HOME=/root npm ci --omit=dev --ignore-scripts --no-audit --no-fund) \
  >"$AUSGABEN/npm.txt" 2>&1 || die "npm ci fehlgeschlagen (ausgaben/npm.txt)"
chown -R root:root "$INSTALL"
chmod -R u=rwX,go=rX "$INSTALL"

# Arbeitsverzeichnis des Agenten: ohne .env. env.js lädt eine .env aus dem
# Arbeitsverzeichnis in process.env, und /proc/<pid>/environ zeigte das nicht.
install -d -m 0700 -o "$AGENT" -g "$AGENT" "$AGENT_HOME"

install -d -m 2750 -o "$CORE" -g as-core-clients /run/as-core
install -d -m 2750 -o "$PORTAL" -g as-portal-clients /run/as-portal

# 0755, damit C3 an den Dateien selbst hängt: mit 0700 bliebe die Gegenprobe
# "Schlüsseldatei 0444" grün, und sie bewiese nichts.
install -d -m 0755 -o root -g root /etc/as-core /etc/as-portal

# Der Schlüssel existiert nur in dieser Shell und in genau einer Datei; das
# Portal erhält seinen Hash. printf ist eingebaut — der Wert steht in keiner
# Befehlszeile.
SCHLUESSEL="asp_$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
printf '%s' "$SCHLUESSEL" >"$KEY"
chown "$CORE:$CORE" "$KEY"
chmod 0400 "$KEY"
printf '%s' "$SCHLUESSEL" | sha256sum | cut -d' ' -f1 | tr -d '\n' >"$HASH"
chown "$PORTAL:$PORTAL" "$HASH"
chmod 0400 "$HASH"
unset SCHLUESSEL

# --- Prozesse ----------------------------------------------------------------
# Ohne procps im Image (es bleibt beim belegten Digest): Prozesse über /proc.
pids_von() {
  local uid p
  uid=$(id -u "$1")
  for p in /proc/[0-9]*; do
    if [ "$(stat -c %u "$p" 2>/dev/null || true)" = "$uid" ]; then
      printf '%s\n' "${p#/proc/}"
    fi
  done
}

stoppe() {
  local p
  for p in $(pids_von "$1"); do kill "$p" 2>/dev/null || true; done
  for _ in $(seq 1 50); do
    [ -z "$(pids_von "$1")" ] && return 0
    sleep 0.1
  done
  for p in $(pids_von "$1"); do kill -9 "$p" 2>/dev/null || true; done
}

# Leere Umgebung plus nur die Variablen aus ADR-0031 Teil 3; gestartet aus /,
# damit kein Arbeitsverzeichnis geerbt wird.
starte_dienst() {
  local user="$1" log="$2"
  shift 2
  (cd / && runuser -u "$user" -- env -i PATH="$SAFE_PATH" "$@" >"$log" 2>&1 &) </dev/null >/dev/null 2>&1
  for _ in $(seq 1 100); do
    grep -q '^ready ' "$log" 2>/dev/null && return 0
    sleep 0.1
  done
  cat "$log" >&2
  die "$user startet nicht"
}

# Die Demo als as-agent aus ihrem Arbeitsverzeichnis. Weitere VAR=wert-Argumente
# landen in ihrer Umgebung (Gegenprobe zu C2).
starte_demo() {
  local log="$AUSGABEN/demo-$1.txt" ex="$AUSGABEN/demo-$1.exit.txt"
  shift
  (cd "$AGENT_HOME" && {
    runuser -u "$AGENT" -- env -i PATH="$SAFE_PATH" SECURITY_CORE_SOCKET="$CORE_SOCKET" "$@" \
      "$NODE" "$INSTALL/src/bin/demoImmobilien.js" >"$log" 2>&1 && echo 0 >"$ex" || echo $? >"$ex"
  } &) </dev/null >/dev/null 2>&1
}

warte_demo() {
  local ex="$AUSGABEN/demo-$1.exit.txt"
  for _ in $(seq 1 1200); do
    if [ -s "$ex" ]; then
      cat "$ex"
      return 0
    fi
    sleep 0.1
  done
  echo "zeitueberschreitung"
}

zaehle() { grep -cE ": $1( |\$)" "$AUSGABEN/demo-$2.txt" || true; }

# Zahl der Inserate im Portal — als Operator, mit dem Schlüssel aus der Datei;
# er steht in keiner Befehlszeile und in keiner Ausgabe.
inserate() {
  "$NODE" -e '
    const fs = require("node:fs"), http = require("node:http");
    const k = fs.readFileSync(process.argv[1], "utf8");
    http.get({ socketPath: process.argv[2], path: "/listings", headers: { authorization: "Bearer " + k } }, (r) => {
      let b = "";
      r.on("data", (d) => (b += d));
      r.on("end", () => {
        if (r.statusCode !== 200) process.exit(2);
        console.log(JSON.parse(b).listings.length);
      });
    }).on("error", () => process.exit(3));' "$KEY" "$PORTAL_SOCKET"
}

# --- Prüfungen ---------------------------------------------------------------
# Der Prozess der Demo, sobald er node ist: davor ist es noch runuser mit dessen
# Umgebung, und die zu messen wäre ein falsches Rot.
agent_pid() {
  local p
  for _ in $(seq 1 500); do
    for p in $(pids_von "$AGENT"); do
      if [ "$(readlink "/proc/$p/exe" 2>/dev/null || true)" = "$NODE_ECHT" ]; then
        printf '%s' "$p"
        return 0
      fi
    done
    sleep 0.02
  done
  return 1
}

# C2: Umgebung des laufenden Agenten. Strenger als "kein asp_, kein PORTAL_*":
# genau PATH und SECURITY_CORE_SOCKET, Arbeitsverzeichnis ohne .env. Geschrieben
# werden nur Namen, nie Werte.
pruefe_c2() {
  local name="$1" pid roh namen cwd treffer
  shift
  starte_demo "$name" "$@"
  if ! pid=$(agent_pid); then
    DEMO_EXIT=$(warte_demo "$name")
    C2_GRUND="Agentenprozess nicht gefunden"
    return 1
  fi
  roh=$( { tr '\0' '\n' <"/proc/$pid/environ"; } 2>/dev/null) || roh=""
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || cwd=""
  DEMO_EXIT=$(warte_demo "$name")
  namen=$(printf '%s\n' "$roh" | cut -d= -f1 | sort | paste -sd' ')
  treffer=$(printf '%s\n' "$roh" | grep -cE '^PORTAL_|asp_' || true)
  C2_GRUND="Variablen: $namen · cwd: $cwd · Treffer asp_/PORTAL_*: $treffer"
  [ "$namen" = "PATH SECURITY_CORE_SOCKET" ] && [ "$cwd" = "$AGENT_HOME" ] &&
    [ ! -e "$AGENT_HOME/.env" ] && [ "$treffer" = 0 ]
}

pruefe_c3() {
  ! runuser -u "$AGENT" -- cat "$KEY" >/dev/null 2>&1 &&
    ! runuser -u "$AGENT" -- cat "$HASH" >/dev/null 2>&1
}

pruefe_c4() {
  ! runuser -u "$AGENT" -- "$NODE" -e '
    const s = require("node:net").connect(process.argv[1]);
    s.on("connect", () => process.exit(0));
    s.on("error", () => process.exit(1));' "$PORTAL_SOCKET" >/dev/null 2>&1
}

pruefe_c5() {
  local geschrieben=0
  runuser -u "$AGENT" -- touch "$INSTALL/.c5-probe" 2>/dev/null && geschrieben=1
  runuser -u "$AGENT" -- touch "$INSTALL/src/bin/.c5-probe" 2>/dev/null && geschrieben=1
  rm -f "$INSTALL/.c5-probe" "$INSTALL/src/bin/.c5-probe"
  [ "$geschrieben" = 0 ]
}

# C2–C5 unter einem Zustand, z. B. "C2=gruen C3=rot C4=gruen C5=gruen".
zustand() {
  local name="$1" z
  shift
  if pruefe_c2 "$name" "$@"; then z="C2=gruen"; else z="C2=rot"; fi
  printf '%s · %s\n' "$name" "$C2_GRUND" >>"$AUSGABEN/c2-details.txt"
  if pruefe_c3; then z="$z C3=gruen"; else z="$z C3=rot"; fi
  if pruefe_c4; then z="$z C4=gruen"; else z="$z C4=rot"; fi
  if pruefe_c5; then z="$z C5=gruen"; else z="$z C5=rot"; fi
  printf '%s' "$z"
}

rot_bei() { printf '%s' "${GRUEN/$1=gruen/$1=rot}"; }

# --- Lauf --------------------------------------------------------------------
starte_dienst "$PORTAL" "$AUSGABEN/portal.txt" \
  PORTAL_SOCKET="$PORTAL_SOCKET" PORTAL_CREDENTIAL_HASH_FILE="$HASH" \
  "$NODE" "$INSTALL/src/bin/fakePortal.js"
starte_dienst "$CORE" "$AUSGABEN/kern.txt" \
  CORE_SOCKET="$CORE_SOCKET" PORTAL_SOCKET="$PORTAL_SOCKET" PORTAL_CREDENTIAL_FILE="$KEY" \
  "$NODE" "$INSTALL/src/bin/securityCore.js"

{
  echo "== Rechte"
  stat -c '%A %U:%G %n' "$INSTALL" "$INSTALL/src/bin" "$AGENT_HOME" /run/as-core /run/as-portal \
    "$CORE_SOCKET" "$PORTAL_SOCKET" /etc/as-core /etc/as-portal "$KEY" "$HASH"
  echo "== Benutzer"
  id "$AGENT"
  id "$CORE"
  id "$PORTAL"
} >>"$AUS/umgebung.txt"

notiere "Teil 5 — WSL2-Lauf $(date -Is)"
notiere "$(grep '^agentic-starter ' /root/quelle/herkunft.txt)"
notiere ""

# C1 und C2 am selben Lauf der Demo
vorher=$(inserate) || die "Portal antwortet nicht auf GET /listings"
if pruefe_c2 c1; then c2=0; else c2=1; fi
printf 'c1 · %s\n' "$C2_GRUND" >>"$AUSGABEN/c2-details.txt"
nachher=$(inserate) || die "Portal antwortet nicht auf GET /listings"
done_n=$(zaehle DONE c1)
if [ "$DEMO_EXIT" = 0 ] && [ "$done_n" = 3 ] && [ "$((nachher - vorher))" = 3 ]; then c=0; else c=1; fi
ergebnis C1 "$c" "Demo als $AGENT: Exit $DEMO_EXIT, $done_n× DONE, Inserate $vorher → $nachher"
ergebnis C2 "$c2" "$C2_GRUND"

pruefe_c3 && c=0 || c=1
ergebnis C3 "$c" "$AGENT liest weder $KEY noch $HASH"
pruefe_c4 && c=0 || c=1
ergebnis C4 "$c" "$AGENT öffnet $PORTAL_SOCKET nicht"
pruefe_c5 && c=0 || c=1
ergebnis C5 "$c" "$AGENT schreibt nicht in $INSTALL"

notiere ""
notiere "Gegenproben — jede macht genau ihre Prüfung rot; danach zurück auf grün"

chmod 0444 "$KEY"
vergleiche G1 "$(rot_bei C3)" "$(zustand g1-an)" "Schlüsseldatei 0444"
chmod 0400 "$KEY"
vergleiche G1z "$GRUEN" "$(zustand g1-zurueck)" "Schlüsseldatei wieder 0400"

gpasswd -a "$AGENT" as-portal-clients >/dev/null
vergleiche G2 "$(rot_bei C4)" "$(zustand g2-an)" "$AGENT in as-portal-clients"
gpasswd -d "$AGENT" as-portal-clients >/dev/null
vergleiche G2z "$GRUEN" "$(zustand g2-zurueck)" "$AGENT wieder draußen"

# Eine Attrappe im Format des Schlüssels, nicht der echte: er stünde sonst in
# der Befehlszeile von runuser und env.
ATTRAPPE="asp_$(printf '0%.0s' $(seq 1 64))"
vergleiche G3 "$(rot_bei C2)" "$(zustand g3-an "PORTAL_CREDENTIAL=$ATTRAPPE")" \
  "Schlüssel in der Umgebung des Agenten"
vergleiche G3z "$GRUEN" "$(zustand g3-zurueck)" "Umgebung wieder ohne Schlüssel"

chmod o+w "$INSTALL"
vergleiche G4 "$(rot_bei C5)" "$(zustand g4-an)" "Installationsverzeichnis schreibbar"
chmod o-w "$INSTALL"
vergleiche G4z "$GRUEN" "$(zustand g4-zurueck)" "Installationsverzeichnis wieder 0755"

notiere ""

# C6 zuletzt: ohne Kern bleibt keine Prüfung mehr übrig, die ihn bräuchte.
stoppe "$CORE"
vorher=$(inserate) || die "Portal antwortet nicht auf GET /listings"
starte_demo c6
c6_exit=$(warte_demo c6)
nachher=$(inserate) || die "Portal antwortet nicht auf GET /listings"
failed_n=$(zaehle FAILED c6)
done_n=$(zaehle DONE c6)
if [ "$c6_exit" != 0 ] && [ "$failed_n" = 3 ] && [ "$done_n" = 0 ] && [ "$nachher" = "$vorher" ]; then c=0; else c=1; fi
ergebnis C6 "$c" "Kern gestoppt: Exit $c6_exit, $failed_n× FAILED, $done_n× DONE, Inserate $vorher → $nachher"

stoppe "$PORTAL"

# Der Schlüssel darf in keiner Datei des Nachweises stehen.
grep -rqF -f "$KEY" "$AUS" && c=1 || c=0
ergebnis S "$c" "Schlüssel in keiner Datei unter $AUS"

notiere ""
[ "$GESAMT" = 0 ] && notiere "GESAMT: PASS" || notiere "GESAMT: FAIL"
exit "$GESAMT"
