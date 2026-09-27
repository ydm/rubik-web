# Кубът на Рубик

A Bulgarian web app for the Rubik's cube: paint your own cube and get the moves
that solve it (**Нареди**), play a daily scramble (**Мисия**), and set your
cube's face colours (**Инструкции → Настройки**).

Built with Next.js 16, React 19 and three.js. The solver is a Rust library
compiled to WebAssembly (`public/solver/`), run in a web worker
(`public/solver-worker.js`).

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest
pnpm lint
```

## Production: GitHub Pages

The site is a static export (`output: "export"`): `pnpm build` writes plain
files to `out/`, and `pnpm start` serves them at http://localhost:3000 (or the
next free port, which it prints).

`.github/workflows/pages.yml` builds, lints, tests and publishes it on every
push to `master`. One-time setup: repository **Settings → Pages → Source:
GitHub Actions**. The workflow sets two variables from the Pages settings:

- `BASE_PATH` — the sub-path the site lives under: `/<repository>` for
  `https://<user>.github.io/<repository>/`, empty on a custom domain. Every URL
  the app builds is prefixed with it.
- `SITE_URL` — the site's full address, for share previews, the canonical link,
  `robots.txt` and `sitemap.xml`.

To try a sub-path build locally:

```bash
BASE_PATH=/rubikweb SITE_URL=http://localhost:3000/rubikweb pnpm build
mkdir -p /tmp/site && ln -sfn "$PWD/out" /tmp/site/rubikweb
python3 -m http.server 3000 -d /tmp/site     # http://localhost:3000/rubikweb/
```

GitHub Pages can't send custom HTTP headers, so the site has none of its own.

## Icons and share image

The favicon, app icons and share image are generated from one drawing
(`scripts/cube-icon.py`):

```bash
scripts/generate-icons.sh   # needs python3, rsvg-convert, ImageMagick, Geist font
```

It writes `src/app/{icon.ico,icon.svg,apple-icon.png,opengraph-image.png}`
and `public/icons/*.png`. Next.js adds the matching `<head>` tags.

## Solver

`public/solver/` is the output of `wasm-pack build --target web` — replace the
folder to update the solver, and keep anything hand-written outside it. Its API
and status codes are in `public/solver/API.md`.

## License

[MIT](LICENSE) © 2026 Yordan Miladinov

Third-party parts keep their own licenses: the Geist fonts (SIL Open Font
License) and the npm dependencies, three.js among them (MIT).
