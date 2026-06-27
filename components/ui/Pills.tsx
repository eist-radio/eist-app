import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, PAGE_COUNT } from '../../theme/tokens';

export function Pills({ active }: { active: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: PAGE_COUNT }).map((_, i) => (
        <View key={i} style={[styles.pill, i === active ? styles.on : { backgroundColor: colors.pillDim }]} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pill: { width: 7, height: 7, borderRadius: 5 },
  on: { width: 22, backgroundColor: colors.green },
});
