// app/(tabs)/_layout.tsx

import React, { useRef, useState } from 'react'
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
  Linking,
} from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faMixcloud } from '@fortawesome/free-brands-svg-icons'
import { useTheme } from '@react-navigation/native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function TabLayout() {
  const { colors } = useTheme()
  const ACTIVE = colors.primary
  const INACTIVE = 'rgba(175, 252, 65, 0.5)'

  const wrapperRef = useRef<View>(null)
  const [layout, setLayout] = useState<LayoutRectangle | null>(null)
  const insets = useSafeAreaInsets()

  const onShare = async () => {
    try {
      if (!wrapperRef.current || !layout) throw new Error('View not ready yet')
      const tag = findNodeHandle(wrapperRef.current)
      if (!tag) throw new Error('Could not find native view handle')
      const rawUri = await captureRef(tag, { format: 'png', quality: 0.8 })

      const density = PixelRatio.get()
      const pxW = layout.width * density
      const pxH = layout.height * density
      const TAB_BAR_PT = 48
      const tabBarPx = (TAB_BAR_PT + insets.bottom) * density
      const cropHeightPx = pxH - tabBarPx

      const { uri: croppedUri } = await manipulateAsync(
        rawUri,
        [{ crop: { originX: 0, originY: 0, width: pxW, height: cropHeightPx } }],
        { format: SaveFormat.PNG }
      )

      if (Platform.OS === 'ios') {
        await RNShare.share({ url: croppedUri })
      } else {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('No share targets available')
        }
        await Sharing.shareAsync(croppedUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Screenshot',
        })
      }
    } catch (err: any) {
      Alert.alert('Share failed', err.message)
    }
  }

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
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: ACTIVE,
          tabBarInactiveTintColor: INACTIVE,
          tabBarStyle: {
            backgroundColor: colors.card,
            marginTop: 12,
          },
        }}
      >
        <Tabs.Screen
          name="listen"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="radio-outline"
                size={(size ?? 26) * 1.2}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="schedule"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="calendar-outline"
                size={(size ?? 26) * 1.2}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="share"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="share-outline"
                size={(size ?? 26) * 1.2}
                color={color}
              />
            ),
            tabBarButton: ({ children, ...props }) => (
              <TouchableOpacity {...props} onPress={onShare}>
                {children}
              </TouchableOpacity>
            ),
          }}
        />

        <Tabs.Screen
          name="discord"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="logo-discord"
                size={(size ?? 26) * 1.2}
                color={color}
              />
            ),
          }}
        />


        <Tabs.Screen
          name="instagram"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="logo-instagram"
                size={(size ?? 26) * 1.2}
                color={color}
              />
            ),
            tabBarButton: ({ children, ...props }) => (
              <TouchableOpacity
                {...props}
                onPress={() => Linking.openURL('https://instagram.com/eistradio')}
              >
                {children}
              </TouchableOpacity>
            ),
          }}
        />

        <Tabs.Screen
          name="mixcloud"
          options={{
            tabBarIcon: ({ color, size }) => (
              <FontAwesomeIcon
                icon={faMixcloud}
                size={(size ?? 24) * 1.3}
                color={color}
              />
            ),
            tabBarButton: ({ children, ...props }) => (
              <TouchableOpacity
                {...props}
                onPress={() =>
                  Linking.openURL('https://www.mixcloud.com/eistcork/')
                }
              >
                {children}
              </TouchableOpacity>
            ),
          }}
        />

        <Tabs.Screen
          name="artist/[slug]"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="show/[slug]"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
})
