# Titlo

Animirani titlovi riječ po riječ i filteri za kratke videe. **Sve ostaje na uređaju** — bez
servera, bez naloga, bez slanja videa.

Titlo nije video editor. On je alat koji video snimljen bilo gdje pretvara u video sa titlovima koji
se pojavljuju u ritmu govora.

> Status: **radni prototip** (faza 1 i dobar dio faze 3 iz roadmapa). Radi uvoz videa, tapkanje,
> automatski predlog vremena, uređivanje po riječi, stilovi, filteri, animacije i izvoz titlova.
> Izvoz MP4 i prepoznavanje govora modelom dolaze uz native module.

---

## Šta radi sada

- **Uvoz videa** iz fajla (MP4/H.264, MOV, WebM), 9:16, 1:1, 4:5, 16:9.
- **Prepoznavanje govora na uređaju** (Whisper kroz Transformers.js): model napiše tekst i vremena
  riječi. Tri veličine modela, izbor jezika (`bs`, `hr`, `sr`, `en`).
  > Iskustvo s bosanskim: oznaka `hr` često daje bolji tekst od `bs`, jer hrvatski ima više
  > podataka u modelu. Probaj oba na istom snimku.
- **Lijepljenje teksta** s automatskom podjelom na redove i riječi (NFC, dijakritici, ćirilica,
  emoji, jezici bez razmaka kroz `Intl.Segmenter`).
- **Ispravka samo jedne riječi**: klikni riječ u traci, ispravi je i sačuvaj. Vrijeme ostaje, a ako
  upišeš više riječi one podijele postojeće trajanje.
- **Tapkanje**: video ide, ti tapneš kad čuješ riječ. 0,5× / 0,75× / 1×, poništavanje, preskok,
  ponavljanje reda, vibracija. Tastatura: `Space`, `K`, `⌫`, `←`, `→`, `1` `2` `3`.
- **Automatski predlog bez modela**: analiza glasnoće zvuka na uređaju pronađe govorne dijelove i
  rasporedi riječi po slogovima. Brzo, radi za svaki jezik, i dovoljno dobro da popraviš samo
  pogrešno.
- **Tapkanje samo jednog reda** — automatski predlog pa popravka tamo gdje ne valja.
- **Fino uređivanje**: klizači početka i kraja za svaku riječ (korak 10 ms), ivice se zaustavljaju
  na susjednoj riječi, globalni pomak za Bluetooth slušalice.
- **Pozicija titla**: prevuci titl mišem ili prstom po pregledu, ili podesi X/Y/širinu u kartici
  Stil.
- **6 stilova** titlova i **6 filtera**, oba kao mali JSON fajlovi.
- **Animacije**: fade, pop, odozgo, odozdo, uvećaj, kucanje, blur, wiggle — biraju se po riječi i
  po redu.
- **Pregled jednak izvozu**: isti renderer crta i ekran i kadar koji se snima.
- **Izvoz**: SRT, VTT, LRC, PNG kadar, `projekat.titlo.json`.
- **Sigurne zone** za Instagram, TikTok i Shorts, vidljive u pregledu.
- **Automatsko čuvanje** teksta, projekta i postavki lokalno. Projekt se nastavlja kad ponovo
  uvezeš isti video.

### Šta još nije urađeno

- Izvoz MP4 (čeka `native-export` / WebCodecs).
- Poravnanje zalijepljenog teksta sa zvukom (Whisper za sada piše i tekst i vremena).
- Mobilna aplikacija (Expo) i desktop omot (Tauri).
- Spajanje i razdvajanje redova u editoru.
- Historija poništavanja u editoru (u tapkanju radi).
- Galerija pluginova i dijeljenje izgleda linkom.

## Pokretanje

```bash
pnpm install
pnpm dev
# otvori http://127.0.0.1:5173
```

Na početnom ekranu klikni **Isprobaj s primjerom** ako nemaš svoj snimak.

Ostale komande:

```bash
pnpm test        # testovi jezgra (Vitest)
pnpm typecheck   # TypeScript u svim paketima
pnpm build       # produkcijski build web aplikacije
```

### Mobilna aplikacija

Ista aplikacija je zapakovana i za Android i iOS preko Capacitora:

```bash
pnpm build
npx cap sync
npx cap open android   # ili: npx cap open ios
```

Android build traži JDK 21 (`JAVA_HOME=/usr/local/opt/openjdk@21`), ne Java 25. Detalji i
ograničenja: [docs/mobile.md](docs/mobile.md).

## Kako radi

Tri načina tempiranja, od najpouzdanijeg ka najbržem:

1. **Tapkanje.** Tekst je već tu, ti tapkaš. Radi za svaki jezik, svaki sadržaj, bez modela.
2. **Automatski predlog.** Analiza govora na uređaju popuni vremena. Ti popraviš ono što ne valja,
   red po red.
3. **Prepoznavanje govora.** Whisper napiše tekst i vremena. Ti ispraviš samo pogrešne riječi.

### Kako popraviti prepoznati tekst

1. Izaberi jezik i model, pa klikni **Prepoznaj i napiši tekst**. Prvi put se model skida.
2. U editoru klikni riječ u traci ispod videa. Pojavi se polje **Ispravi riječ**.
3. Upiši tačnu riječ i pritisni Enter. Vrijeme ostaje isto; ako upišeš više riječi, one podijele
   trajanje.
4. Prevuci titl po pregledu da promijeniš poziciju. X/Y/širina su i u kartici **Stil**.

Ako je tekst loš na bosanskom, probaj jezik **Hrvatski** — model ima više podataka za njega i
češće pogodi bosanski nego oznaka `bs`. Model **Preporučeno** (`small`) je osjetno bolji od `base`
i `tiny`.

Boja u traci riječi kaže odakle vrijeme dolazi:

| Boja | Izvor | Značenje |
| --- | --- | --- |
| žuta | `tap` | ti si tapnuo |
| plava | `auto`, `aligned` | automatika ili uvezeni titl |
| isprekidana | `spread` | raspoređeno između susjeda |
| ljubičasta | `manual` | ručno pomjereno u editoru |

## Struktura

```
apps/web/               React + Vite prototip (pregled, tapkanje, editor)
packages/core/          model projekta, tekst, tempiranje, animacije, formati
packages/plugins/       stilovi i filteri kao JSON
design/                 originalni dizajn ekrana
docs/                   arhitektura i format pluginova
```

Pravilo zavisnosti: **`core` ne uvozi ništa iz Reacta ni iz Skije.** Sve što je pametno je tamo i
testira se bez telefona. Aplikacija samo spaja dijelove.

## Pravila koja kod poštuje

- Vrijeme je uvijek **pozicija videa**, nikad sistemski sat. Zato usporeno puštanje i zastoj ne
  kvare vremena.
- Vremena su cijeli brojevi milisekundi od početka **originalnog** videa. Skraćivanje i globalni
  pomak ne mijenjaju vremena riječi.
- Pozicije i veličine su udjeli 0..1, nikad pikseli.
- Animacija dolazi iz vremena riječi, ne iz sata, pa je svaki izvoz isti.
- Izmjena teksta čuva vrijeme riječi koje su ostale iste.
- Nijedan plugin nije izvršni kod: shader ne čita fajlove ni mrežu, JSON ne radi ništa sam.

## Licenca

Aplikacija i jezgro: **MPL-2.0**. Stilovi i filteri: **MIT**. Fontovi: OFL. Detalji u
[LICENSE](LICENSE) i [docs/plugin-format.md](docs/plugin-format.md).

Doprinos: [CONTRIBUTING.md](CONTRIBUTING.md). Privatnost: [PRIVACY.md](PRIVACY.md). Plan:
[ROADMAP.md](ROADMAP.md).
