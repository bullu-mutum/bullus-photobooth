# Bullu's Photobooth

A photo booth that runs entirely in the browser. Take four photos with your webcam, pick a border, add a film look, and download your photo strip. Nothing is uploaded and there's no account to make.

**Try it live:** [bullurajmutum.me/photobooth](https://bullurajmutum.me/photobooth)

## What it does

- **Captures four photos** from your webcam with a countdown, then lays them out as a classic photo strip.
- **Patterned borders** to frame the strip (cherry stripes, daisies, lemons and more).
- **Film looks:** Kodak Gold 200, Fujifilm C200 and B&W Tri-X, with film grain, previewed live.
- **Downloads the strip** as an image. Everything happens on your device.

## How it works

| File | What it is |
|---|---|
| `film-simulation.js` | The film engine. A small WebGL renderer with a fragment shader that applies each film's tone curve, colour shift and grain to the live camera feed. |
| `assets/glsl_film_grain.glsl` | The film grain shader. |
| `assets/generate_luts.py` | Python script that generates the colour lookup tables (LUTs) for each film look. |
| `assets/*.png` (film names) | The generated LUTs. See `assets/ATTRIBUTION.md` for the Kodak Gold 200 source and licence. |
| `assets/index-*.js`, `assets/index-*.css` | The app's interface: a React app, included here as the production build. |

This repo contains the deployed build. The film engine, shader and LUT script are readable source; the React interface is the compiled bundle.

## Built with

Designed and built solo by [Bulluraj Mutum](https://bullurajmutum.me), using AI coding tools (Claude and Google Antigravity).

## Run it locally

It's a static site, so any local server works:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The browser will ask for camera access.
