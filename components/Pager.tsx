// components/Pager.tsx
import React, { useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAGE_COUNT, colors, space } from '../theme/tokens';
import { PageScaffold } from './ui/PageScaffold';
import { Pills } from './ui/Pills';
import { SpinningLogo } from './ui/SpinningLogo';

const { width } = Dimensions.get('window');

export function Pager() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [active, setActive] = useState(0);
  const insets = useSafeAreaInsets();
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setActive(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={{ flex: 1, backgroundColor: colors.purple }}>
      <StatusBar barStyle="light-content" />
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd} removeClippedSubviews={false}>
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <View key={i} style={{ width }}>
            <PageScaffold left={<Pills active={i} />}>
              <Text style={{ color: colors.green }}>Page {i}</Text>
            </PageScaffold>
          </View>
        ))}
      </ScrollView>
      {/* single shared logo overlay, top-right, above all pages */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top - 30, right: space.screenX - 8 }}>
        <SpinningLogo size={100} />
      </View>
    </View>
  );
}
