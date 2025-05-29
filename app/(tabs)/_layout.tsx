// app/(tabs)/_layout.tsx

import React, { useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  Platform,
  findNodeHandle,
  PixelRatio,
  LayoutRectangle,
  StyleSheet,
  Share as RNShare,
} from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colors } = useTheme();
  const ACTIVE   = colors.primary;
  const INACTIVE = 'rgba(175, 252, 65, 0.5)';

  // 1) Ref + layout for the full wrapper
  const wrapperRef = useRef<View>(null);
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);

  // 2) Figure out safe-area bottom inset
  const insets = useSafeAreaInsets();

  // 3) Share logic: capture → crop off tab bar → share
  const onShare = async () => {
    try {
      if (!wrapperRef.current || !layout) {
        throw new Error('View not ready yet');
      }

      // a) snapshot the entire wrapper
      const tag = findNodeHandle(wrapperRef.current);
      if (!tag) throw new Error('Could not find native view handle');
      const rawUri = await captureRef(tag, { format: 'png', quality: 0.8 });

      // b) compute pixel dims
      const density  = PixelRatio.get();
      const pxW      = layout.width  * density;
      const pxH      = layout.height * density;

      // c) compute tab-bar height in points (default ~48pt) + safe-area
      const TAB_BAR_HEIGHT_PT = 48;
      const tabBarHeightPx    = (TAB_BAR_HEIGHT_PT + insets.bottom) * density;

      // d) crop off that bottom strip
      const cropHeight = pxH - tabBarHeightPx;
      const { uri: croppedUri } = await manipulateAsync(
        rawUri,
        [
          {
            crop: {
              originX: 0,
              originY: 0,
              width:   pxW,
              height:  cropHeight,
            },
          },
        ],
        { format: SaveFormat.PNG }
      );

      // e) share
      if (Platform.OS === 'ios') {
        await RNShare.share({ url: croppedUri });
      } else {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('No share targets available');
        }
        await Sharing.shareAsync(croppedUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Screenshot',
        });
      }
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    }
  };

  return (
    <View
      style={styles.wrapper}
      ref={wrapperRef}
      collapsable={false}
      onLayout={({ nativeEvent }) => setLayout(nativeEvent.layout)}
    >
      <Tabs
        initialRouteName="listen"
        screenOptions={{
          headerShown:          false,
          tabBarShowLabel:      false,
          tabBarActiveTintColor:   ACTIVE,
          tabBarInactiveTintColor: INACTIVE,
          tabBarStyle: { 
            backgroundColor: colors.card,
            marginTop: 12,
          },
        }}
      >
        {/* Live tab */}
        <Tabs.Screen
          name="listen"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="radio-outline" size={(size ?? 24) * 1.2} color={color} />
            ),
          }}
        />

        {/* Schedule tab */}
        <Tabs.Screen
          name="schedule"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={(size ?? 24) * 1.2} color={color} />
            ),
          }}
        />

        {/* Share screenshot “button” */}
        <Tabs.Screen
          name="share"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="share-outline" size={(size ?? 24) * 1.2} color={color} />
            ),
            tabBarButton: ({ children, ...props }) => (
              <TouchableOpacity {...props} onPress={onShare}>
                {children}
              </TouchableOpacity>
            ),
          }}
        />

        {/* Website external link tab */}
        <Tabs.Screen
          name="website"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="globe-outline" size={(size ?? 24) * 1.2} color={color} />
            ),
          }}
        />

        {/* Discord external link tab */}
        <Tabs.Screen
          name="discord"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="logo-discord" size={(size ?? 24) * 1.2} color={color} />
            ),
          }}
        />

        {/* Hidden detail routes */}
        <Tabs.Screen
          name="artist/[slug]"
          options={{
            tabBarButton:   () => null,
            tabBarItemStyle:{ display: 'none' },
          }}
        />
        <Tabs.Screen
          name="show/[slug]"
          options={{
            tabBarButton:   () => null,
            tabBarItemStyle:{ display: 'none' },
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});
