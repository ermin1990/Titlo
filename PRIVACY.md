# Privatnost

Titlo radi po pravilu: **ništa ne napušta uređaj**.

## Šta aplikacija radi s podacima

- Video se čita lokalno, u browseru ili u aplikaciji. Ne kopira se na server i ne uploaduje.
- Tekst, vremena, stil i filter čuvaju se u lokalnom projektu na uređaju.
- U web prototipu tekst i postavke se pamte u `localStorage` pod ključem `titlo:draft:v1`. Možeš ih
  obrisati brisanjem podataka stranice.
- Fontovi su ugrađeni u aplikaciju. Nema poziva Google Fonts CDN-u.
- Nema analitike, nema reklama, nema naloga.
- Nema izvještaja o padu bez izričitog pristanka korisnika.

## Mreža

Web prototip ne šalje podatke nigdje. Ako ga otvoriš s lokalnog servera, jedini mrežni saobraćaj je
učitavanje samih fajlova aplikacije s tog servera.

**Prepoznavanje govora** je izuzetak koji korisnik sam pokrene: pri prvom korištenju model se skida
s Hugging Face (`onnx-community/whisper-*`), a poslije se koristi iz keša browsera. Zvuk i video se
**ne šalju** — model se izvršava lokalno. Ako želiš potpuno offline rad, preuzmi model jednom dok
imaš mrežu.

Mobilna aplikacija je predviđena da radi potpuno offline. Model se skida samo kad korisnik to
zatraži, uz upozorenje na mobilne podatke.

## Dijeljenje

Kada korisnik izveze projekat ili kadar, fajl ide tamo gdje ga korisnik pošalje. Aplikacija ne
šalje ništa sama.

## Kontakt

Pitanja o privatnosti: otvori issue s oznakom `privacy`.
