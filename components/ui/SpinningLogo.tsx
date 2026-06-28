import React from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { eistLogoHtml } from '../../assets/eistLogoHtml';

export function SpinningLogo({ size = 100 }: { size?: number }) {
  if (Platform.OS === 'web') return null; // web build: omit (or use an <iframe> later)
  // Interactive: touches reach the canvas so the logo can be grabbed, flung and
  // eased back to auto-spin — matching the reference spinning-eist-logo physics.
  return (
    <View style={{ width: size, height: size }}>
      <WebView
        source={{ html: eistLogoHtml, baseUrl: 'https://eist.radio/' }}
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        opaque={false}
        scrollEnabled={false}
        androidLayerType="hardware"
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}
