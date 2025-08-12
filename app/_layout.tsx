// app/_layout.tsx

import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    StyleSheet,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TrackPlayerProvider } from '../context/TrackPlayerContext';
import { EistDarkTheme, EistLightTheme } from '../themes';

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
      if (!fontsLoaded) return;

      await new Promise((resolve) => setTimeout(resolve, 900));

      setIsAppReady(true);

      Animated.parallel([
        Animated.timing(appOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 3200,
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            <TrackPlayerProvider>
              <Suspense
                fallback={
                  <View style={styles.loader}>
                    <ActivityIndicator size="large" />
                  </View>
                }
              >
                <ThemeProvider value={theme}>
                  <Stack screenOptions={{ headerShown: false }} />
                  <StatusBar style="auto" />
                </ThemeProvider>
              </Suspense>
            </TrackPlayerProvider>
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
    </GestureHandlerRootView>
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
    width: 275,
  },
});
