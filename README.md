# incepture.dev

Source for [incepture.dev](https://incepture.dev): a static editorial site with an interactive WebGL contour study and light/dark themes.

No build step and no dependencies. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

## Files

- `index.html`: semantic markup, editorial sections, and meta tags
- `styles.css`: layout, typography, and light/dark palettes (custom properties at the top)
- `main.js`: accessible light/dark theme toggle with persistence and subtle scroll reveals
- `shader.js`: interactive WebGL1 topographic contour field inside the hero plate (falls back to CSS gradients without WebGL and renders a still frame under `prefers-reduced-motion`)
- `fonts/`: Inter, self-hosted (SIL Open Font License)
- `og.jpg`: link preview image
- `vercel.json`: cache and security headers for Vercel

## Deploy

Hosted on Vercel as a static site: framework preset "Other", no build command, output directory left at the repo root.
