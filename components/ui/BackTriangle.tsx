import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

export function BackTriangle() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={16} accessibilityRole="button" accessibilityLabel="Back">
      <View style={styles.tri} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  tri: {
    width: 0, height: 0,
    borderRightWidth: 15, borderRightColor: colors.green,
    borderTopWidth: 10, borderTopColor: 'transparent',
    borderBottomWidth: 10, borderBottomColor: 'transparent',
  },
});
