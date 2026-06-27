import React from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { eistLogoHtml } from '../../assets/eistLogoHtml';

export function SpinningLogo({ size = 100 }: { size?: number }) {
  if (Platform.OS === 'web') return null; // web build: omit (or use an <iframe> later)
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <WebView
        source={{ html: eistLogoHtml, baseUrl: 'https://eist.radio/' }}
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        opaque={false}
        scrollEnabled={false}
        pointerEvents="none"
        androidLayerType="hardware"
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}
