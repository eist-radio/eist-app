// app/_layout.tsx

import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider } from '@react-navigation/native';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    AppState,
    AppStateStatus,
    Image,
    Platform,
    StyleSheet,
    View,
} from 'react-native';
import { CastProvider } from '../context/CastContext';
import { NotificationProvider } from '../context/NotificationContext';
import { TrackPlayerProvider } from '../context/TrackPlayerContext';
import { EistDarkTheme, EistLightTheme } from '../themes';

// React Query doesn't know about connectivity in React Native unless wired up.
// Without this it assumes "always online", so queries that fail in airplane
// mode exhaust their retries and never refetch when the network returns —
// leaving the Artists and Listen-back pages stuck empty. Wiring onlineManager
// to NetInfo makes offline queries pause and automatically resume/refetch on
// reconnect.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
  });
}

const queryClient = new QueryClient();

const splashImage = require('../assets/images/eist.png');

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    FunnelSans: require('../assets/fonts/FunnelSans-VariableFont_wght.ttf'),
    NimbusSans: require('../assets/fonts/NimbusSans-Regular.otf'),
    NimbusSansBold: require('../assets/fonts/NimbusSans-Bold.otf'),
    ...Ionicons.font,
  });

  const [isAppReady, setIsAppReady] = useState(false);
  const [isSplashHidden, setIsSplashHidden] = useState(false);

  const appOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? EistDarkTheme : EistLightTheme;

  // Tell React Query when the app is foregrounded so it can refetch stale
  // queries on return (complements onlineManager for the navigate-away case).
  useEffect(() => {
    const onAppStateChange = (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const prepareApp = async () => {
      if (!fontsLoaded) return;

      await new Promise((resolve) => setTimeout(resolve, 900));

      setIsAppReady(true);

      Animated.parallel([
        Animated.timing(appOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: Platform.OS !== 'web',
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
            <CastProvider>
              <TrackPlayerProvider>
                <NotificationProvider>
                <Suspense
                  fallback={
                    <View style={styles.loader}>
                      <ActivityIndicator size="large" />
                    </View>
                  }
                >
                  <ThemeProvider value={theme}>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                        animation: 'slide_from_right',
                        contentStyle: { backgroundColor: '#4733FF' },
                      }}
                    />
                    <StatusBar style="auto" />
                  </ThemeProvider>
                </Suspense>
              </NotificationProvider>
              </TrackPlayerProvider>
            </CastProvider>
          </QueryClientProvider>
        </Animated.View>

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
    backgroundColor: '#4733FF',
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
    width: 275,
  },
});
