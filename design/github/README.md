# GitHub visuals

Source files for the images used in the README and the GitHub social preview. Everything is plain
HTML/CSS, rendered with headless Chrome, so the text stays crisp and the brand stays consistent.

| File | Used for |
| --- | --- |
| `hero.png` | README hero (1600×900) |
| `how.png` | "How it works" strip (1600×700) |
| `architecture.png` | Architecture diagram (1600×700) |
| `social.png` | GitHub social preview (1280×640) |

Rendered copies live in `docs/images/`.

## Regenerate

```bash
cd design/github
python3 -m http.server 4180 --bind 127.0.0.1

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1600,900 \
  --virtual-time-budget=4000 --screenshot="$PWD/hero.png" \
  http://127.0.0.1:4180/hero.html

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1600,700 \
  --virtual-time-budget=4000 --screenshot="$PWD/how.png" \
  http://127.0.0.1:4180/how.html

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1600,700 \
  --virtual-time-budget=4000 --screenshot="$PWD/architecture.png" \
  http://127.0.0.1:4180/architecture.html

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1280,640 \
  --virtual-time-budget=4000 --screenshot="$PWD/social.png" \
  http://127.0.0.1:4180/social.html

cp hero.png how.png architecture.png social.png ../../docs/images/
```

## Assets

- `fonts/` — Inter, Space Grotesk and JetBrains Mono (OFL), copied from the app's `@fontsource`
  packages.
- `shots/` — real screenshots from the Android build, cropped to remove the system status bar.

Set the social preview manually: **GitHub → repository Settings → Social preview → upload
`docs/images/social.png`**. GitHub has no API for this setting.
