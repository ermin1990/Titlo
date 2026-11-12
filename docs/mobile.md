# Mobilna aplikacija

Ista web aplikacija se pakuje kao **Android** i **iOS** aplikacija preko Capacitora. Nema drugog
koda i nema drugog renderera — ono što vidiš u browseru je ono što vidiš u aplikaciji.

## Šta je unutra

- `android/` — Android Studio projekat (Kotlin/Gradle), WebView sa istim fajlovima iz `dist/`.
- `ios/` — Xcode projekat (Swift, Swift Package Manager), WKWebView.
- `capacitor.config.ts` — ime, paket (`app.titlo`) i folder web builda.

## Pokretanje

```bash
pnpm install
pnpm build            # web build + PWA
npx cap sync          # kopira build u android/ i ios/
```

### Android

Potreban je **JDK 21** (Java 25 ne radi s Gradle/AGP):

```bash
cd android
JAVA_HOME=/usr/local/opt/openjdk@21 ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Za rad u Android Studio: `npx cap open android`.

### iOS

```bash
npx cap open ios
# ili iz terminala, simulator:
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -sdk iphonesimulator -configuration Debug \
  CODE_SIGNING_ALLOWED=NO build
```

Za pravi uređaj treba Apple Developer potpis u Xcode-u.

## Ikone i splash

```bash
python3 scripts/generate-icons.py          # izvor: assets/icon.png, assets/splash.png
npx capacitor-assets generate --android --ios
```

## Šta radi u mobilnoj aplikaciji

- Uvoz videa iz galerije (Android document picker).
- Tapkanje, automatski predlog, uređivanje, stilovi, filteri, animacije.
- Prepoznavanje govora (Whisper) — na Android WebView-u radi kroz WASM; model se skida jednom.
- Izvoz SRT/VTT/LRC/JSON i PNG kadra kroz sistemski **Share** meni.

## Šta još treba

- **Izvoz MP4**: native modul (`MediaCodec` na Androidu, `AVAssetWriter` na iOS-u).
- Pozadinski izvoz i dozvole za galeriju.
- Provjera na stvarnim telefonima (snimak, zvuk, memorija).
- Apple potpis i Play Store nalog za objavu.

## Napomene

- `app.titlo` je radni paket; prije objave provjeri da nije zauzet.
- Service worker se **ne registruje** u native aplikaciji, da ne bi osvježavao stranicu.
- Hardversko dugme Natrag: tapkanje → tekst → početak → minimiziraj aplikaciju.
