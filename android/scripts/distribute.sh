#!/usr/bin/env bash
# Compila a versão assinada e envia pelo Firebase App Distribution. Rodar de dentro de android/.
# Antes de cada versão nova, aumentar versionCode (e versionName) em app/build.gradle.kts: o
# aviso de atualização só aparece para um versionCode maior.
# Uso: scripts/distribute.sh "notas da versão" email1,email2
set -euo pipefail
NOTES=${1:?"notas da versão"}
TESTERS=${2:?"e-mails das testadoras, separados por vírgula"}

./gradlew -q assembleRelease
cd ../firebase
npx -y firebase-tools@15.32.1 appdistribution:distribute ../android/app/build/outputs/apk/release/app-release.apk \
  --app 1:971566563350:android:cac505d82ff89fe79b7537 --project lombada-db \
  --testers "$TESTERS" --release-notes "$NOTES"
