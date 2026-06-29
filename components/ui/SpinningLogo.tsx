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
        // three.js is now inlined into the HTML (no network), so the only way the
        // logo can go blank is a script/WebGL error. Surface those instead of
        // failing silently — the previous CDN version had no diagnostics, which
        // is why a blank logo on-device went unexplained.
        injectedJavaScriptBeforeContentLoaded={`window.onerror=function(m,s,l,c){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('logo-error: '+m);};true;`}
        onMessage={(e) => console.warn('[SpinningLogo]', e.nativeEvent.data)}
        onError={(e) => console.warn('[SpinningLogo] webview error', e.nativeEvent)}
      />
    </View>
  );
}
