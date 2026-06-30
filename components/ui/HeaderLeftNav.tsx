import React from 'react';
import { View } from 'react-native';
import { BackTriangle } from './BackTriangle';

// Back triangle only. The home icon was removed — the frozen "live now" line
// (LiveNowIndicator) now links back to the Listen page on every sub page.
export function HeaderLeftNav() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <BackTriangle />
    </View>
  );
}
