# Roadmap

Uslov za prelazak na sljedeću fazu je jasno napisan. Bez njega se ne ide dalje.

## 1. Prototip tapkanja — urađeno

- [x] Uvoz videa, lijepljenje teksta, podjela na redove i riječi
- [x] Tapkanje sa 0,5× / 0,75× / 1×, poništavanje, preskok, ponavljanje reda
- [x] Pregled s titlovima odmah nakon tapkanja
- [x] Automatski predlog iz analize govora (bez modela)
- [ ] Test s 5 ljudi: 30 s govora za manje od 2 minute, bez objašnjenja

## 2. Jezgro i format — urađeno

- [x] Model projekta, verzija šeme, migracija
- [x] Podjela teksta (NFC, dijakritici, emoji, jezici bez razmaka)
- [x] Tempiranje, raspoređivanje, fino pomjeranje bez preklapanja
- [x] Izmjena teksta uz čuvanje vremena
- [x] Uvoz i izvoz SRT, VTT, LRC
- [x] Testovi za tekst, tapkanje, animacije i formate

## 3. MVP na mobitelu — djelimično

- [x] 6 stilova i 6 filtera
- [x] Animacije po riječi i po redu
- [x] Sigurne zone
- [x] Pozicija titla prevlačenjem
- [x] Ispravka pojedine riječi
- [x] Prepoznavanje govora u browseru (Whisper)
- [x] Izvoz titlova i kadra
- [ ] Expo aplikacija za iOS i Android
- [ ] Izvoz MP4 (AVAssetWriter / MediaCodec)
- [ ] Provjera: izvoz jednak pregledu na 2 iPhonea i 3 Androida

## 4. Javno otvaranje

- [x] README, CONTRIBUTING, PRIVACY, format pluginova
- [ ] Stranica za isprobavanje pluginova u browseru
- [ ] 10 oznaka `good first issue`
- [ ] Prvi stil ili filter od osobe izvan projekta

## 5. Automatika

- [x] Whisper u browseru (WebGPU/WASM), izbor modela i jezika
- [x] Ispravka pojedine riječi bez ponovnog tempiranja
- [ ] Poravnanje zalijepljenog teksta sa zvukom
- [ ] Rječnik zamjena i očekivanih pojmova
- [ ] Provjera: na 10 videa na bosanskom automatika štedi vrijeme u odnosu na tapkanje

## 6. Web i desktop

- [ ] WebCodecs izvoz u browseru
- [ ] Tauri omot
- [ ] Isti projekat se otvara i izvozi isto na telefonu i u browseru

## 7. Galerija i novi alati

- [ ] Dijeljenje izgleda linkom ili QR kodom
- [ ] Galerija zajednice
- [ ] Izvoz titlova s prozirnom pozadinom
- [ ] Vizuali koji reaguju na zvuk
