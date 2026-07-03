import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, PAGE_COUNT } from '../../theme/tokens';

// Driven by the Pager's horizontal scroll offset so the active pill stretches
// and tints smoothly as you drag between pages (rather than snapping on settle).
export function Pills({ scrollX, pageWidth }: { scrollX: Animated.Value; pageWidth: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: PAGE_COUNT }).map((_, i) => {
        const inputRange = [(i - 1) * pageWidth, i * pageWidth, (i + 1) * pageWidth];
        const width = scrollX.interpolate({
          inputRange,
          outputRange: [7, 22, 7],
          extrapolate: 'clamp',
        });
        const backgroundColor = scrollX.interpolate({
          inputRange,
          outputRange: [colors.pillDim, colors.green, colors.pillDim],
          extrapolate: 'clamp',
        });
        return <Animated.View key={i} style={[styles.pill, { width, backgroundColor }]} />;
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pill: { height: 7, borderRadius: 5 },
});
