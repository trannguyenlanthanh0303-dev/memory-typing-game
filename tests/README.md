# Tests (headless Chrome)

Uses the installed Google Chrome through `playwright-core`, emulating an iPhone 13, a Pixel 7 and a Galaxy S9+.

```sh
# terminal 1, repo root: serve the app
python3 -m http.server 8765
# terminal 2
cd tests && npm install && npm run e2e && npm run hardening
```

- `e2e.js` runs a full two-pass session on each keyboard skin:
  - checks words, labels, typed text and blocked touches (a second finger in pass 2);
  - checks the number part of each pass on the number pad: digits, the 2 visible labels, a ⌫ fix, a wrong digit, a blocked touch, and taps on the inert Go/blank key;
  - checks the replay link rebuilds the recording exactly, and the replay itself;
  - checks that a v1 recording still loads, and that `?d=0` skips numbers.
  - Screenshots go to `tests/out/`.
- `hardening.js` covers the review findings: empty recordings, `kb=constructor`, a decompression-bomb link, a browser without DecompressionStream, keyboard cleanup and `align()`.
  - It also covers number trials: a v2 recording (no numbers) loads, junk `seq`/`vis` is cleaned, and replay number pads are cleaned up.
  - Its sample recordings mostly use the v1 format, which the app upgrades to v3 when loading.
