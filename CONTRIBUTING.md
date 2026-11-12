# Doprinos

Hvala što želiš pomoći. Cilj je da **prvi doprinos traje jedno popodne**, bez poznavanja React
Native-a.

## Postavljanje (5 koraka)

```bash
git clone <repo>
cd titlo
pnpm install
pnpm dev
```

Otvori `http://127.0.0.1:5173`, klikni **Isprobaj s primjerom** i vidi cijeli tok za pola minute.

Prije pull requesta:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Dodaj stil titlova za 15 minuta

1. Kopiraj `packages/plugins/styles/pop-karaoke.json` u novi fajl, npr. `moj-stil.json`.
2. Promijeni `id` u `tvoj-github/moj-stil` i `name` na bosanskom i engleskom.
3. Podesi font, veličinu, boje i animacije (sva polja su u
   [docs/plugin-format.md](docs/plugin-format.md)).
4. Dodaj fajl u `packages/plugins/src/index.ts` u listu `STYLES`.
5. Pokreni `pnpm dev` i provjeri kako izgleda na primjeru.

Veličine su **udjeli visine videa**, ne pikseli. `0.062` znači 6,2 % visine. Font mora imati
otvorenu licencu i glifove za `č ć š ž đ`.

## Dodaj filter

1. Kopiraj `packages/plugins/filters/topli-film.json`.
2. Promijeni `id`, ime i `webPreview.css` (CSS filter koji prototip koristi za pregled).
3. Dodaj ga u `FILTERS` u `packages/plugins/src/index.ts`.
4. U produkcijskoj aplikaciji isti plugin ima `shader.sksl`; parametri moraju ostati isti.

Filter koji bljeska mora imati `"flashing": true`, da aplikacija pokaže upozorenje.

## Kod

- `packages/core` ne smije uvoziti React, Skiju ni browser API-je. Piši čiste funkcije i testiraj ih.
- Vremena su milisekunde, pozicije su udjeli 0..1. Bez piksela u modelu.
- Svaka funkcija koja dira vrijeme dobija test u `packages/core/test/`.
- Imena na engleskom, komentari i tekst interfejsa na bosanskom.
- Bez novih zavisnosti u `core` bez dobrog razloga.

## Commit

Konvencionalni commit, kratko i u imperativu:

```
feat(core): tap closes previous word at video time
fix(web): keep caption spacing when active word scales
docs: add plugin format
```

## Pull request

- Jedna stvar po PR-u.
- Napiši **šta** i **zašto**, ne samo šta je promijenjeno.
- Ako mijenjaš format projekta ili plugina, povećaj `schemaVersion` i napiši migraciju.
- Dodaj screenshot ili kratak snimak za vizuelne promjene.
- Pokreni `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Prijava greške

U prijavi navedi: uređaj i browser, format videa (MP4/H.264, MOV…), jezik teksta, i korake do
greške. Ako možeš, priloži kratak snimak ili projekat (`projekat.titlo.json`) — bez videa.

## Kodeks

Budi korektan. Kritikuj kod, ne osobu. Diskusije o formatu pluginova idu kroz GitHub Discussions.
