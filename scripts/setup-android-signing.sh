#!/usr/bin/env bash
# Napravi ključ za potpis Android Beta/release APK-a i postavi GitHub tajne.
#
#   bash scripts/setup-android-signing.sh
#
# - Keystore ide u ~/.titlo/titlo-release.jks (izvan repoa, nikad u git).
# - Lozinka se čuva u macOS Keychainu (servis "titlo-android-keystore").
# - GitHub tajne TITLO_KEYSTORE_BASE64, TITLO_KEYSTORE_PASSWORD,
#   TITLO_KEY_ALIAS i TITLO_KEY_PASSWORD se postavljaju iz Keychaina.
#
# Ponovno pokretanje ne pravi novi ključ: koristi postojeći i samo ponovo
# postavi tajne. Isti ključ = nova verzija se instalira preko stare.
set -euo pipefail

REPO="ermin1990/Titlo"
DIR="$HOME/.titlo"
KEYSTORE="$DIR/titlo-release.jks"
ALIAS="titlo"
SERVICE="titlo-android-keystore"

find_keytool() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/keytool" ]; then
    echo "$JAVA_HOME/bin/keytool"
  elif [ -x /usr/local/opt/openjdk@21/bin/keytool ]; then
    echo /usr/local/opt/openjdk@21/bin/keytool
  elif [ -x /opt/homebrew/opt/openjdk@21/bin/keytool ]; then
    echo /opt/homebrew/opt/openjdk@21/bin/keytool
  elif [ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" ]; then
    echo "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"
  elif command -v keytool >/dev/null 2>&1 && keytool -help >/dev/null 2>&1; then
    echo keytool
  else
    echo "Nisam našao keytool (instaliraj JDK 21: brew install openjdk@21)." >&2
    exit 1
  fi
}

command -v gh >/dev/null || { echo "Treba GitHub CLI: brew install gh, pa gh auth login." >&2; exit 1; }
command -v security >/dev/null || { echo "Ova skripta koristi macOS Keychain." >&2; exit 1; }
KEYTOOL="$(find_keytool)"

mkdir -p "$DIR"
chmod 700 "$DIR"

if [ -f "$KEYSTORE" ]; then
  echo "Ključ već postoji: $KEYSTORE (koristim ga)."
  if ! security find-generic-password -s "$SERVICE" -a "$ALIAS" -w >/dev/null 2>&1; then
    echo "Lozinka nije u Keychainu. Upiši lozinku postojećeg ključa:"
    read -r -s -p "Lozinka: " TITLO_PW; echo
    security add-generic-password -U -s "$SERVICE" -a "$ALIAS" -w "$TITLO_PW"
    unset TITLO_PW
  fi
else
  echo "Pravim novi ključ za potpis u $KEYSTORE"
  while true; do
    read -r -s -p "Nova lozinka (najmanje 8 znakova): " TITLO_PW; echo
    read -r -s -p "Ponovi lozinku: " TITLO_PW2; echo
    if [ "${#TITLO_PW}" -lt 8 ]; then echo "Prekratko."; continue; fi
    if [ "$TITLO_PW" != "$TITLO_PW2" ]; then echo "Lozinke se ne poklapaju."; continue; fi
    break
  done
  unset TITLO_PW2
  export TITLO_PW
  "$KEYTOOL" -genkeypair -v \
    -keystore "$KEYSTORE" -storetype PKCS12 \
    -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
    -dname "CN=Titlo, O=Titlo, C=BA" \
    -storepass:env TITLO_PW -keypass:env TITLO_PW >/dev/null
  chmod 600 "$KEYSTORE"
  security add-generic-password -U -s "$SERVICE" -a "$ALIAS" -w "$TITLO_PW"
  unset TITLO_PW
  echo "Ključ napravljen, lozinka spremljena u Keychain (servis: $SERVICE)."
fi

echo "Postavljam GitHub tajne za $REPO…"
base64 -i "$KEYSTORE" | gh secret set TITLO_KEYSTORE_BASE64 --repo "$REPO"
security find-generic-password -s "$SERVICE" -a "$ALIAS" -w | tr -d '\n' | gh secret set TITLO_KEYSTORE_PASSWORD --repo "$REPO"
security find-generic-password -s "$SERVICE" -a "$ALIAS" -w | tr -d '\n' | gh secret set TITLO_KEY_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS" | gh secret set TITLO_KEY_ALIAS --repo "$REPO"

cat <<EOF

Gotovo. Sljedeći push na main pravi potpisan APK.

VAŽNO: napravi rezervnu kopiju fajla
  $KEYSTORE
(npr. u password manager ili na enkriptovani disk). Ako se izgubi, nove
verzije se neće moći instalirati preko postojećih.
Lozinku nađeš u aplikaciji Keychain Access pod "$SERVICE".
EOF
