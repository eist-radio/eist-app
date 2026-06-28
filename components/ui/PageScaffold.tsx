// components/ui/PageScaffold.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../../theme/tokens';

export function PageScaffold({
  children, left, right, transparentBg = false,
}: { children: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; transparentBg?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, !transparentBg && { backgroundColor: colors.purple }]}>
      <View style={[styles.top, { top: insets.top + space.topGap }]} pointerEvents="box-none">
        <View>{left}</View>
        <View>{right}</View>
      </View>
      <View style={[styles.content, { paddingTop: insets.top + 86 }]}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: space.screenX, right: space.screenX, zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { flex: 1, paddingHorizontal: space.screenX, paddingBottom: 40 },
});
