# éist Swipe Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bottom-tab navigation with a full-screen horizontal swipe pager and reskin every screen + detail page to the approved minimal two-colour aesthetic (purple field, green primary, lilac detail text, Nimbus/Funnel type, no lines/boxes), with the real spinning Three.js éist logo top-right on every page — keeping all existing audio/cast/notification/data logic intact.

**Architecture:** A single host screen (`app/index.tsx`) renders a horizontal paging `ScrollView` with five full-width pages that all stay mounted (no virtualization, so per-page state survives swiping). The five pages are extracted from the current `(tabs)/*.tsx` files into plain components under `components/screens/`, keeping their data hooks/effects and replacing only presentation. A single shared spinning-logo WebView is overlaid on the pager (one WebGL context). Detail routes (`artist/[slug]`, `show/[slug]`, `archive/[slug]`) move out of the deleted `(tabs)` group to `app/` (URLs unchanged), are pushed on top of the pager via the existing root `Stack`, and each renders its own logo + a back-triangle.

**Tech Stack:** React Native 0.79 / Expo 53, expo-router 5 (Stack), react-native-track-player, react-native-google-cast, react-native-webview (already a dependency — hosts the logo), react-native-svg (already present — icons), expo-font, react-native-safe-area-context. No new native dependencies (paging uses core `ScrollView`).

## Global Constraints

- **Two colours only.** Background is purple `#4733FF` on every page. Green `#AFFC41` is every primary element: headings, names, accents, the play disc, the active pill, the spinning logo. Light-purple/lilac `#B9B0FF` is the only secondary tone — used for *small detail text* (eyebrows, genre/meta, times, sub-labels, dates, bios, footers) and the disconnected cast icon. **No white, no cream, no ink/black text, no other colours.**
- **Fonts:** headings use bundled **Nimbus Sans** (URW Helvetica clone) — family names `NimbusSans` (regular) and `NimbusSansBold`. Eyebrows/body/labels/detail use the already-bundled **FunnelSans**. No serif, no monospace, no other families.
- **Brand word:** the word **éist** is ALWAYS lowercase `é`, including inside `textTransform: 'uppercase'` contexts — never let RN uppercase it. Wrap the literal word in a `<Text>` with `textTransform: 'none'` inside any uppercased label.
- **Spinning logo:** the real Three.js extruded **translucent green** éist logo spins top-right on **every** page (swipe pages + detail pages). On the 5 swipe pages it is ONE shared WebView overlaid on the pager (single WebGL context); each detail page renders its own. It replaces any overflow/`⋯` menu — there is no `⋯` menu.
- **No lines / no boxes:** separation is space + colour only. No dividers, no borders, no rounded containers. The only permitted shapes: the play disc (circle), the notify disc (circle), the green play/back triangles, the green tuning-tick on Listen, the pills.
- **No bottom tab bar.** Horizontal swipe is the only primary navigation. Pills (top-left) are the page indicator. Detail pages replace the pills with a chunky green left-pointing **back-triangle** (top-left) that pops the route.
- **Drop:** the big pull-quote, and all show-length/duration text.
- **Cast:** the Chromecast button sits on the Listen page directly **under the ON AIR indicator** (top-left), mobile only. Lilac when disconnected, green when connected/casting.
- **Notify:** the per-show reminder control lives on the **show detail page** only (a "Notify me / for this show" disc), NOT on schedule rows. The per-artist subscribe control ("Notify me / for next show") lives on the artist detail page. Schedule rows stay clean (time · title · artist, nothing on the right).
- **Palette is already in `themes.ts`** (`EIST_GREEN = '#AFFC41'`, `EIST_PURPLE = '#4733FF'`) — no theme-file change needed. Lilac lives only in `theme/tokens.ts`.
- **No automated tests exist.** Each task's verification = `npx tsc --noEmit` clean + `npm run lint` clean + visual check of the running app against the matching phone in `docs/superpowers/redesign/mockups.png`.

---

## File Structure

**Create:**
- `theme/tokens.ts` — colours, font names, type scale, spacing.
- `assets/eistLogoHtml.ts` — the transparent, parameterised Three.js logo page as an exported HTML string (source for the WebView). Generated from `docs/superpowers/redesign/eist-logo-embed.html`.
- `components/ui/Eyebrow.tsx` — uppercase Funnel detail label (éist-safe), lilac by default.
- `components/ui/Pills.tsx` — page-indicator pill row.
- `components/ui/BackTriangle.tsx` — chunky green left-triangle that calls `router.back()`.
- `components/ui/SpinningLogo.tsx` — transparent WebView rendering the éist logo.
- `components/ui/NotifyControl.tsx` — green bell disc + two-line label (shared by artist + show pages).
- `components/ui/PageScaffold.tsx` — per-page wrapper: purple bg, safe area, top row (left slot + right slot), padded content.
- `components/Pager.tsx` — horizontal paging ScrollView hosting the 5 pages + the single logo overlay; tracks active index.
- `components/screens/ListenScreen.tsx` — from `(tabs)/listen.tsx`.
- `components/screens/ScheduleScreen.tsx` — from `(tabs)/schedule.tsx`.
- `components/screens/ArtistsScreen.tsx` — from `(tabs)/artists.tsx`.
- `components/screens/ArchiveScreen.tsx` — from `(tabs)/archive.tsx`.
- `components/screens/ConnectScreen.tsx` — merges `(tabs)/social.tsx` + `support.tsx` links.
- `assets/fonts/NimbusSans-Regular.otf`, `assets/fonts/NimbusSans-Bold.otf`.

**Modify:**
- `app/_layout.tsx` — load Nimbus fonts (providers unchanged).
- `app/index.tsx` — render `<Pager/>` instead of redirecting.
- The three detail screens (after they are moved) — reskin presentation, keep data layer.

**Move (same URL, out of deleted `(tabs)` group):**
- `app/(tabs)/artist/[slug].tsx` → `app/artist/[slug].tsx`
- `app/(tabs)/show/[slug].tsx` → `app/show/[slug].tsx`
- `app/(tabs)/archive/[slug].tsx` → `app/archive/[slug].tsx`

**Delete after extraction:** the whole `app/(tabs)/` directory (layout + 5 main screens + the unused `discord/instagram/soundcloud/mixcloud` route screens, whose links now live in ConnectScreen).

**Visual reference:** `docs/superpowers/redesign/mockups.png` — 8 phones in this order: Listen, Schedule, Artists, Archive, Connect, Artist-detail, Listen-back-detail, Show-upcoming-detail. The live HTML is `docs/superpowers/redesign/mockups.html` (+ `eist-logo-embed.html`, `show-bg.png`).

---

## Phase 0 — Foundation

### Task 1: Design tokens

**Files:** Create `theme/tokens.ts`

**Interfaces:** Produces `colors {purple,green,lilac}`, `font {heading,headingBold,body}`, `PAGE_COUNT`, `space`, and `type` (shared text style fragments).

- [ ] **Step 1: Write the module**

```ts
// theme/tokens.ts
import { TextStyle } from 'react-native';

export const colors = {
  purple: '#4733FF',
  green: '#AFFC41',
  lilac: '#B9B0FF',
  pillDim: 'rgba(175,252,65,0.28)',
} as const;

export const font = {
  heading: 'NimbusSans',
  headingBold: 'NimbusSansBold',
  body: 'FunnelSans',
} as const;

export const PAGE_COUNT = 5;
export const space = { screenX: 30, topGap: 6 } as const;

// shared text fragments (colour applied at call site)
export const type = {
  eyebrow: { fontFamily: font.body, fontWeight: '600', fontSize: 13, letterSpacing: 2.6, textTransform: 'uppercase' } as TextStyle,
  pagehead: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 44, lineHeight: 44, letterSpacing: -0.8 } as TextStyle,
  rowTitle: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 22, lineHeight: 24, letterSpacing: -0.2 } as TextStyle,
  rowSub: { fontFamily: font.body, fontWeight: '500', fontSize: 13 } as TextStyle,
  meta: { fontFamily: font.body, fontWeight: '500', fontSize: 12.5, letterSpacing: 1.25, textTransform: 'uppercase' } as TextStyle,
  bio: { fontFamily: font.body, fontWeight: '400', fontSize: 14.5, lineHeight: 22 } as TextStyle,
};
```

- [ ] **Step 2:** Run `npx tsc --noEmit` → PASS.
- [ ] **Step 3:** Commit `feat: redesign design tokens`.

---

### Task 2: Bundle Nimbus Sans heading font

**Files:** Create `assets/fonts/NimbusSans-Regular.otf`, `assets/fonts/NimbusSans-Bold.otf`; Modify `app/_layout.tsx`

- [ ] **Step 1: Copy the OTFs**

```bash
cp /usr/share/fonts/urw-base35/NimbusSans-Regular.otf assets/fonts/NimbusSans-Regular.otf
cp /usr/share/fonts/urw-base35/NimbusSans-Bold.otf assets/fonts/NimbusSans-Bold.otf
ls -la assets/fonts/NimbusSans-*.otf
```
(URW Base35 fonts are AGPL/font-exception licensed — redistributable in apps.)

- [ ] **Step 2: Register in `app/_layout.tsx`** — replace the `useFonts` call:

```tsx
  const [fontsLoaded] = useFonts({
    FunnelSans: require('../assets/fonts/FunnelSans-VariableFont_wght.ttf'),
    NimbusSans: require('../assets/fonts/NimbusSans-Regular.otf'),
    NimbusSansBold: require('../assets/fonts/NimbusSans-Bold.otf'),
    ...Ionicons.font,
  });
```

- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 4:** Run the app; confirm no "fontFamily NimbusSans is not a system font" warning.
- [ ] **Step 5:** Commit `feat: bundle Nimbus Sans heading font`.

---

### Task 3: Verify theme palette (no change expected)

**Files:** Inspect `themes.ts`, `app/_layout.tsx`

- [ ] **Step 1:** Run `grep -nE "AFFC41|4733FF" themes.ts app/_layout.tsx`. Expect `themes.ts` defines both brand constants and the splash background is `#4733FF`. If a prior edit changed them, restore. No commit if unchanged.

---

## Phase 1 — Shared primitives

### Task 4: Eyebrow, Pills, BackTriangle

**Files:** Create `components/ui/Eyebrow.tsx`, `components/ui/Pills.tsx`, `components/ui/BackTriangle.tsx`

**Interfaces:**
- `Eyebrow({children, color?})` — uppercase Funnel label; default colour `colors.lilac`; renders `éist` literally if present.
- `Pills({active})` — row of `PAGE_COUNT` pills; active is a 22-wide green pill, others `colors.pillDim`.
- `BackTriangle()` — a chunky green left triangle in a `Pressable` that calls `router.back()`.

- [ ] **Step 1: Eyebrow**

```tsx
// components/ui/Eyebrow.tsx
import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors, type as t } from '../../theme/tokens';

export function Eyebrow({ children, color = colors.lilac, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) {
  return <Text style={[styles.e, { color }, style]}>{children}</Text>;
}
const styles = StyleSheet.create({ e: t.eyebrow });
```

- [ ] **Step 2: Pills**

```tsx
// components/ui/Pills.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, PAGE_COUNT } from '../../theme/tokens';

export function Pills({ active }: { active: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: PAGE_COUNT }).map((_, i) => (
        <View key={i} style={[styles.pill, i === active ? styles.on : { backgroundColor: colors.pillDim }]} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pill: { width: 7, height: 7, borderRadius: 5 },
  on: { width: 22, backgroundColor: colors.green },
});
```

- [ ] **Step 3: BackTriangle** (green left triangle via borders)

```tsx
// components/ui/BackTriangle.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

export function BackTriangle() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={16} accessibilityRole="button" accessibilityLabel="Back">
      <View style={styles.tri} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  tri: {
    width: 0, height: 0,
    borderRightWidth: 15, borderRightColor: colors.green,
    borderTopWidth: 10, borderTopColor: 'transparent',
    borderBottomWidth: 10, borderBottomColor: 'transparent',
  },
});
```

- [ ] **Step 4:** `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 5:** Commit `feat: Eyebrow, Pills, BackTriangle primitives`.

---

### Task 5: SpinningLogo (Three.js logo in a transparent WebView)

**Files:** Create `assets/eistLogoHtml.ts`, `components/ui/SpinningLogo.tsx`

**Interfaces:** `SpinningLogo({ size? })` — a transparent, non-interactive WebView rendering the spinning green éist logo.

- [ ] **Step 1: Create the HTML string asset**

Copy the full contents of `docs/superpowers/redesign/eist-logo-embed.html` (the transparent, alpha-enabled, `?c=`-parameterised Three.js page) into a template-literal export. It already: enables `alpha: true`, sets `scene.background = null`, body `background: transparent`, reads `?c=` for colour (default `AFFC41`), and loads three.js r128 from cdnjs.

```ts
// assets/eistLogoHtml.ts
export const eistLogoHtml = `<!DOCTYPE html>
<html lang="en">
<head>...PASTE THE ENTIRE eist-logo-embed.html BODY VERBATIM...</head>
<body>...</body>
</html>`;
```

(The page needs network to fetch three.js r128 — acceptable for a streaming app that is always online. Offline-hardening by inlining three.js is a follow-up.)

- [ ] **Step 2: SpinningLogo component**

```tsx
// components/ui/SpinningLogo.tsx
import React from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { eistLogoHtml } from '../../assets/eistLogoHtml';

export function SpinningLogo({ size = 100 }: { size?: number }) {
  if (Platform.OS === 'web') return null; // web build: omit (or use an <iframe> later)
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <WebView
        source={{ html: eistLogoHtml, baseUrl: 'https://eist.radio/' }}
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        opaque={false}
        scrollEnabled={false}
        pointerEvents="none"
        androidLayerType="hardware"
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}
```

- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 4: Visual smoke test** — temporarily drop `<SpinningLogo/>` into `app/index.tsx`, run the app on a device/emulator, confirm the translucent green éist logo renders and spins with a transparent background. Remove the temp usage after.
- [ ] **Step 5:** Commit `feat: SpinningLogo WebView (three.js éist logo)`.

---

### Task 6: PageScaffold

**Files:** Create `components/ui/PageScaffold.tsx`

**Interfaces:** `PageScaffold({ children, left, right, transparentBg? })` — purple background (unless transparent), safe-area top row with a `left` slot and a `right` slot, padded content. Swipe pages pass `left={<Pills active={i}/>}` and no `right` (the Pager overlay draws the logo). Detail pages pass `left={<BackTriangle/>}` and `right={<SpinningLogo/>}`.

- [ ] **Step 1: Write it**

```tsx
// components/ui/PageScaffold.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../../theme/tokens';

export function PageScaffold({
  children, left, right, transparentBg = false,
}: { children: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; transparentBg?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, !transparentBg && { backgroundColor: colors.purple }]}>
      <View style={[styles.top, { top: insets.top + space.topGap }]} pointerEvents="box-none">
        <View>{left}</View>
        <View>{right}</View>
      </View>
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: space.screenX, right: space.screenX, zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { flex: 1, paddingHorizontal: space.screenX, paddingBottom: 40 },
});
```

- [ ] **Step 2:** `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 3:** Commit `feat: PageScaffold`.

---

## Phase 2 — Pager

### Task 7: Horizontal pager + logo overlay

**Files:** Create `components/Pager.tsx`; Modify `app/index.tsx`

**Interfaces:** `<Pager/>` — horizontal paging ScrollView; renders each page via `PageScaffold` with `Pills`; passes `pageIndex` + `isActive`; one absolutely-positioned `SpinningLogo` overlay top-right above the pages.

- [ ] **Step 1: Pager with placeholder pages**

```tsx
// components/Pager.tsx
import React, { useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAGE_COUNT, colors, space } from '../theme/tokens';
import { PageScaffold } from './ui/PageScaffold';
import { Pills } from './ui/Pills';
import { SpinningLogo } from './ui/SpinningLogo';

const { width } = Dimensions.get('window');

export function Pager() {
  const [active, setActive] = useState(0);
  const insets = useSafeAreaInsets();
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setActive(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={{ flex: 1, backgroundColor: colors.purple }}>
      <StatusBar barStyle="light-content" />
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd} removeClippedSubviews={false}>
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <View key={i} style={{ width }}>
            <PageScaffold left={<Pills active={i} />}>
              <Text style={{ color: colors.green }}>Page {i}</Text>
            </PageScaffold>
          </View>
        ))}
      </ScrollView>
      {/* single shared logo overlay, top-right, above all pages */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top - 30, right: space.screenX - 8 }}>
        <SpinningLogo size={100} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Host it** — replace `app/index.tsx` body with `export default function Index(){ return <Pager/>; }` (import from `../components/Pager`).
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 4: Visual** — five purple pages; swipe moves one page at a time; pills advance top-left; the spinning green logo sits top-right and stays put while pages move under it; no bottom bar.
- [ ] **Step 5:** Commit `feat: swipe pager with shared spinning-logo overlay`.

---

## Phase 3 — Move detail routes

### Task 8: Relocate `[slug]` routes

**Files:** Move the three `[slug]` files from `app/(tabs)/…` to `app/…` (URLs unchanged).

- [ ] **Step 1:**
```bash
mkdir -p app/artist app/show app/archive
git mv "app/(tabs)/artist/[slug].tsx" "app/artist/[slug].tsx"
git mv "app/(tabs)/show/[slug].tsx" "app/show/[slug].tsx"
git mv "app/(tabs)/archive/[slug].tsx" "app/archive/[slug].tsx"
```
- [ ] **Step 2:** Fix any now-broken relative imports in the three files so `npx tsc --noEmit` is clean (`@/…` alias imports need no change).
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 4:** Commit `refactor: move detail routes out of tabs group`.

---

## Phase 4 — Swipe-page migrations

> For each: open the current `app/(tabs)/<name>.tsx`, **keep every import/hook/state/effect that fetches or derives data**, replace only the returned JSX + StyleSheet with the spec below wrapped in `PageScaffold`. Each is `export default function XScreen({ pageIndex, isActive }: { pageIndex: number; isActive: boolean })`. Wire into `Pager.tsx` (replace the matching placeholder, pass `pageIndex={i} isActive={active === i}`).

### Task 9: ListenScreen (+ Cast under On Air)

**Files:** Create `components/screens/ListenScreen.tsx`; Modify `components/Pager.tsx` (index 0)

**Interfaces:** Consumes `useTrackPlayer()` → `{ isPlaying, togglePlayStop, updateMetadata, isCastConnected, castDeviceName }`; the existing `CastButton`; all data fns from old `listen.tsx`.

- [ ] **Step 1:** Copy the data layer from `listen.tsx` (state, `formatTime`, `parseDescription`, `preloadImage`, `getArtistDetails`, `clearNowPlayingState`, `clearNextShowInfo`, `fetchLiveScheduleOnly`, `fetchNowPlayingWithArtist`, car-refresh + AppState effects) **unchanged**. Keep `showTitle`, `artistName`, `artistId`, `currentShowId`, `broadcastStatus`, `remoteImageUrl`, `imageFailed`.
- [ ] **Step 2:** Replace the `useFocusEffect` polling block with an `isActive` effect:

```tsx
useEffect(() => {
  if (!isActive) return;
  fetchNowPlayingWithArtist();
  if (isPlaying) { const id = setInterval(fetchLiveScheduleOnly, 60000); return () => clearInterval(id); }
}, [isActive, fetchNowPlayingWithArtist, fetchLiveScheduleOnly, isPlaying]);
```

- [ ] **Step 3:** Render (show artwork behind a purple wash + bottom scrim; cast under ON AIR; tick, title, artist, meta; play disc):

```tsx
return (
  <PageScaffold left={<Pills active={pageIndex} />} transparentBg>
    <Image source={broadcastStatus === 'schedule' && remoteImageUrl && !imageFailed ? { uri: remoteImageUrl } : placeholderOfflineImage}
      style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setImageFailed(true)} />
    <LinearGradient colors={['rgba(71,51,255,0.62)', 'rgba(71,51,255,0.62)']} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={['rgba(10,4,30,0.45)','rgba(10,4,30,0)','rgba(10,4,30,0)','rgba(10,4,30,0.72)']}
      locations={[0,0.3,0.55,1]} style={StyleSheet.absoluteFill} />

    <View style={s.onair}><View style={s.dot} /><Eyebrow color={colors.green}>On Air</Eyebrow></View>
    <View style={s.castRow}>
      <CastButton style={{ width: 26, height: 26 }} tintColor={isCastConnected ? colors.green : colors.lilac} />
    </View>

    <View style={{ flex: 1 }} />
    <View style={s.tick} />
    <Pressable onPress={() => currentShowId && router.push(`/show/${currentShowId}`)} disabled={!currentShowId}>
      <Text style={s.title} numberOfLines={3}>{broadcastStatus === 'schedule' && showTitle ? showTitle : 'éist'}</Text>
    </Pressable>
    <Pressable onPress={() => artistId && router.push(`/artist/${artistId}`)} disabled={!artistId}>
      <Text style={s.artist}>{artistName}</Text>
    </Pressable>

    <View style={s.player}>
      <Pressable onPress={handlePlayButtonPress} style={s.disc} accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Stop playback' : 'Start playback'}>
        <Ionicons name={isPlaying ? 'stop' : 'play'} size={26} color={colors.green} style={!isPlaying && { marginLeft: 4 }} />
      </Pressable>
      <Text style={s.playlabel}>{isPlaying ? 'Stop' : 'Listen now'}</Text>
    </View>
  </PageScaffold>
);
```

- [ ] **Step 4: Styles**

```tsx
const s = StyleSheet.create({
  onair: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  castRow: { marginTop: 18 },
  tick: { width: 30, height: 3, borderRadius: 3, backgroundColor: colors.green, marginBottom: 20 },
  title: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 33, lineHeight: 34, letterSpacing: -0.5, color: colors.green },
  artist: { fontFamily: font.body, fontWeight: '500', fontSize: 18, color: colors.green, marginTop: 9 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 30 },
  disc: { width: 66, height: 66, borderRadius: 33, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  playlabel: { fontFamily: font.body, fontWeight: '600', fontSize: 15, letterSpacing: 2.4, textTransform: 'uppercase', color: colors.green },
});
```

(The live genre/`meta` line is optional; if shown, use `type.meta` in `colors.lilac`.)

- [ ] **Step 5:** Mount in Pager at index 0. `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 6: Visual** vs phone 1: artwork bg under purple wash; "On Air" + green dot; lilac cast glyph under it (green when casting); green tick/title/artist; play disc + LISTEN NOW. Play/stop works.
- [ ] **Step 7:** Commit `feat: reskinned Listen page + cast under On Air`.

---

### Task 10: ScheduleScreen

**Files:** Create `components/screens/ScheduleScreen.tsx`; Modify `Pager.tsx` (index 1)

**Interfaces:** Keep the old file's schedule fetch + live/upcoming derivation + timezone formatting. Gate polling on `isActive` (Task 9 pattern). Produce `rows: { id, time, isLive, title, artist }`.

- [ ] **Step 1:** Render (clean rows — no bells/dots; live row shows `Now` in green, others time in lilac):

```tsx
return (
  <PageScaffold left={<Pills active={pageIndex} />}>
    <Eyebrow>Schedule</Eyebrow>
    <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Today</Text>
    <ScrollView style={{ marginTop: 32 }} showsVerticalScrollIndicator={false}>
      {rows.map((r) => (
        <Pressable key={r.id} style={s.row} onPress={() => router.push(`/show/${r.id}`)}>
          <Text style={[s.time, { color: r.isLive ? colors.green : colors.lilac }]}>{r.isLive ? 'Now' : r.time}</Text>
          <View style={{ flex: 1 }}>
            <FormattedShowTitle title={r.title} color={colors.green} size={22} style={type.rowTitle} />
            <Text style={[type.rowSub, { color: colors.lilac, marginTop: 4 }]}>{r.artist}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  </PageScaffold>
);
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  time: { fontFamily: font.body, fontWeight: '600', fontSize: 13, width: 46 },
});
```

- [ ] **Step 2:** Mount index 1; `npx tsc --noEmit && npm run lint` → PASS; visual vs phone 2 (clean rows, no right-side marks, green "Now"); commit `feat: reskinned Schedule page`.

---

### Task 11: ArtistsScreen

**Files:** Create `components/screens/ArtistsScreen.tsx`; Modify `Pager.tsx` (index 2)

**Interfaces:** `useArtists()` → list with `name` + `slug`. Names render at **row-title size** (22px), as a list (same size as Archive titles).

- [ ] **Step 1:** Render:

```tsx
const { artists } = useArtists();
return (
  <PageScaffold left={<Pills active={pageIndex} />}>
    <Eyebrow>Residents</Eyebrow>
    <ScrollView style={{ marginTop: 32 }} showsVerticalScrollIndicator={false}>
      {artists.map((a) => (
        <Pressable key={a.slug} style={{ marginBottom: 30 }} onPress={() => router.push(`/artist/${a.slug}`)}>
          <Text style={[type.rowTitle, { color: colors.green }]}>{a.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
    <Text style={[type.eyebrow, { color: colors.lilac }]}>{artists.length} residents</Text>
  </PageScaffold>
);
```

- [ ] **Step 2:** Mount index 2; checks; visual vs phone 3; commit `feat: reskinned Artists page (row-size list)`.

---

### Task 12: ArchiveScreen

**Files:** Create `components/screens/ArchiveScreen.tsx`; Modify `Pager.tsx` (index 3)

**Interfaces:** `useArchiveShows()` → flatten to `items: { slug, title, artistName }`. List with a green play triangle, no durations/cards.

- [ ] **Step 1:** Render:

```tsx
return (
  <PageScaffold left={<Pills active={pageIndex} />}>
    <Eyebrow>Archive</Eyebrow>
    <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Listen back</Text>
    <ScrollView style={{ marginTop: 36 }} showsVerticalScrollIndicator={false}>
      {items.map((it) => (
        <Pressable key={it.slug} style={s.row} onPress={() => router.push(`/archive/${it.slug}`)}>
          <View style={{ flex: 1 }}>
            <FormattedShowTitle title={it.title} color={colors.green} size={22} style={type.rowTitle} />
            <Text style={[type.rowSub, { color: colors.lilac, marginTop: 4 }]}>{it.artistName}</Text>
          </View>
          <View style={s.tri} />
        </Pressable>
      ))}
    </ScrollView>
  </PageScaffold>
);
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  tri: { width: 0, height: 0, borderLeftWidth: 13, borderLeftColor: colors.green, borderTopWidth: 8, borderTopColor: 'transparent', borderBottomWidth: 8, borderBottomColor: 'transparent' },
});
```

- [ ] **Step 2:** Mount index 3; checks; visual vs phone 4; commit `feat: reskinned Archive page`.

---

### Task 13: ConnectScreen (Social + Support merged)

**Files:** Create `components/screens/ConnectScreen.tsx`; Modify `Pager.tsx` (index 4)

- [ ] **Step 1:** Render (big green link list; lilac footer with literal lowercase é):

```tsx
const LINKS = [
  { label: 'Discord', url: 'https://discord.gg/4eHnAAUmFN' },
  { label: 'Instagram', url: 'https://www.instagram.com/eistradio' },
  { label: 'SoundCloud', url: 'https://soundcloud.com/eistcork' },
  { label: 'Mixcloud', url: 'https://www.mixcloud.com/eistcork/' },
];
return (
  <PageScaffold left={<Pills active={pageIndex} />}>
    <Eyebrow>Elsewhere</Eyebrow>
    <View style={{ marginTop: 14, gap: 22 }}>
      {LINKS.map((l) => (
        <Pressable key={l.url} onPress={() => Linking.openURL(l.url)}>
          <Text style={{ fontFamily: font.headingBold, fontWeight: '700', fontSize: 40, lineHeight: 40, letterSpacing: -0.8, color: colors.green }}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
    <View style={{ flex: 1 }} />
    <Text style={[type.eyebrow, { color: colors.lilac }]}>
      <Text style={{ textTransform: 'none' }}>éist</Text> · Cork, Ireland
    </Text>
  </PageScaffold>
);
```

- [ ] **Step 2:** Mount index 4; checks; confirm footer renders **"éist · CORK, IRELAND"** (lowercase é); commit `feat: reskinned Connect page`.

---

## Phase 5 — Detail-page reskins

### Task 14: NotifyControl (shared by artist + show pages)

**Files:** Create `components/ui/NotifyControl.tsx`

**Interfaces:** `NotifyControl({ active, onToggle, caption })` — a 56px circle (green border) holding an `react-native-svg` bell (filled green when `active`), plus a two-line label: `NOTIFY ME` (green, uppercased) / `caption` (lilac).

- [ ] **Step 1:**

```tsx
// components/ui/NotifyControl.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, font } from '../../theme/tokens';

export function NotifyControl({ active, onToggle, caption }: { active: boolean; onToggle: () => void; caption: string }) {
  return (
    <Pressable style={s.row} onPress={onToggle} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View style={s.disc}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill={active ? colors.green : 'none'} stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </Svg>
      </View>
      <View>
        <Text style={s.l1}>Notify me</Text>
        <Text style={s.l2}>{caption}</Text>
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 26 },
  disc: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  l1: { fontFamily: font.body, fontWeight: '600', fontSize: 15, letterSpacing: 2.4, textTransform: 'uppercase', color: colors.green },
  l2: { fontFamily: font.body, fontWeight: '500', fontSize: 12.5, color: colors.lilac, marginTop: 4 },
});
```

- [ ] **Step 2:** checks; commit `feat: NotifyControl`.

---

### Task 15: Artist (resident) detail reskin

**Files:** Modify `app/artist/[slug].tsx`

**Interfaces:** Keep the data layer (`useArtist…`, `useArchiveShowsByArtist`, socials/tags, notify state via existing `ArtistNotifyButton` logic). Replace presentation. Layout: BackTriangle + SpinningLogo; eyebrow "Resident"; pagehead name; meta genres (lilac); `NotifyControl caption="for next show"` wired to the existing artist-subscription toggle; bio (lilac, `type.bio`); eyebrow "Past shows"; archive list rows (row-title green + date lilac + green play triangle) → `router.push('/archive/<slug>')`.

- [ ] **Step 1:** Wrap in `PageScaffold left={<BackTriangle/>} right={<SpinningLogo/>}`; build the body per the layout above using `Eyebrow`, `type.pagehead/meta/bio/rowTitle/rowSub`, the archive triangle from Task 12, and `NotifyControl` bound to the existing subscribe/unsubscribe handler + `isSubscribed` state.
- [ ] **Step 2:** Keep `router.push('/show/<nextShowId>')` for the next-show tap if present. Drop any image hero, duration text, and old card styling.
- [ ] **Step 3:** checks; visual vs phone 6 (Artist — resident detail); commit `feat: reskinned artist detail`.

---

### Task 16: Show (upcoming) detail reskin (+ Notify lives here)

**Files:** Modify `app/show/[slug].tsx`

**Interfaces:** Keep the data layer (show fetch: title, artist(s) + slug, scheduled start, description, tags). Replace presentation. Layout: BackTriangle + SpinningLogo; eyebrow "Coming up"; pagehead title; a row of artist (green, → `/artist/<slug>`) + `· <date, time>` (lilac `datemeta`); meta genres (lilac); `NotifyControl caption="for this show"` wired to the per-show reminder toggle (existing `ReminderButton`/notification-scheduler logic — schedule/cancel this show's reminder, drive `active` from stored reminder state); bio (lilac).

- [ ] **Step 1:** Build the body per layout. The notify toggle calls the existing reminder scheduler for *this show id* and reflects persisted state. No play control (show hasn't aired).
- [ ] **Step 2:** checks; visual vs phone 8 (Show — upcoming detail); commit `feat: reskinned show detail with per-show notify`.

---

### Task 17: Archive show ("Listen back") detail reskin

**Files:** Modify `app/archive/[slug].tsx`

**Interfaces:** Keep the data layer (show, artistName + artistSlug, description, start date, `mixcloud_match`/`soundcloud_match` URLs + thumbnail, related shows). Replace presentation. Layout mirrors Listen: show thumbnail as background under the purple wash + bottom scrim; BackTriangle + SpinningLogo; eyebrow "Listen back" (green); tick; pagehead/title (green); a row of artist (green, → `/artist/<slug>`) + `· <date>` (lilac); play disc + label `PLAY ON SOUNDCLOUD` / `PLAY ON MIXCLOUD` (whichever `primaryUrl` resolves) opening the external URL. Optional below-hero: short description (lilac) + "More from <artist>" related list (row-title + date + triangle). No durations.

- [ ] **Step 1:** Build hero with the thumbnail (`getThumbnail()`), the two `LinearGradient`s from Task 9, and the play disc whose label/text is `Play on SoundCloud` or `Play on Mixcloud` and whose press opens `primaryUrl` via `Linking`.
- [ ] **Step 2:** checks; visual vs phone 7 (Listen back — show detail); commit `feat: reskinned archive show detail`.

---

## Phase 6 — Teardown

### Task 18: Delete the tabs group; full regression

**Files:** Delete `app/(tabs)/`

- [ ] **Step 1:** `grep -rn "(tabs)" app components context hooks utils --include=*.tsx --include=*.ts` → expect no matches; fix any stragglers.
- [ ] **Step 2:** `git rm -r "app/(tabs)"`.
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → PASS.
- [ ] **Step 4: Full visual regression** on a device:
  - Swipe all 5 pages; pills + colours correct; logo spins top-right and stays put; no bottom bar.
  - Listen: play/stop; live metadata + artwork; cast glyph lilac → green when casting.
  - Schedule: clean rows; tap a row → `/show/:id`.
  - Artists: row-size list; tap → `/artist/:slug`; back-triangle returns.
  - Archive: list + triangles; tap → `/archive/:slug`.
  - Connect: links open; footer é lowercase.
  - Artist detail: notify-for-next-show toggles + persists; Past shows open.
  - Show detail: notify-for-this-show toggles + persists; no play control.
  - Listen-back detail: artwork hero; "Play on SoundCloud/Mixcloud" opens externally.
- [ ] **Step 5:** Commit `refactor: remove bottom-tab navigation in favour of swipe pager`.

---

## Self-Review

**Spec coverage:** swipe nav / no bottom bar → Tasks 7, 18 · two-colour purple/green/lilac → Task 1 applied throughout · Nimbus/Funnel fonts → Tasks 1–2 · spinning three.js logo on every page → Tasks 5, 7 (overlay) + 15–17 (detail) · éist lowercase → Eyebrow + Connect footer (Tasks 4, 13) · Listen show-bg + cast under On Air → Task 9 · clean schedule, no row bells → Task 10 · residents at row size → Task 11 · archive list → Task 12 · notify on show page (+ artist page), not rows → Tasks 14–16 · back-triangle detail nav → Tasks 4, 15–17 · detail routes reachable → Task 8.

**Placeholder scan:** Pager ships placeholders only in Task 7; each replaced in Tasks 9–13. The only "PASTE …" is Task 5 Step 1 (copy a concrete committed file verbatim) — not a logic gap.

**Type consistency:** every swipe screen is `({ pageIndex, isActive }: { pageIndex: number; isActive: boolean })`; `colors`/`font`/`type`/`PAGE_COUNT` names match across tasks; `PageScaffold` slots are `left`/`right`/`transparentBg`; `NotifyControl` props `active`/`onToggle`/`caption` match both detail consumers.

**Known follow-ups (flag to user):** web build omits the logo (WebView is native-only) — add an `<iframe>` fallback if web matters; logo needs network for three.js CDN (inline three.js for offline); `app.config.ts` splash/icon already use brand purple — no change; `FormattedShowTitle` should pick up `NimbusSansBold` via the passed `style`.
