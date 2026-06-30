// components/ui/LiveNowIndicator.tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';
import { colors, type as t } from '../../theme/tokens';
import { getLiveShowInfo } from '../../utils/liveShowInfo';
import { requestListen } from '../../utils/listenNav';

// getLiveShowInfo() sets this exact title when the station is off air.
const OFF_AIR_TITLE = 'éist · off air';

// Frozen indicator shown above the page eyebrow on every sub page. Tapping it
// returns to the Listen page. Renders:
//   • "live now: <DJ>" (green) while a show is broadcasting
//   • "offline" (dimmed) once we've confirmed the network is down or there's no
//      current show
//   • nothing while still loading / unconfirmed (avoids a premature "offline" flash)
export function LiveNowIndicator() {
  const router = useRouter();
  const timeZone = useTimezoneChange();
  const net = useNetInfo();
  const { data } = useQuery({
    queryKey: ['live-now', timeZone],
    queryFn: () => getLiveShowInfo({ timeZone }),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  // isConnected is `null` while unknown — only `=== false` is a confirmed outage.
  const networkOff = net.isConnected === false;
  const isLive = !!data && data.title !== OFF_AIR_TITLE;

  let tint: string;
  let label: string;
  if (networkOff) {
    tint = colors.textDim;
    label = 'offline';
  } else if (isLive) {
    tint = colors.green;
    label = `live now: ${data!.djName || 'éist'}`;
  } else if (data) {
    // Live schedule resolved with no current show.
    tint = colors.textDim;
    label = 'offline';
  } else {
    // Still loading / unconfirmed — show nothing.
    return null;
  }

  const goToListen = () => {
    requestListen();
    if (router.canDismiss?.()) router.dismissAll();
  };

  return (
    <Pressable
      style={s.row}
      onPress={goToListen}
      accessibilityRole="link"
      accessibilityLabel="Go to Listen"
    >
      <MaterialCommunityIcons name="headphones" size={17} color={colors.green} />
      <Text style={[t.eyebrow, s.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // marginBottom separates the row from the gray page eyebrow below it;
  // paddingRight keeps the text clear of the top-right spinning logo. The label
  // wraps instead of truncating, so long DJ names show in full.
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingRight: 96 },
  label: { flexShrink: 1 },
});
