# Arhitektura

Cilj: **jedno jezgro, tri tanke ljuske**. Sve što odlučuje kako titl izgleda i kada se pojavljuje
živi u čistom TypeScriptu. Telefon, browser i desktop samo crtaju i primaju ulaz.

```
apps/web            React + Vite        (prototip, pregled, editor)
apps/mobile         Expo + RN + Skia    (planirano)
apps/desktop        Tauri               (planirano)
        |
        v
packages/core       model, tekst, vrijeme, animacije, formati
packages/plugins    stilovi (.json) i filteri (.json + .sksl)
packages/render     crtanje kadra       (Skia na mobilnom, canvas u prototipu)
```

Pravilo zavisnosti: `core` ne uvozi React, Skiju, DOM ni fajl sistem. Zato se sve testira bez
telefona i bez browsera.

## Tok podataka

```
izvor teksta ──► buildLines() ──► Project.lines ──► TapSession / autoTimeWords
                                        │
                                        v
                     buildCaptionFrame(lines, time, style, box)
                                        │
                            ┌───────────┴───────────┐
                            v                       v
                     canvas / Skia            izvoz kadra
```

Renderer **ne zna** kako je vrijeme nastalo. Dobija `Project` i vrijeme u milisekundama. Zato
pregled i izvoz izgledaju isto: nema posebnog koda za izvoz.

## Model

`Project` je jedan čitljiv JSON fajl:

- `media` — putanja, trajanje, dimenzije, rotacija, fps, ima li zvuka, otisak fajla.
- `trim` — skraćeni dio videa, u vremenu originala.
- `offsetMs` — globalni pomak titlova, odvojen od vremena riječi.
- `lines[]` — redovi, svaki sa riječima.
- `word.startMs/endMs/source` — vrijeme i porijeklo vremena (`tap`, `auto`, `aligned`, `spread`,
  `manual`).
- `style` — `{ id, params }`, referenca na plugin stil.
- `filter` — `{ id, params }` ili `null`.
- `captionBox` — `{ x, y, width }`, udjeli 0..1.
- `animationOverrides` — korisničke izmjene animacija, da plugin ostane nepromijenjen.

Vremena su **uvijek** u milisekundama od početka originalnog videa. Skraćivanje mijenja `trim`, ne
riječi. Globalni pomak se dodaje samo pri prikazu i izvozu.

## Vrijeme i tapkanje

`TapSession` je jedini vlasnik stanja tokom tapkanja:

- `tap(atMs)` postavlja početak sljedeće riječi i zatvara prethodnu.
- Tap bliži od 40 ms prethodnom se odbacuje.
- Riječ kraća od 80 ms se produžava na 80 ms.
- Zadnja riječ u redu traje najviše 1500 ms, da titl ne visi preko tišine.
- Riječi bez tapa dobijaju vrijeme srazmjerno broju slogova između dva poznata tapa.
- Poništavanje vraća i stanje i poziciju videa.

Izvor vremena je uvijek `video.currentTime`, nikad `Date.now()`. To je razlog zašto usporeno
puštanje i zastoj ne kvare rezultat.

## Automatika

Dvije faze, obje na uređaju:

1. `detectSpeechRegions` gleda RMS glasnoću po prozorima od 20 ms i nađe govor. Tišina i muzika se
   preskaču.
2. `autoTimeWords` raspoređuje riječi po govornim dijelovima srazmjerno težini riječi.

To nije prepoznavanje govora. To je jeftin prvi prolaz koji korisniku ostavlja da popravi nekoliko
riječi umjesto da tapka sve.

## Prepoznavanje govora

Whisper radi u Web Workeru kroz Transformers.js, bez servera:

```
video → decodeAudioData → 16 kHz mono → Whisper (WebGPU, fallback WASM) → tekst + komadi
      → cleanTranscriptText → alignTranscriptWords → redovi titla
```

- `alignTranscriptWords` uzima **tekst kao istinu**, a komade modela koristi samo za vrijeme. Time
  se rješava čest problem da zadnje slovo ili interpunkcija pređu u susjednu riječ.
- Vremena se poravnavaju da se ne preklapaju: dvije riječi ne mogu biti aktivne istovremeno.
- Modeli: `tiny` (~40 MB), `base` (~80–150 MB), `small` (~250–500 MB). WebGPU drži encoder na
  GPU-u, dekoder kvantizovan; ako GPU nije dostupan, prelazi na WASM.
- Jezik bira korisnik. Za bosanski se `hr` često pokaže boljim od `bs`.

## Render

`buildCaptionFrame` je čista funkcija: ulazi su redovi, vrijeme, stil, okvir i mjerač teksta, izlaz
je kadar sa riječima, pozicijama, bojama i transformacijama. Nema DOM-a.

Animacije se slažu od osnovnih tipova (`fade`, `pop`, `slide`, `scale`, `color`, `typewriter`,
`wiggle`, `blur`). Svaka dobija proteklo vrijeme od početka riječi ili reda, pa je rezultat
deterministički.

Web prototip crta na canvas. Mobilna aplikacija crta isti kadar kroz Skiju. Tekst se mjeri
mjeračem koji pozivalac ubaci, pa je logika lomljenja redova ista svuda.

## Izvoz

- **Web**: WebCodecs + pakovanje u MP4. Kadrovi se crtaju istim rendererom, u punoj rezoluciji.
- **iOS**: `AVAssetWriter`, hardverski H.264/HEVC. Zvuk se prenosi bez ponovnog kodiranja kad može.
- **Android**: `MediaCodec` + `MediaMuxer`.

Nijedan put ne koristi FFmpeg, pa nema njegovih licencnih i patentnih problema.

## Format projekta

`schemaVersion` raste sa svakom izmjenom šeme. Migracije idu po verziji. Noviji projekat se u
starijoj aplikaciji odbija, nikad ne prepisuje.

Pisanje ide u privremeni fajl pa preimenovanje, da projekat nikad ne ostane napola upisan.

## Šta slijedi

1. Native izvoz (najveći rizik projekta).
2. Whisper kroz `whisper.rn` i poravnanje teksta sa zvukom.
3. Skia renderer za mobilno, dijeljen istog `core`.
4. WebCodecs izvoz u browseru.
