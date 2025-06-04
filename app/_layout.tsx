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
import { AudioProvider } from '../context/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Prevent the native splash from auto-hiding
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Replace with your actual splash image asset
const splashImage = require('../assets/images/eist.png');

export default function RootLayout() {
  // Load custom font
  const [fontsLoaded] = useFonts({
    FunnelSans: require('../assets/fonts/FunnelSans-VariableFont_wght.ttf'),
  });

  const [isAppReady, setIsAppReady] = useState(false);
  const [isSplashHidden, setIsSplashHidden] = useState(false);
  
  // Animated opacity values
  const appOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Pick theme
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? EistDarkTheme : EistLightTheme;

  // Handle app initialization and splash transition
  useEffect(() => {
    const prepareApp = async () => {
      if (fontsLoaded) {
        // Small delay to ensure everything is loaded
        await new Promise(resolve => setTimeout(resolve, 700));
        setIsAppReady(true);
        
        // Start the fade transition
        Animated.parallel([
          // Fade in the app content
          Animated.timing(appOpacity, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          // Fade out the splash screen
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]).start(async () => {
          // Hide the native splash screen after animation completes
          await SplashScreen.hideAsync();
          setIsSplashHidden(true);
        });
      }
    };

    prepareApp();
  }, [fontsLoaded, appOpacity, splashOpacity]);

  // Show nothing until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* App Content */}
      <Animated.View 
        style={[
          styles.container, 
          { 
            opacity: appOpacity,
            zIndex: isAppReady ? 1 : 0, // Ensure app content is behind splash initially
          }
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
            <AudioProvider>
              <ThemeProvider value={theme}>
                <Stack screenOptions={{ headerShown: false }} />
                <StatusBar style="auto" />
              </ThemeProvider>
            </AudioProvider>
          </Suspense>
        </QueryClientProvider>
      </Animated.View>

      {/* Custom Splash Overlay - only show until fully hidden */}
      {!isSplashHidden && (
        <Animated.View 
          style={[
            styles.splashContainer,
            { 
              opacity: splashOpacity,
              zIndex: 2, // Ensure splash is on top
            }
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
    flex: 1, // Fill entire container
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    ...StyleSheet.absoluteFillObject, // Stretch to fill parent
  },
});
