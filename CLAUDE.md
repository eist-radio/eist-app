# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native/Expo app for streaming éist radio. The app provides live radio streaming with metadata display, schedule viewing, and social media integration. It supports iOS, Android, and web platforms.

## Common Commands

### Development
```bash
npm install             # Install dependencies
npm start               # Start Expo development server
npm run android         # Run on Android device/emulator
npm run ios             # Run on iOS device/simulator
npm run web             # Start web development server
npm run lint            # Run ESLint
```

### EAS Build & Deploy
```bash
npx expo start --tunnel                    # Development with tunnel
npx expo start --tunnel --clear           # Development with cache clear
eas build --platform ios --profile development    # iOS development build
eas build --platform ios                          # iOS production build
eas build --platform android                      # Android production build
eas submit --platform ios                         # Submit to App Store
eas submit --platform android                     # Submit to Google Play
eas credentials --platform ios                    # Manage iOS credentials
```

## Tech Stack & Architecture

### Core Technologies
- **React Native 0.79.5** with **Expo 53.0.22**
- **React 19.0.0** with **React DOM 19.0.0**
- **Expo Router** for file-based navigation
- **TypeScript** with strict mode enabled
- **React Query (@tanstack/react-query)** for data fetching
- **React Native Track Player 4.1.2** (@doublesymmetry/react-native-track-player) for audio streaming

### Key Dependencies
- **Audio**: @doublesymmetry/react-native-track-player, expo-audio
- **Navigation**: @react-navigation/native, @react-navigation/bottom-tabs, expo-router
- **Network**: @react-native-community/netinfo
- **Storage**: @react-native-async-storage/async-storage
- **UI**: @expo/vector-icons, @fortawesome/react-native-fontawesome
- **Media**: expo-image, expo-video, react-native-svg, shaka-player
- **Sharing**: react-native-share, expo-sharing, react-native-view-shot
- **Other**: react-native-webview, expo-web-browser, expo-haptics, react-native-dotenv

### Application Architecture

#### Core Context System
- **TrackPlayerContext** (`context/TrackPlayerContext.tsx`): Central audio management with comprehensive error handling, network recovery, background playback support, and CarPlay/Android Auto integration
- **NotificationContext** (`context/NotificationContext.tsx`): Manages show reminders and artist subscriptions (local scheduled notifications), permission state, and AsyncStorage persistence. Consumed via the `useNotifications()` hook.
- **CastContext** (`context/CastContext.tsx`): Google Cast / AirPlay state.

#### Navigation & Routing

The primary UI is **not** bottom tabs — it's a horizontal **swipe Pager** (`components/Pager.tsx`) rendered by `app/index.tsx`. Each swipe page is a component in `components/screens/`. Detail pages are separate Expo Router routes navigated to via `router.push`.

```
app/
├── _layout.tsx              # Root Stack layout: providers (Query, Cast, TrackPlayer,
│                            #   Notification) + animated splash screen. Header hidden;
│                            #   horizontal slide transitions.
├── index.tsx                # Renders <Pager /> (the swipe deck)
├── show/[slug].tsx          # Show detail page (radiocult schedule)
├── artist/[slug].tsx        # Artist detail page
├── archive/[slug].tsx       # Archived show detail page (worker API)
└── +not-found.tsx           # 404 error page

components/
├── Pager.tsx                # Horizontal paging ScrollView; PAGE_COUNT (theme/tokens.ts)
│                            #   pages, shared spinning-logo overlay, Pills indicator.
└── screens/                 # One component per swipe page (props: { pageIndex, isActive })
    ├── ListenScreen.tsx     #   0 · live player
    ├── ScheduleScreen.tsx   #   1 · schedule (live/upcoming)
    ├── ArtistsScreen.tsx    #   2 · artists
    ├── ArchiveScreen.tsx    #   3 · archive / listen back
    ├── NotificationsScreen.tsx  # 4 · active reminders (clear show reminders/artist subs)
    └── ConnectScreen.tsx    #   5 · external links, last page (incl. "Support us" → eist.radio/support)
```

To add/remove a swipe page: update `PAGE_COUNT` in `theme/tokens.ts` and the index→component mapping in `components/Pager.tsx`. The `Pills` indicator reads `PAGE_COUNT` automatically.

#### Audio Streaming Architecture
- **TrackPlayerService** (`trackPlayerService.js`): Background service handling remote controls, CarPlay events, and audio session management
- **Live Metadata API**: Real-time show information from `https://api.radiocult.fm/api/station/eist/schedule/live`
- **Stream URL**: `https://eist-radio.radiocult.fm/stream`
- **Cross-platform Support**: Web uses HTML5 Audio, mobile uses react-native-track-player

#### Data APIs (`config.ts`)
Two distinct backends — keep them straight:
- **RadioCult** (`https://api.radiocult.fm`): live metadata, schedule, show & artist detail pages. Authenticated with `apiKey` (from EAS/Expo `extra`). Used by ListenScreen, ScheduleScreen, `app/show/[slug].tsx`, `app/artist/[slug].tsx`.
- **éist worker API** (`EIST_API_BASE_URL` = `https://eist-api.johnocallaghan.workers.dev`, endpoints in `EIST_API_ENDPOINTS`): archive shows and artist stats/mapping. Used by `hooks/useArchiveShows.ts` and `hooks/useArtists.ts`. **This is production code.** The worker source is **not** in this repo — it's a separate Cloudflare Worker project maintained in its own repository, and the app only talks to the deployed URL above over HTTP.

#### Theming (`theme/tokens.ts`)
- `colors` — `purple` (bg), `green` (`#AFFC41`), `text` (`#E7E5E5` "Alabaster gray", secondary text), `textDim` (translucent gray for placeholders), `pillDim`. There is **no** `bone`/`boneDim` token (renamed to `text`/`textDim`).
- **Eyebrows** (`components/ui/Eyebrow.tsx`) default to `text` (Alabaster gray); the only green eyebrow is the Listen screen "on air" live indicator (explicit `color={colors.green}`).
- **Colour convention:** `green` is used for headings/titles, links, and the "now playing" context — the Listen screen's current-show artist and the schedule live ("NOW") row (whole row green). `text`/`textDim` (gray) is for all other secondary text — body/descriptions, dates/times, captions, and **artist-name subtitles in lists** (archive, non-live schedule rows).
- `font`, `type` (shared text-style fragments; colour applied at call site), `space`, `PAGE_COUNT`.

#### State Management Patterns
- React Context for global audio state
- React Query for server state and caching
- AsyncStorage for persistence (play state, preferences)
- Network connectivity monitoring with automatic recovery

### Platform-Specific Configurations

#### iOS (`app.config.ts`)
- Background audio capabilities
- CarPlay/AirPlay support
- Audio session configuration
- URL scheme handling for Mixcloud integration
- App Transport Security exceptions

#### Android
- Foreground service permissions for background playback
- Media playback service configuration
- Wake lock permissions

#### In-car (CarPlay / Android Auto)
Both are custom Expo config plugins (no third-party CarPlay/Android Auto npm package). They surface react-native-track-player's existing media session — éist logo artwork + play/stop on the current show — in the car. No browse UI beyond a single live-radio item.
- **Android Auto** (`plugins/withAndroidAuto.js`): **enabled.** Injects a native `MediaBrowserService` (Kotlin) that binds to RNTP's `MusicService`, reflects out its `MediaSessionCompat` token, exposes one playable "éist radio" item, and fixes `DISPLAY_SUBTITLE`. Adds the `automotive_app_desc.xml` + manifest declarations.
- **CarPlay** (`plugins/withCarPlay.js`): **gated, disabled by default.** Only added to the plugin list when `EXPO_ENABLE_CARPLAY=true` (see `app.config.ts`), so the default build is unaffected. When enabled it adds the `com.apple.developer.carplay-audio` entitlement, a CarPlay-only Info.plist scene (no `UIWindowScene` role, so RN rendering is untouched), and a Swift `CarPlaySceneDelegate` that roots CarPlay on a one-item `CPListTemplate` ("éist radio") and *pushes* `CPNowPlayingTemplate.shared` when tapped (Apple forbids the Now Playing template as a root template — it must be pushed onto a browsable root). Play/stop reuse the `MPRemoteCommandCenter` commands handled in `trackPlayerService.js`.
  - **To turn CarPlay on** (all three required first): 1) request the CarPlay "audio" entitlement for the App ID in the Apple Developer portal and wait for approval; 2) ensure the EAS provisioning profile includes `com.apple.developer.carplay-audio` (`eas credentials`); 3) build with the flag, e.g. `EXPO_ENABLE_CARPLAY=true eas build -p ios` (or `EXPO_ENABLE_CARPLAY=true npx expo prebuild -p ios --clean` locally).

### Key Features
- **Live Radio Streaming**: Continuous audio with metadata updates
- **Background Playback**: Continues playing when app is backgrounded
- **CarPlay**: Minimal integration with vehicle systems.
- **Network Recovery**: Automatic reconnection on network changes
- **Show Schedule**: Live and upcoming show information with FormattedShowTitle component
- **Notifications**: Per-show reminders and artist subscriptions (local scheduled notifications); the Active Notifications swipe page lists and clears them. Not available on web.
- **Social Integration**: Links to Discord, Instagram, SoundCloud, Mixcloud, plus "Support us" (eist.radio/support)
- **Cross-platform**: iOS, Android, and web support

### UI Components

#### FormattedShowTitle Component (`components/FormattedShowTitle.tsx`)
- **Purpose**: Handles special formatting for show titles containing "éist arís" text
- **Functionality**: 
  - Replaces "éist arís" text with repeat icons (Ionicons "repeat")
  - Handles multiple variations: "éist arís", "eist aris", "(éist arís)", "(eist aris)"
  - Platform-specific icon alignment adjustments for iOS/Android
  - Supports both inline (`asContent={true}`) and standalone text rendering
- **Usage Locations**:
  - Listen screen: "Next up" and current show titles
  - Schedule screen: all show titles in the schedule list
  - Archive screen & archive detail (`app/archive/[slug].tsx`): archived show titles
  - Notifications screen: show-reminder titles
  - Show & artist detail pages (`app/show/[slug].tsx`, `app/artist/[slug].tsx`)
- **Text Wrapping**: No ellipsizeMode - titles wrap naturally over multiple lines within their container constraints
- **Props**: `title`, `color`, `size`, `style`, `numberOfLines`, `asContent`, etc.

## Important Implementation Notes

### Audio Session Management
- The app implements comprehensive audio session recovery for iOS CarPlay/AirPlay interruptions
- Always use `cleanResetPlayer()` before starting new streams to prevent buffering issues
- Track metadata is preserved during stops for lock screen/CarPlay display

### Build Considerations
- Uses EAS Build for production builds
- Development builds required for native dependencies (can't use Expo Go)
- Environment variables configured through EAS secrets for production builds
- Apple Developer license required for iOS distribution