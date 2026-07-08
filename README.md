# Tally — Mental Math Drills

Static, no-build, no-backend PWA. Four operations, 0–1000 operands, 30/60/300s timers.

## Deploy to GitHub Pages (~5 min)

1. Create a new repo on GitHub (e.g. `tally` or `mental-math`).
2. Add these files to the repo root and push:
   ```
   git init
   git add .
   git commit -m "Tally: mental math drills"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source** → select branch `main`, folder `/ (root)` → Save.
4. Wait ~1 minute, then visit `https://<you>.github.io/<repo>/`.
5. Open that URL in Safari on your iPhone → Share → **Add to Home Screen**.
   It'll launch full-screen with its own icon, no browser chrome, and works offline
   after the first load.

## Local testing before you push

Any static server works, e.g.:
```
python3 -m http.server 8000
```
then open `http://localhost:8000`. (Opening `index.html` directly via `file://`
also runs the app, but Safari won't offer "Add to Home Screen" for `file://` pages —
you need it served over `http://` or `https://` for that.)

## Files

- `index.html` / `style.css` / `app.js` — the whole app, vanilla JS, no build step
- `manifest.json` / `sw.js` — PWA install + offline support
- `icons/` — home screen icons (regenerate these if you want your own mark)

## Notes on the math

- `+` / `-`: both operands 0–1000, subtraction keeps results non-negative.
- `×`: one operand is capped at 0–12 so it's actually mentally computable — a full
  0–1000 × 0–1000 range would make every problem a written-multiplication task.
- `÷`: built from the answer up (divisor × quotient) so every division comes out
  to a clean integer, no rounding decisions needed.

Tweak the ranges in `generateProblem()` in `app.js` if you want it harder or softer.
