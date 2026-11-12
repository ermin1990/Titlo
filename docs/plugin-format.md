# Format pluginova

Stil titlova i filter su **fajlovi, ne kod**. Stil je JSON. Filter je JSON + SkSL shader (u
prototipu CSS ekvivalent za pregled). Zato ih može napraviti neko ko nikad nije pokrenuo React
Native.

```
packages/plugins/
  styles/
    pop-karaoke.json
  filters/
    topli-film.json
    topli-film/
      shader.sksl        (produkcijski)
      preview.jpg
```

## Stil titlova

```json
{
  "schemaVersion": 1,
  "id": "titlo/pop-karaoke",
  "name": { "bs": "Pop karaoke", "en": "Pop karaoke" },
  "author": "github-ime",
  "license": "MIT",
  "font": { "family": "Inter", "weight": 800, "size": 0.062 },
  "layout": { "maxLines": 2, "maxWordsOnScreen": 5, "align": "center", "lineHeight": 1.16 },
  "text": { "fill": "#FFFFFF", "stroke": "#000000", "strokeWidth": 0.08, "uppercase": true },
  "activeWord": { "fill": "#FFE14A", "scale": 1.04 },
  "futureWord": { "opacity": 0.72 },
  "animations": {
    "lineIn": [{ "type": "fade", "durationMs": 120 }],
    "wordIn": [{ "type": "pop", "durationMs": 140, "easing": "backOut" }],
    "lineOut": [{ "type": "fade", "durationMs": 100 }]
  }
}
```

### Polja

| Polje | Značenje |
| --- | --- |
| `id` | `autor/ime`, jedinstveno. Ime autora ide u naziv. |
| `name` | Naziv na jezicima; najmanje `bs` i `en`. |
| `font.family` | Font mora imati otvorenu licencu i glifove `č ć š ž đ`. |
| `font.size` | Udio visine videa (0.062 = 6,2 %). Nikad pikseli. |
| `font.weight` | 400–800. |
| `font.letterSpacing` | U `em`, npr. `-0.01`. |
| `layout.maxLines` | Koliko redova stane; ako ne stane, font se smanjuje do 70 %. |
| `layout.align` | `left`, `center`, `right`. |
| `layout.lineHeight` | Množilac visine reda, npr. `1.16`. |
| `text.fill` | Boja teksta. |
| `text.stroke`, `strokeWidth` | Obrub; debljina je udio veličine fonta. |
| `text.uppercase` | Velika slova po jeziku projekta (`toLocaleUpperCase`). |
| `text.shadow` | Blaga sjenka za čitljivost na svijetlom videu. |
| `text.background` | Obrub iza reda: `color`, `opacity`, `paddingX`, `paddingY`, `radius` (u `em`). |
| `activeWord.fill` | Boja riječi koja se upravo izgovara. |
| `activeWord.scale` | Uvećanje aktivne riječi; drži blizu 1 da ne gura susjede. |
| `futureWord.opacity` | Prozirnost riječi koje još nisu izgovorene. |

### Animacije

Dostupni tipovi:

| Tip | Šta radi | Posebna polja |
| --- | --- | --- |
| `fade` | prozirnost 0 → 1 | `from` |
| `pop` | skala 0.7 → 1 sa `backOut` | `from` |
| `slide` | dolazak sa strane | `dy`, `dx` (udio visine/širine) |
| `scale` | skala 1.35 → 1 | `from` |
| `typewriter` | otkriva slovo po slovo | — |
| `blur` | blur 10 px → 0 | — |
| `wiggle` | kratko zakretanje | — |
| `color` | rezervisano | — |

Zajednička polja: `durationMs`, `easing` (`linear`, `easeOut`, `easeInOut`, `backOut`).

Animacije se **slažu**: `lineIn` važi za cijeli red, `wordIn` za pojedinačnu riječ, `lineOut` na
kraju. Novo polje animacije se dodaje u jezgro kroz pull request, ne kroz plugin.

## Filter

```json
{
  "schemaVersion": 1,
  "id": "titlo/topli-film",
  "name": { "bs": "Topli film", "en": "Warm film" },
  "author": "github-ime",
  "license": "MIT",
  "flashing": false,
  "params": [
    { "key": "intensity", "type": "float", "min": 0, "max": 1, "default": 0.7 }
  ],
  "webPreview": { "css": "sepia(0.35) saturate(1.15) contrast(1.05) brightness(1.03)" }
}
```

Produkcijski filter ima `shader.sksl`. Ulazi su uvijek isti:

```glsl
uniform shader image;      // kadar videa
uniform float2 resolution; // veličina u pikselima
uniform float time;        // vrijeme videa u sekundama
uniform float intensity;   // parametar iz filter.json
```

Pravila:

- `time` je vrijeme videa, ne sistemski sat, pa je izvoz isti kao pregled.
- Nasumičnost zavisi od `time` i pozicije piksela, nikad od `Math.random()`.
- Filter ne čita fajlove, mrežu ni druge resurse.
- `webPreview.css` služi samo prototipu; parametri moraju odgovarati shaderu.
- Filter koji treperi mora imati `"flashing": true`; aplikacija prikaže upozorenje.
- Shader koji se ne kompajlira na nekom GPU-u se isključuje, aplikacija ne pada.

## Licenca

Stilovi i filteri su **MIT**. Fontovi moraju biti OFL ili Apache-2.0, s licencom u repozitoriju.
Ako koristiš tuđi shader, navedi izvor i licencu.

## Provjere pri doprinosu

- JSON je validan prema šemi.
- `id` je jedinstven i ima prefiks autora.
- Font ima `č ć š ž đ` i licencu.
- Stil se iscrta na referentnom kadru bez greške.
- Filter se kompajlira i nije prespor (mjeri se vrijeme crtanja referentnog kadra).
