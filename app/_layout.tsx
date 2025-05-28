// app/_layout.tsx
import React, {
  useCallback,
  useEffect,
  useState,
  Suspense,
} from 'react';
import { View, ActivityIndicator } from 'react-native';
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
  // --- app-ready state (fonts, splash)
  const [fontsLoaded] = useFonts({
    FunnelSans: require('../assets/fonts/FunnelSans-VariableFont_wght.ttf'),
  });
  const [isReady, setIsReady] = useState(false);

  // theme
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? EistDarkTheme : EistLightTheme;

  // once fonts are in, mark app ready
  useEffect(() => {
    if (fontsLoaded) {
      setIsReady(true);
    }
  }, [fontsLoaded]);

  // hide the splash as soon as the first layout pass happens
  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  // keep splash up
  if (!isReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      {/* Provide React Query client */}
      <QueryClientProvider client={queryClient}>
        {/* 
          Any screen with useQuery({ suspense: true }) will
          keep this spinner visible until its data resolves 
        */}
        <Suspense
          fallback={
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
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
    </View>
  );
}
