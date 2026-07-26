# varunhiremath.github.io

Personal website for Varun Hiremath — aerospace engineer & software developer
(CFD · combustion simulation · HPC). Built as a **dependency-free static site**:
plain HTML, CSS, and vanilla JavaScript. No framework, no build step.

## Structure

```
index.html        # the page (single-page, anchored sections)
css/style.css     # all styles; light/dark themes via CSS custom properties
js/main.js        # theme toggle, scroll reveals, and the animated hero canvas
docs/             # CV (VarunHiremath.pdf)
img/              # image assets
.nojekyll         # serve as pure static files (skip Jekyll processing)
```

The hero is an animated `<canvas>`: a turbofan cutaway with a burning annular
combustor, injected fuel molecules, bypass/core CFD streamlines, and a GPU card
running the simulation. The static engine is pre-rendered to an offscreen canvas
for performance; only the flow/flame/beams animate. All motion is disabled under
`prefers-reduced-motion`.

## Editing

Everything is hand-editable — open the files in any editor. Common tweaks:

- **Text / sections** — edit `index.html`.
- **Colors / theme** — the `--*` custom properties at the top of `css/style.css`
  (light and dark are defined together; the toggle flips `data-theme`).
- **Hero animation** — `js/main.js` (radius profiles in the `P` object shape the
  engine; particle counts and colors are near the top).

## Local preview

```
python3 -m http.server
# open http://localhost:8000
```

## Deployment

Served by **GitHub Pages** from this repository. Pushing to the Pages-configured
branch publishes to <https://varunhiremath.github.io>. To use the custom domain
`varunhiremath.com`, add a `CNAME` file containing `varunhiremath.com` and point
the domain's DNS at GitHub Pages.

## To do / placeholders

- GitHub profile link (`#ghLink`) — add a handle when ready.
- Optional profile photo in `img/`.
