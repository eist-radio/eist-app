// components/ui/NotifyControl.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';
import { colors, font } from '../../theme/tokens';

const BELL_BODY =
  'M12 3c-.7 0-1.3.6-1.3 1.3v.6C8 5.5 6.3 7.6 6.3 10.2c0 4.8-1.8 6.3-2.6 7.3-.3.4 0 1 .5 1h15.6c.5 0 .8-.6.5-1-.8-1-2.6-2.5-2.6-7.3 0-2.6-1.7-4.7-4.4-5.3v-.6C13.3 3.6 12.7 3 12 3z';
const BELL_CLAPPER = 'M10.3 20.5a1.8 1.8 0 0 0 3.4 0z';

function NotifyGlyph({ active, size = 56 }: { active: boolean; size?: number }) {
  const id = React.useId();
  // active (on)    -> transparent circle (ring) + filled bell
  // inactive (off) -> solid coin + bell-shaped hole
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 56 56">
        <Circle cx={28} cy={28} r={27} fill="none" stroke={colors.green} strokeWidth={1.5} />
        <G transform="translate(11.2,10.9) scale(1.4)" fill={colors.green}>
          <Path d={BELL_BODY} />
          <Path d={BELL_CLAPPER} />
        </G>
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Defs>
        <Mask id={id}>
          <Rect width={56} height={56} fill="#fff" />
          <G transform="translate(11.2,10.9) scale(1.4)" fill="#000">
            <Path d={BELL_BODY} />
            <Path d={BELL_CLAPPER} />
          </G>
        </Mask>
      </Defs>
      <Circle cx={28} cy={28} r={28} fill={colors.green} mask={`url(#${id})`} />
    </Svg>
  );
}

export function NotifyControl({ active, onToggle, caption }: { active: boolean; onToggle: () => void; caption: string }) {
  return (
    <Pressable style={s.row} onPress={onToggle} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <NotifyGlyph active={active} />
      <View>
        <Text style={s.l1}>Notify me</Text>
        <Text style={s.l2}>{caption}</Text>
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 26 },
  l1: { fontFamily: font.body, fontWeight: '600', fontSize: 15, letterSpacing: 0.2, color: colors.green },
  l2: { fontFamily: font.body, fontWeight: '500', fontSize: 13, color: colors.bone, marginTop: 4 },
});
