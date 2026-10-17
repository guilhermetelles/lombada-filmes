#!/usr/bin/env bash
# Roda os testes instrumentados (app/src/androidTest) no celular pareado, contra os emuladores de
# Auth e Firestore com as regras de firebase/firestore.rules. Rodar de dentro de android/.
# O adb é o do Windows (o celular é pareado pelo Android Studio), e o adb reverse leva o 127.0.0.1
# do celular até os emuladores no WSL, pelo encaminhamento de localhost do Windows.
set -euo pipefail
ADB=${ADB:-/mnt/c/Users/plugify/AppData/Local/Android/Sdk/platform-tools/adb.exe}

./gradlew -q assembleDebug assembleDebugAndroidTest
"$ADB" reverse tcp:8080 tcp:8080 >/dev/null
"$ADB" reverse tcp:9099 tcp:9099 >/dev/null
"$ADB" install -r app/build/outputs/apk/debug/app-debug.apk >/dev/null
"$ADB" install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk >/dev/null

cd ../firebase
npx -y firebase-tools@15.32.1 emulators:exec --only auth,firestore --project demo-lombada \
  "$ADB shell am instrument -w io.github.guilhermetelles.lombada.test/androidx.test.runner.AndroidJUnitRunner" \
  | tee /dev/stderr | grep -q '^OK ('
