import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors, type as t } from '../../theme/tokens';

export function Eyebrow({ children, color = colors.textDim, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) {
  return <Text style={[styles.e, { color }, style]}>{children}</Text>;
}
const styles = StyleSheet.create({ e: t.eyebrow });
