# Light motion

Motion assets based on Lumovio's approved projector/screen identity. The original mark, the beam and tick paths and the
Outfit outlines come from [`src/lib/brand.ts`](../../src/lib/brand.ts); there is no alternative logo or external font
dependency.

**On the site (2026-10-30):** the same vectors drawn inline by
[`components/ui/BrandMotion.tsx`](../../src/components/ui/BrandMotion.tsx), animated by this folder's `motion.css`
(imported by `globals.css`) in the theme's colours: the first-load intro
([`shell/BootBoundary.tsx`](../../src/components/shell/BootBoundary.tsx)), the loader of link navigations
([`shell/NavigationLoading.tsx`](../../src/components/shell/NavigationLoading.tsx)) and of the player, and the tick of
success toasts, "Saved", the watched mark and TV linking. Where and why: design system §6.3.1 «Как сделано».
The exported files below also serve other surfaces. Android TV now has native launch resources and a static handoff
until WebView paints; Apple PWA startup PNGs are linked through server metadata. The offline page embeds the projector
extinguishing once. The three action responses are drawn on the site by `ActionMark` (ui/BrandMotion): the heart in
the "Added to Favourites" toast, the rating button's star and the starter row's thumb, each after the server's yes.

Open [`preview.html`](preview.html) locally. Choose an asset, replay/pause it, switch between dark/light themes,
Russian/English, or turn on reduced motion. The preview needs no server, account, network, or sound.

## Assets

| File in `public/brand/motion/` | Duration | Purpose |
|---|---|---|
| `intro.svg` | 2400 ms, once | Projector lights up, screen opens, wordmark is revealed. Ends on the original horizontal logo. |
| `intro-compact.svg` | 900 ms, once | Symbol-only opening for a quicker launch. |
| `loader.svg` | 1600 ms, loop | Gentle light exchange between the two existing symbol parts. Dark backgrounds. |
| `loader-light.svg` | 1600 ms, loop | The same loop in approved ink for light backgrounds. |
| `saved.svg` / `saved-light.svg` | 320 ms, once | Success-coloured checkmark for a completed action. |
| `favourite.svg` / `favourite-light.svg` | 280 ms, once | Existing Heart outline settles into its selected state. |
| `like.svg` / `like-light.svg` | 240 ms, once | Existing ThumbsUp outline; distinct from favourites. |
| `rating.svg` / `rating-light.svg` | 320 ms, once | Existing Star outline after a rating was confirmed. |
| `offline.svg` / `offline-light.svg` | 320 ms, once | Projector light fades out; the neutral final silhouette remains. |

Each animation also has a matching `-still.svg` poster with exactly the same viewBox and dimensions.
All SVGs are transparent, self-contained, and have intrinsic dimensions. Intro backgrounds must be the dark stage
`#0b0c10` in both themes. Keep the full logo at least 112 px wide, and loaders at 32/48/64 px (64+ on TV).
Inline SVGs and standalone SVG documents immediately show the final logo, symbol, or checkmark with reduced motion.
For SVGs inside `<img>`, use `<picture>` below: Chromium does not reliably propagate the motion preference into
an image document. With CSS animations unsupported or disabled, the final image remains visible. No JavaScript is
needed to animate an exported SVG.

```html
<!-- Provide the translated accessible status outside the decorative image. -->
<span role="status" aria-label="Loading">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="/brand/motion/loader-still.svg" />
    <img src="/brand/motion/loader.svg" width="48" height="48" alt="" />
  </picture>
</span>
```

Use the light loader in the light theme. Restart a one-shot exported SVG by remounting the image; for precise
pause/completion control, inline the SVG and use its CSS animations rather than treating an image `load` event as
animation completion. The preview uses inline vectors and `animationend`.

An intro should finish early if the app is ready; do not impose a minimum wait or play it on ordinary navigation.
Keep catalog skeletons, actual progress, cancel/retry actions, and error/offline states. Show a success animation
only after the server confirms the action, with the usual translated feedback and undo.

## Editing and regeneration

Edit `motion.css` or `preview.fragment.html`, then run from the repository root:

```sh
pnpm --filter @lumovio/web brand:motion
```

The builder writes fourteen animations, fourteen static posters and `preview.html`, always reusing the vector master. It
also generates the launch exports and embeds only the offline CSS/SVG subset in the service worker. The optional
`--inline-out <absolute-html-path>` writes a self-contained review fragment for the chat. Generated assets contain
no machine-specific paths. UI review typography uses Manrope when available and the local system fallback offline;
the logo always uses the original outlines. Preview labels are ru/en, separate from production translations.

## Further animation directions

- **Playback handoff:** a 200–320 ms fade from the source screen to the first decoded frame. No repeated brand intro
  before episodes; buffering keeps real preparation steps and cancel/retry controls.
- **Profile choice:** a 200 ms focus/selection response using the existing avatar and focus tokens, no new character art.
- **Adding to a list:** the checkmark above after confirmation, followed by the existing toast and undo.
- **Catalog arrival:** existing skeletons fade into loaded artwork over 200 ms, with no card stagger or layout shifts.

The title-action assets are decorative responses, not controls or state machines. Mount/restart them only after the
server confirms the final state. Undo, removing a favourite, rejecting a rating and request failures use existing
feedback; do not celebrate them with a positive response. Keep a translated accessible name on the actual button.
Lucide outlines are the exact existing 1.61.0 paths, centralised in `brand.ts`; licence: `NOTICE-LUCIDE.txt`.
The rating ends on a fully filled star, matching the existing selected rating icon. Inline integrations can override
`--lm-action-fill-opacity` if a target control uses a different selected fill; the symbol paths never change.

## Platform launch screens

- **Android TV:** generated resources in `apps/tv-android/app/src/main/res`: `drawable/lumovio_splash.xml` (AVD),
  `lumovio_splash_mark.xml` (shared paths), four XML animators, and `lumovio_splash_still.png` in five density folders.
  API 31+ themes choose the 900 ms AVD, API 33+ prefers the icon. Older versions use the PNG-backed window. A static
  ImageView continues the same final frame until `onPageCommitVisible` (API 22: `onPageFinished`) or a network error.
  No artificial minimum, extra Activity, WebView network request, animation library or font. Android reduced animation
  settings are handled by the platform. Build: `apps/tv-android/gradlew.bat :app:assembleDebug` with JDK 17+ and SDK 34.
  [Android splash dimensions and AVD guidance](https://developer.android.com/develop/ui/views/launch/splash-screen).
  The standalone public web export writes Android handoff files to `brand/motion/android/res` instead of creating
  folders outside its checkout.
- **iPhone/iPad:** 46 opaque PNGs in `public/brand/motion/apple/`, covering 23 screen/DPR combinations in both
  orientations. See `apple-devices.json` for the source matrix and `apple/catalog.json` for the generated catalogue.
  Every image uses the original outlined logo, a fixed ink background, and centred clear space. Generated
  `src/lib/brand-startup.gen.ts` is used only in server `appleWebApp.startupImage` metadata; the equivalent copyable
  link tags are `apple-startup-links.html`. No client JavaScript or network font.
  [Apple launch-image guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
- **Offline:** the service worker's existing localised error, focused Retry, online recovery and 15 s connectivity
  probe stay in place. Its icon is now the projector, 24 px inside the existing 48 px neutral circle. The beam fades
  once; the icon settles to the theme's `--text-2`, never green/success. All geometry and CSS are embedded locally.

Native and iOS tabs in the preview show the asset layout, not a captured or simulated operating-system startup.
Actual system animation, cold-start timing and iOS install/cache behaviour still require device checks. Design rules:
`docs/design/design-system.md` §6.3.1; browser audit: `node scripts/ui-audit/motion.mjs` and
`node scripts/ui-audit/motion-launch.mjs`.
