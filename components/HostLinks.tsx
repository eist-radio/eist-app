// components/HostLinks.tsx

import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { colors, font } from '../theme/tokens';

type HostLink = { id: string; name?: string; href?: string };

const defaultStyle: TextStyle = {
  // Shrink inside a wrapping row so a long host line wraps instead of
  // running off the side of a phone screen.
  flexShrink: 1,
  fontFamily: font.body,
  fontWeight: '600',
  fontSize: 16,
  color: colors.green,
};

/** Every host as its own tappable name: "A", "A & B", "A, B & C". */
export function HostLinks({
  hosts,
  style,
  numberOfLines,
  trailing,
}: {
  hosts: HostLink[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Inline text after the names, such as " · 14 November". Wraps with them. */
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const named = hosts.filter((h) => h.name);
  if (named.length === 0) return null;

  return (
    <Text style={[defaultStyle, style]} numberOfLines={numberOfLines}>
      {named.map((h, i) => {
        const sep = i === 0 ? '' : i === named.length - 1 ? ' & ' : ', ';
        return (
          <Text key={h.id}>
            {sep ? <Text style={{ color: colors.text, fontWeight: '400' }}>{sep}</Text> : null}
            <Text
              accessibilityRole="link"
              onPress={() => router.push((h.href ?? `/artist/${encodeURIComponent(h.id)}`) as any)}
            >
              {h.name}
            </Text>
          </Text>
        );
      })}
      {trailing}
    </Text>
  );
}
