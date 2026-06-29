import React from 'react';
import { View } from 'react-native';
import { BackTriangle } from './BackTriangle';
import { HomeButton } from './HomeButton';

// Back triangle on the left, home icon to its right.
export function HeaderLeftNav() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <BackTriangle />
      <HomeButton />
    </View>
  );
}
