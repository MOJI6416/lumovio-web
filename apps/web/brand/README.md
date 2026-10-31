# Lumovio — Light

The owner approved the Light identity on 2026-10-22. Two separated pieces suggest a
projector's light opening into a screen.

The production symbol uses manually drawn geometry. `src/lib/brand.ts` is the shared
vector source for both React and the asset
generator. The wordmark uses Outfit Bold outlines; the font's SIL OFL is included here.
No webfont or external request is needed to display the logo.

Run `pnpm --filter @lumovio/web brand:build` with Node 24+ after changing the paths.
Generated outputs are committed so a normal application build needs no graphics tools.

Motion (2026-10-30): [Light motion kit and offline preview](motion/README.md) — launch intros, loading and
confirmation animations, and matching static posters. The site draws them inline (first-load intro, page and player
loader, confirmation tick). Regenerate the exports with `pnpm --filter @lumovio/web brand:motion`.

## Deliverables

- `public/brand/logo-dark.svg` / `.png`: lime symbol and off-white lettering, transparent.
- `public/brand/logo-light.svg` / `.png`: ink symbol and lettering, transparent.
- `public/brand/logo-black.svg`, `logo-white.svg` / `.png`: one-colour lockups.
- `public/brand/mark.svg`, `mark-black.svg`, `mark-white.svg` / `.png`: standalone symbols.
- `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`: opaque PWA icons.
- `src/app/favicon.ico`, `icon.svg`, `apple-icon.png`: Next.js metadata icons.
- `public/brand/og.png`: 1200 × 630 default sharing image.
- `identity-sheet.svg` / `.png`: review sheet with light/dark, mono and size samples.

Provider upload exports are in `public/brand/providers/`: `google-120.png`,
`discord-512.png`, `apple-1024.png`. These are separate RGB PNG exports of the approved
symbol on an opaque ink square, without a wordmark or pre-rounded corners. They were
exported separately from the shared vector master; `brand:build` regenerates the base
assets above.

## Usage

Primary colours: lime `#DCFA63`, ink `#0B0C10`, off-white `#F5F6F8`.
Use the ink or black version on light backgrounds; lime alone has insufficient contrast
against white. Use the lime/white lockup on dark backgrounds and artwork with enough contrast.
Allow at least one-quarter of the symbol's height as clear space. Keep the standalone
symbol at least 16 px high and the complete lockup at least 112 px wide.

The 16 px favicon uses a wider gap to keep the pieces separate. The maskable icon places
the whole symbol inside the central safe circle. Mobile home-screen masking and physical
TV/device appearance still need hardware checks.

Lumovio's name and logo are brand assets and are excluded from the frontend's Apache-2.0
licence, as stated in the frontend README.
