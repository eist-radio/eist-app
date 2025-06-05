// app/_layout.tsx
import React, { Suspense, useEffect, useState, useRef } from 'react';
import {
  Animated,
  View,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@react-navigation/native';
import { EistLightTheme, EistDarkTheme } from '../themes';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { TrackPlayerProvider } from '../context/TrackPlayerContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Keep the native splash visible until we hide it explicitly
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const splashImage = require('../assets/images/eist.png');

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    FunnelSans: require('../assets/fonts/FunnelSans-VariableFont_wght.ttf'),
  });

  const [isAppReady, setIsAppReady] = useState(false);
  const [isSplashHidden, setIsSplashHidden] = useState(false);

  const appOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? EistDarkTheme : EistLightTheme;

  useEffect(() => {
    const prepareApp = async () => {
      if (!fontsLoaded) {
        return;
      }

      // Simulate a short loading period—adjust as needed
      await new Promise((resolve) => setTimeout(resolve, 900));

      setIsAppReady(true);
      await SplashScreen.hideAsync(); 

      Animated.parallel([
        Animated.timing(appOpacity, {
          toValue: 1,
          duration: 3200,
          useNativeDriver: true,
        }),
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsSplashHidden(true);
      });
    };

    prepareApp();
  }, [fontsLoaded, appOpacity, splashOpacity]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Main app content (fades in once ready) */}
      <Animated.View
        style={[
          styles.container,
          {
            opacity: appOpacity,
            zIndex: isAppReady ? 1 : 0,
          },
        ]}
      >
        <QueryClientProvider client={queryClient}>
          <Suspense
            fallback={
              <View style={styles.loader}>
                <ActivityIndicator size="large" />
              </View>
            }
          >
            <TrackPlayerProvider>
              <ThemeProvider value={theme}>
                <Stack screenOptions={{ headerShown: false }} />
                <StatusBar style="auto" />
              </ThemeProvider>
            </TrackPlayerProvider>
          </Suspense>
        </QueryClientProvider>
      </Animated.View>

      {/* Custom splash (fades out) */}
      {!isSplashHidden && (
        <Animated.View
          style={[
            styles.splashContainer,
            {
              opacity: splashOpacity,
              zIndex: 2,
            },
          ]}
        >
          <View style={styles.splashContent}>
            <Image
              source={splashImage}
              style={styles.splashImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
      )}
    </View>
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
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#4733FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
});
