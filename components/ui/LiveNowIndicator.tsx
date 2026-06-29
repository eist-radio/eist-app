// components/ui/LiveNowIndicator.tsx
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';
import { colors, type as t } from '../../theme/tokens';
import { getLiveShowInfo } from '../../utils/liveShowInfo';

// getLiveShowInfo() sets this exact title when the station is off air.
const OFF_AIR_TITLE = 'éist · off air';

// Frozen "live now" row reused under the swipe nav on every page except Listen
// (which has its own richer on-air block). Same design as the Listen page's
// "on air" indicator — green dot + green eyebrow — but it names the live DJ.
// Dims to a plain "off air" state when nothing is broadcasting.
export function LiveNowIndicator() {
  const timeZone = useTimezoneChange();
  const { data } = useQuery({
    queryKey: ['live-now', timeZone],
    queryFn: () => getLiveShowInfo({ timeZone }),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const isLive = !!data && data.title !== OFF_AIR_TITLE;
  const tint = isLive ? colors.green : colors.textDim;
  const label = isLive ? `live now: ${data!.djName || 'éist'}` : 'off air';

  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: tint }]} />
      <Text style={[t.eyebrow, s.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  // marginBottom separates the row from the gray page eyebrow below it;
  // paddingRight keeps a long DJ name clear of the top-right spinning logo.
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingRight: 96 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flexShrink: 1 },
});
