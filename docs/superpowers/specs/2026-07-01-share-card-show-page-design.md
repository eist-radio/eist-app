# Share card for the show detail page — design

## Summary

Add a share action to the show detail page (`app/show/[slug].tsx`, reached from
the Schedule) that generates a purpose-built **Instagram Story** image (1080×1920)
and opens the system share sheet. The image is a composed card — the show artwork
as a hero, and a bottom band carrying the show title, artist name, and date · time
— laid out on golden-ratio proportions in the éist palette.

This replaces an earlier, removed feature that screenshotted the visible on-screen
content. The new version renders an off-screen card built specifically for sharing,
independent of the live UI.

## Goals

- One-tap share from the show detail page producing a 1080×1920 (9:16) PNG.
- Card composition driven by the golden ratio (φ ≈ 1.618).
- éist palette only; green (`#AFFC41`) is the single accent.
- Always branded, even when a show has no artwork.

## Non-goals

- No share on any other screen (schedule list, listen, archive, artists).
- No web support (view-shot / sharing are native-only; button hidden on web).
- No custom caption/text entry, no multi-format export, no story stickers.

## Canvas & layout (golden ratio)

Canvas: **1080 × 1920**, base background éist purple `#4733FF`.

The horizontal φ split is the spine of the layout:

- **Hero** — top `round(1920 / φ)` = **1187px** (61.8%), full-width `1080×1187`.
  Show artwork rendered `cover`. Source priority: `artistImageUrl` (RadioCult
  1024² artist logo) → `eist_online.png` fallback.
- **φ hairline** — a `1080 × 4px` green (`#AFFC41`) rule sitting exactly on the
  seam at y=1187. This is the one signature accent.
- **Text band** — bottom **733px** (38.2%), purple, `72px` left/right padding.

Text band content, top-aligned from the hairline, on a φ/Fibonacci rhythm:

| Element    | Value source                    | Size (card px) | Colour             | Font              |
|------------|---------------------------------|----------------|--------------------|-------------------|
| Show title | `event.title`                   | 104 (=40×φ²)   | green `#AFFC41`    | `headingBold` 700 |
| Artist     | `hosts[0]?.name`                | 64 (=40×φ)     | text `#E7E5E5`     | `body` 500        |
| Date·time  | `` `${dateString} · ${timeString}` `` | 40       | textDim (55% text) | `body` 500        |

- Title: `lineHeight` ~108, `letterSpacing` -1.5, up to **3 lines**,
  `adjustsFontSizeToFit` with `minimumFontScale` 0.6.
- Vertical gaps: title→artist ~34, artist→date ~21 (Fibonacci, scaled).
- **Wordmark**: `assets/images/eist-logo-header.png` (green), pinned bottom-right
  of the band (~72px from right, ~64px from bottom), width ~200 aspect-preserved.

`dateString` / `timeString` already exist on the page (`formatShowDate`,
`formatShowTime`), so the card consumes formatted strings — no new date logic.

## Components & data flow

- **`components/share/ShareCard.tsx`** — pure presentational card.
  - `React.forwardRef<View>` so the parent can capture its root.
  - Props: `{ title: string; artistName?: string; dateTime: string;
    artworkSource: ImageSource; onHeroLoad?: () => void }`.
  - Renders the 1080×1920 composition described above. No data fetching, no
    sharing logic. Fully determined by props → testable/inspectable in isolation.

- **`hooks/useShareShow.ts`** — capture + share orchestration.
  - Signature: `useShareShow(cardRef) => { share: () => Promise<void>; isSharing: boolean }`.
  - `share()`:
    1. Haptic (light).
    2. Ensure hero is ready — `Image.prefetch(artworkUrl)` for remote art (local
       fallback is always ready); guarded so a prefetch failure still proceeds
       (the card falls back to `eist_online.png`).
    3. `captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile',
       width: 1080, height: 1920 })` → forces a crisp 1080×1920 export regardless
       of device pixel ratio.
    4. `Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png',
       dialogTitle: 'Share' })`.
  - `isSharing` drives the button's disabled/spinner state.
  - All wrapped in try/catch → `Alert` on failure; `Sharing.isAvailableAsync()`
    guard with an Alert when unavailable.

- **`app/show/[slug].tsx`** — integration.
  - Mounts `ShareCard` once, off-screen, as an absolutely-positioned sibling at
    the screen root: `{ position: 'absolute', top: -20000, left: 0 }` (laid out
    for capture, never visible, not in a clipping/`overflow:hidden` container).
  - Adds a **share icon** (Ionicons `share-outline`, green, ~26) right-aligned on
    the existing "coming up" eyebrow row — below the fixed spinning logo, so no
    other content shifts.
  - `Platform.OS === 'web'` → button not rendered.

## Error handling & edge cases

- **No artwork / still loading**: card uses `eist_online.png`, so it always
  renders branded. Share waits for `firstHostPending` to resolve before enabling
  (button disabled until the show data is present).
- **Prefetch failure**: proceed to capture anyway (fallback image path).
- **Capture/share failure**: caught, logged, user sees an `Alert` ("Couldn't
  create the share image. Please try again."). Nothing crashes the page.
- **Sharing unavailable**: `Alert` explaining sharing isn't available.
- **Long titles**: 3-line clamp + shrink-to-fit keeps the band from overflowing
  into the wordmark.

## Testing

- `ShareCard` is presentational and deterministic from props — verify it renders
  the three text fields and honours the artwork/fallback source. (RN render test.)
- `useShareShow` — unit test the orchestration with `captureRef` / `Sharing`
  mocked: happy path calls capture then share; capture rejection surfaces an
  Alert and does not call share; unavailable sharing short-circuits.
- Manual device verification (the real proof): tap share on a show with artwork
  and one without; confirm the exported PNG is 1080×1920, the φ hairline lands on
  the seam, and title/artist/date·time + wordmark are correct.

## Palette reference

- Purple bg `#4733FF` · Green accent `#AFFC41` · Text `#E7E5E5` · TextDim
  `rgba(231,229,229,0.55)` — all from `theme/tokens.ts`.
