// app/_layout.tsx
import React, { Suspense, useEffect, useState, useRef } from 'react';
import {
  Animated,
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@react-navigation/native';
import { EistLightTheme, EistDarkTheme } from '../themes';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AudioProvider } from '../context/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';

// React Query imports
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Prevent the native splash from auto-hiding
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  // load custom font
  const [fontsLoaded] = useFonts({
    FunnelSans: require('../assets/fonts/FunnelSans-VariableFont_wght.ttf'),
  });
  const [isReady, setIsReady] = useState(false);

  // Animated opacity value for fade
  const rootOpacity = useRef(new Animated.Value(0)).current;

  // Pick theme
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? EistDarkTheme : EistLightTheme;

  // Once fonts are loaded, mark ready, fade in, then hide splash
  useEffect(() => {
    if (fontsLoaded) {
      setIsReady(true);
      Animated.timing(rootOpacity, {
        toValue: 1,
        duration: 500, // fade duration in ms
        useNativeDriver: true,
      }).start(async () => {
        await SplashScreen.hideAsync();
      });
    }
  }, [fontsLoaded, rootOpacity]);

  // keep splash visible until ready
  if (!isReady) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: rootOpacity }]}>
      <QueryClientProvider client={queryClient}>
        <Suspense
          fallback={
            <View style={styles.loader}>
              <ActivityIndicator size="large" />
            </View>
          }
        >
          <AudioProvider>
            <ThemeProvider value={theme}>
              <Stack screenOptions={{ headerShown: false }} />
              <StatusBar style="auto" />
            </ThemeProvider>
          </AudioProvider>
        </Suspense>
      </QueryClientProvider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
