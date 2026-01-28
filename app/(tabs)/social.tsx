// app/(tabs)/social.tsx

import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'
import React, { useCallback, useState } from 'react'
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const logoImage = require('../../assets/images/eist-logo-header.png')

const COLORS = {
  eist: '#4733FF',
  lime: '#AFFC41',
  limeSubtle: 'rgba(175, 252, 65, 0.06)',
  limeBorder: 'rgba(175, 252, 65, 0.15)',
}

type SocialButtonProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  onPress: () => void
}

const SocialButton = ({ icon, title, subtitle, onPress }: SocialButtonProps) => {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.socialButton,
        pressed && styles.socialButtonPressed,
      ]}
    >
      <View style={styles.socialIconWrapper}>
        <Ionicons name={icon} size={32} color={COLORS.lime} />
      </View>
      <Text style={[styles.socialTitle, { color: colors.primary }]}>{title}</Text>
      <Text style={[styles.socialSubtitle, { color: colors.text }]}>{subtitle}</Text>
      <View style={styles.socialArrow}>
        <Ionicons name="open-outline" size={16} color={colors.primary} style={{ opacity: 0.5 }} />
      </View>
    </Pressable>
  )
}

export default function SocialScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const openUrl = useCallback(async (url: string, name: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert(
          `Cannot Open ${name}`,
          `Unable to open ${name}. Please check your internet connection.`,
          [{ text: 'OK' }]
        )
      }
    } catch {
      Alert.alert('Error', `Failed to open ${name}. Please try again later.`, [{ text: 'OK' }])
    }
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>Social</Text>
        <Pressable
          style={styles.logoContainer}
          onPress={() => Linking.openURL('https://eist.radio/support')}
          accessibilityRole="link"
        >
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        </Pressable>
      </View>

      {/* Social Buttons */}
      <View style={styles.content}>
        <View style={styles.buttonsContainer}>
          <SocialButton
            icon="logo-discord"
            title="Discord"
            subtitle="Join the community"
            onPress={() => openUrl('https://discord.gg/4eHnAAUmFN', 'Discord')}
          />
          <SocialButton
            icon="logo-instagram"
            title="Instagram"
            subtitle="@eistradio"
            onPress={() => openUrl('https://www.instagram.com/eistradio', 'Instagram')}
          />
        </View>

        <Text style={[styles.footerText, { color: colors.text }]}>
          Connect with DJs and listeners, get show updates, and discover new music.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoContainer: {
    marginTop: -4,
  },
  logo: {
    width: 52,
    height: 52,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    backgroundColor: COLORS.limeSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    padding: 20,
    alignItems: 'center',
  },
  socialButtonPressed: {
    backgroundColor: 'rgba(175, 252, 65, 0.12)',
    transform: [{ scale: 0.98 }],
  },
  socialIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(175, 252, 65, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  socialSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 8,
  },
  socialArrow: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.5,
    paddingHorizontal: 20,
  },
})
