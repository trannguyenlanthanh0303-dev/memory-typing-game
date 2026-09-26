# Muscle-Memory Typing Test

A single static `index.html` with no dependencies and no backend. Participants type common words on an on-screen keyboard that copies their phone's own keyboard, with about 75% of the letter labels hidden (7 of 26 shown). Every tap is recorded so the session can be replayed and analyzed.

## Run / host
- Local: `python3 -m http.server 8000`, then open `http://<your-LAN-ip>:8000/` on a phone.
- Real use: put `index.html` on any static HTTPS host (GitHub Pages, Netlify, S3…). The native share sheet and the clipboard need HTTPS.
- iPhone Safari can't hide its own browser bars. For true full screen, participants use **Share → Add to Home Screen**. Android Chrome switches to full screen when **Start** is tapped.

## URL parameters
| Param | Meaning |
|---|---|
| `?n=5` | Words per session (1–20, default 5) |
| `?seed=abc` | Fixed word order and fixed hidden labels. Give every participant the same seed to get identical tasks. |
| `?kb=ios\|gboard\|samsung` | Force a keyboard skin. By default it's detected: iOS → `ios`, Samsung (model `SM-…`) → `samsung`, other Android → `gboard`. |
| `#r=<data>` | A recording packed into the link. Opens the results and replay. |

## Collecting data
**Share recording** sends the recording as a file through the phone's share sheet.
- iOS sends it as `typing-<seed>-<n>.json`.
- Chrome on Android only allows certain file types to be shared, so there it's sent as `typing-<seed>-<n>.txt`. The contents are the same JSON.
- If the share sheet can't send files (e.g. desktop), the file is downloaded instead.

**Copy link** copies a replay link for a quick look. The data sits after the `#`, so it never reaches the web server.

To look at a file again, use **Load a recording** on the intro screen.

## Recording format (v1)
```json
{
  "v": 1,
  "kb": "ios",
  "seed": "k3j9",
  "n": 5,
  "trials": [
    { "word": "because", "vis": ["b", "q", "x", "d", "j", "k", "w"], "ev": [[412, 88, "b", 312, 540]], "submit": 2150 }
  ]
}
```
- `kb`: the keyboard skin that was shown. It sets how `x`/`y` map onto keys.
- `vis`: the letters whose labels were visible for that word. The first is always the word's first letter; the other six are random letters that aren't in the word (`VISIBLE_LABELS` in the script).
- `ev`: one entry per tap, as `[tDown, holdMs, key, x, y]`, sorted by `tDown`.
  - `tDown` is ms after the word appeared.
  - `key` is `a`–`z`, `" "` (space), `"<"` (backspace), or a key that types nothing (`shift`, `123`, `emoji`, `,`, `.`, `globe`, `mic`).
  - `x` is the finger position across the keyboard, from 0 to 1000.
  - `y` is the position down the key area, from 0 (top of the first key row) to 1000 (bottom of the space row). The iPhone globe/mic strip gives values above 1000.
- `submit`: ms after the word appeared when Submit was tapped.
- No participant or device information is stored.

Metrics shown in the app are computed from this data, not stored:
- **Typed text**: rebuilt by replaying the keys, with backspaces applied.
- **Accuracy**: `1 − Levenshtein / max(len)`.
- **Time to first key**: from the word appearing to the first tap.
- **WPM**: `(len−1)/seconds × 60/5`, measured from the first to the last key.
- **Keystrokes and backspaces**.

## Editing
- Word pool: the `WORDS` array at the top of the script (20 common texting words, 4–9 letters).
- Keyboard geometry: `SKINS` (key sizes and positions) and the `.kb[data-skin=…]` CSS (colours).
