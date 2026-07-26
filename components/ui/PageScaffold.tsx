// components/ui/PageScaffold.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../../theme/tokens';
import { LiveNowIndicator } from './LiveNowIndicator';

export function PageScaffold({
  children, left, right, transparentBg = false, liveNow = false, frozenLiveNow = false,
}: { children: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; transparentBg?: boolean; liveNow?: boolean; frozenLiveNow?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, !transparentBg && { backgroundColor: colors.purple }]}>
      <View style={[styles.top, { top: insets.top + space.topGap }]} pointerEvents="box-none">
        <View>{left}</View>
        <View>{right}</View>
      </View>
      <View style={[styles.content, { paddingTop: insets.top + 86, paddingBottom: insets.bottom + 40 }]}>
        {/* zIndex keeps the indicator above detail pages' absolute-fill
            ShowArtworkBackground, which is a later sibling and would otherwise
            paint over it. */}
        {liveNow && (
          <View style={styles.liveNow}>
            <LiveNowIndicator />
          </View>
        )}
        {/* Swipe pages: the visible "live now" line is a single frozen overlay in
            the Pager (so it stays put during swipes, like the logo and pills).
            Here we render an invisible copy purely to reserve the identical
            height — it self-syncs with the real one's text wrapping. */}
        {frozenLiveNow && (
          <View
            style={[styles.liveNow, { opacity: 0 }]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <LiveNowIndicator />
          </View>
        )}
        {children}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: space.screenX, right: space.screenX, zIndex: 5, height: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { flex: 1, paddingHorizontal: space.screenX },
  liveNow: { zIndex: 2 },
});
