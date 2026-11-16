# incepture.dev

Source for [incepture.dev](https://incepture.dev): a single static page with a WebGL shader background.

No build step and no dependencies. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

## Files

- `index.html`: markup and meta tags
- `styles.css`: layout, type and the color palette (custom properties at the top)
- `shader.js`: the background shader (WebGL1). Falls back to a CSS gradient without WebGL and renders a single still frame under `prefers-reduced-motion`
- `fonts/`: Inter, self-hosted (SIL Open Font License)
- `og.jpg`: link preview image
- `vercel.json`: cache and security headers for Vercel

## Deploy

Hosted on Vercel as a static site: framework preset "Other", no build command, output directory left at the repo root.
