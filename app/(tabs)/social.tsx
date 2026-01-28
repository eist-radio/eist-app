// app/(tabs)/social.tsx

import { Ionicons } from '@expo/vector-icons'
import { faMixcloud, faSoundcloud } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { useTheme } from '@react-navigation/native'
import React, { useCallback, useState } from 'react'
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
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

type SocialCardProps = {
  icon: React.ReactNode
  title: string
  subtitle: string
  onPress: () => void
}

const SocialCard = ({ icon, title, subtitle, onPress }: SocialCardProps) => {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.socialCard,
        pressed && styles.socialCardPressed,
      ]}
    >
      <View style={styles.socialIconWrapper}>
        {icon}
      </View>
      <Text style={[styles.socialTitle, { color: colors.primary }]}>{title}</Text>
      <Text style={[styles.socialSubtitle, { color: colors.text }]}>{subtitle}</Text>
      <View style={styles.externalIcon}>
        <Ionicons name="open-outline" size={14} color={colors.primary} style={{ opacity: 0.4 }} />
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }
        ]}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Connect Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>CONNECT</Text>
          <View style={styles.cardsRow}>
            <SocialCard
              icon={<Ionicons name="logo-discord" size={28} color={COLORS.lime} />}
              title="Discord"
              subtitle="Join the chat"
              onPress={() => openUrl('https://discord.gg/4eHnAAUmFN', 'Discord')}
            />
            <SocialCard
              icon={<Ionicons name="logo-instagram" size={28} color={COLORS.lime} />}
              title="Instagram"
              subtitle="@eistradio"
              onPress={() => openUrl('https://www.instagram.com/eistradio', 'Instagram')}
            />
          </View>
        </View>

        {/* Listen Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>LISTEN</Text>
          <View style={styles.cardsRow}>
            <SocialCard
              icon={<FontAwesomeIcon icon={faMixcloud} size={26} color={COLORS.lime} />}
              title="Mixcloud"
              subtitle="Past shows"
              onPress={() => openUrl('https://www.mixcloud.com/eistcork/', 'Mixcloud')}
            />
            <SocialCard
              icon={<FontAwesomeIcon icon={faSoundcloud} size={24} color={COLORS.lime} />}
              title="SoundCloud"
              subtitle="Tracks"
              onPress={() => openUrl('https://soundcloud.com/eistcork', 'SoundCloud')}
            />
          </View>
        </View>

        {/* Footer */}
        <Text style={[styles.footerText, { color: colors.text }]}>
          Connect with DJs and listeners, get show updates, and discover new music.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
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

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.6,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Cards
  socialCard: {
    flex: 1,
    backgroundColor: COLORS.limeSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    padding: 18,
    alignItems: 'center',
  },
  socialCardPressed: {
    backgroundColor: 'rgba(175, 252, 65, 0.12)',
    transform: [{ scale: 0.98 }],
  },
  socialIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(175, 252, 65, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  socialTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  socialSubtitle: {
    fontSize: 12,
    opacity: 0.55,
  },
  externalIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  // Footer
  footerText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    opacity: 0.45,
    paddingHorizontal: 24,
    marginTop: 8,
  },
})
