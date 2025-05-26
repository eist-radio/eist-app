// app/_layout.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@react-navigation/native';
import { EistLightTheme, EistDarkTheme } from '../themes';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AudioProvider } from '../context/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';

// Do NOT await here - just kick off the promise so the splash won't auto-hide
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Hooks (always at top)
  const [fontsLoaded] = useFonts({
    FunnelSans: require('../assets/fonts/FunnelSans-VariableFont_wght.ttf'),
  });
  const [isReady, setIsReady] = useState(false);
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? EistDarkTheme : EistLightTheme;

  // Mark ready once fonts have loaded
  useEffect(() => {
    if (fontsLoaded) {
      setIsReady(true);
    }
  }, [fontsLoaded]);

  // Hide splash in an async callback on layout
  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      // This is inside an async function, so await is OK
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  // Don't render anything and keep the native splash until ready
  if (!isReady) {
    return null;
  }

  // Once ready, render the app and hide the splash on first layout
  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AudioProvider>
        <ThemeProvider value={theme}>
          {/* ← Auto-wires all nested layouts & screens */}
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AudioProvider>
    </View>
  );
}
