import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { eistLogoHtml } from '../../assets/eistLogoHtml';

export function SpinningLogo({ size = 100 }: { size?: number }) {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPainted(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (Platform.OS === 'web') return null;

  // Interactive: touches reach the canvas so the logo can be grabbed, flung and
  // eased back to auto-spin — matching the reference spinning-eist-logo physics.
  return (
    <View style={{ width: size, height: size }}>
      <WebView
        source={{ html: eistLogoHtml, baseUrl: 'https://eist.radio/' }}
        style={{ width: size, height: size, backgroundColor: 'transparent', opacity: painted ? 1 : 0 }}
        onLoadEnd={() => setPainted(true)}
        opaque={false}
        scrollEnabled={false}
        // iOS WKWebView otherwise adds a safe-area content inset that shifts the
        // canvas down inside its fixed box, clipping the logo's bottom edge on
        // physical devices. Pin insets to zero so the canvas fills the box.
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
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
