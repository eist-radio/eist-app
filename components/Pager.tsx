// components/Pager.tsx
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, NativeScrollEvent, NativeSyntheticEvent, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAGE_COUNT, colors, space } from '../theme/tokens';
import { PageScaffold } from './ui/PageScaffold';
import { Pills } from './ui/Pills';
import { SpinningLogo } from './ui/SpinningLogo';
import ListenScreen from './screens/ListenScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import ArtistsScreen from './screens/ArtistsScreen';
import ArchiveScreen from './screens/ArchiveScreen';
import ConnectScreen from './screens/ConnectScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const { width } = Dimensions.get('window');

export function Pager() {
  const [active, setActive] = useState(0);
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setActive(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={{ flex: 1, backgroundColor: colors.purple }}>
      <StatusBar barStyle="light-content" />
      <Animated.ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={onEnd} removeClippedSubviews={false}>
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <View key={i} style={{ width }}>
            {i === 0 ? <ListenScreen pageIndex={0} isActive={active === 0} />
              : i === 1 ? <ScheduleScreen pageIndex={1} isActive={active === 1} />
              : i === 2 ? <ArtistsScreen pageIndex={2} isActive={active === 2} />
              : i === 3 ? <ArchiveScreen pageIndex={3} isActive={active === 3} />
              : i === 4 ? <NotificationsScreen pageIndex={4} isActive={active === 4} />
              : i === 5 ? <ConnectScreen pageIndex={5} isActive={active === 5} />
              : <PageScaffold><Text style={{ color: colors.green }}>Page {i}</Text></PageScaffold>}
          </View>
        ))}
      </Animated.ScrollView>
      {/* shared page indicator, top-left, fixed above all pages (centred in the
          same 100px top row as the detail pages' nav). Driven by scroll offset
          so it stays put while the active pill glides as you swipe. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + space.topGap, left: space.screenX, height: 100, justifyContent: 'center' }}>
        <Pills scrollX={scrollX} pageWidth={width} />
      </View>
      {/* single shared logo overlay, top-right, above all pages — positioned to
          match the detail pages' logo (centred in a 100px top row) */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + space.topGap, right: space.screenX }}>
        <SpinningLogo size={100} />
      </View>
    </View>
  );
}
