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

#### File-based Routing Structure
```
app/
├── _layout.tsx              # Root layout with providers and splash screen
├── index.tsx                # Main entry redirecting to listen tab
├── (tabs)/                  # Tab navigation group
│   ├── _layout.tsx          # Tab layout configuration
│   ├── listen.tsx           # Main radio player interface
│   ├── schedule.tsx         # Show schedule with live/upcoming indicators
│   ├── discord.tsx          # Discord integration
│   ├── instagram.tsx        # Instagram integration
│   ├── soundcloud.tsx       # SoundCloud integration
│   ├── mixcloud.tsx         # Mixcloud integration
│   ├── artist/[slug].tsx    # Dynamic artist detail pages
│   └── show/[slug].tsx      # Dynamic show detail pages
└── +not-found.tsx           # 404 error page
```

#### Audio Streaming Architecture
- **TrackPlayerService** (`trackPlayerService.js`): Background service handling remote controls, CarPlay events, and audio session management
- **Live Metadata API**: Real-time show information from `https://api.radiocult.fm/api/station/eist/schedule/live`
- **Stream URL**: `https://eist-radio.radiocult.fm/stream`
- **Cross-platform Support**: Web uses HTML5 Audio, mobile uses react-native-track-player

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

### Key Features
- **Live Radio Streaming**: Continuous audio with metadata updates
- **Background Playback**: Continues playing when app is backgrounded
- **CarPlay**: Minimal integration with vehicle systems.
- **Network Recovery**: Automatic reconnection on network changes
- **Show Schedule**: Live and upcoming show information with FormattedShowTitle component
- **Social Integration**: Links to Discord, Instagram, SoundCloud, Mixcloud
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
  - Listen page: For "Next up" show titles and current show titles
  - Schedule page: For all show titles in the schedule list
  - Show detail pages: For show title display
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