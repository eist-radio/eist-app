// components/ui/NotifyControl.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, font } from '../../theme/tokens';

export function NotifyControl({ active, onToggle, caption }: { active: boolean; onToggle: () => void; caption: string }) {
  return (
    <Pressable style={s.row} onPress={onToggle} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View style={s.disc}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill={active ? colors.green : 'none'} stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </Svg>
      </View>
      <View>
        <Text style={s.l1}>Notify me</Text>
        <Text style={s.l2}>{caption}</Text>
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 26 },
  disc: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  l1: { fontFamily: font.body, fontWeight: '600', fontSize: 15, letterSpacing: 2.4, textTransform: 'uppercase', color: colors.green },
  l2: { fontFamily: font.body, fontWeight: '500', fontSize: 12.5, color: colors.lilac, marginTop: 4 },
});
