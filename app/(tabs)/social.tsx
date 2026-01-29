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
  // Discord card - sophisticated dark treatment
  discordBg: '#1a1a2e',
  discordBgLight: '#252542',
  discordAccent: 'rgba(175, 252, 65, 0.9)',
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

type DiscordHeroProps = {
  onPress: () => void
}

const DiscordHero = ({ onPress }: DiscordHeroProps) => {
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.discordHero,
        pressed && styles.discordHeroPressed,
      ]}
    >
      {/* Subtle gradient overlay */}
      <View style={styles.discordGradientOverlay} />

      {/* Decorative accent line */}
      <View style={styles.discordAccentLine} />

      {/* Content */}
      <View style={styles.discordContent}>
        <View style={styles.discordHeader}>
          <View style={styles.discordIconContainer}>
            <Ionicons name="logo-discord" size={32} color={COLORS.lime} />
          </View>
          <View style={styles.discordExternalIcon}>
            <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.35)" />
          </View>
        </View>

        <View style={styles.discordTextContainer}>
          <Text style={styles.discordTitle}>Join the éist community</Text>
          <Text style={styles.discordSubtitle}>
            Chat with DJs and listeners, get show alerts, and discover new music
          </Text>
        </View>

        <View style={styles.discordCta}>
          <Text style={styles.discordCtaText}>Open Discord</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.discordBg} />
        </View>
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

        {/* Discord Hero Section */}
        <View style={styles.heroSection}>
          <DiscordHero onPress={() => openUrl('https://discord.gg/4eHnAAUmFN', 'Discord')} />
        </View>

        {/* Other Platforms */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.primary }]}>ALSO FIND US ON</Text>
          <View style={styles.cardsRow}>
            <SocialCard
              icon={<Ionicons name="logo-instagram" size={28} color={COLORS.lime} />}
              title="Instagram"
              subtitle="@eistradio"
              onPress={() => openUrl('https://www.instagram.com/eistradio', 'Instagram')}
            />
            <SocialCard
              icon={<FontAwesomeIcon icon={faMixcloud} size={26} color={COLORS.lime} />}
              title="Mixcloud"
              subtitle="@eistcork"
              onPress={() => openUrl('https://www.mixcloud.com/eistcork/', 'Mixcloud')}
            />
            <SocialCard
              icon={<FontAwesomeIcon icon={faSoundcloud} size={24} color={COLORS.lime} />}
              title="SoundCloud"
              subtitle="@eistcork"
              onPress={() => openUrl('https://soundcloud.com/eistcork', 'SoundCloud')}
            />
          </View>
        </View>
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

  // Discord Hero
  heroSection: {
    marginBottom: 32,
  },
  discordHero: {
    position: 'relative',
    backgroundColor: COLORS.discordBg,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    minHeight: 170,
    borderWidth: 1,
    borderColor: 'rgba(175, 252, 65, 0.12)',
  },
  discordHeroPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
    backgroundColor: COLORS.discordBgLight,
  },
  discordGradientOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '60%',
    height: '100%',
    backgroundColor: 'rgba(175, 252, 65, 0.03)',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  discordAccentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.lime,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  discordContent: {
    position: 'relative',
    zIndex: 1,
  },
  discordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  discordIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(175, 252, 65, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discordTextContainer: {
    marginBottom: 16,
  },
  discordTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  discordSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 20,
  },
  discordCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.lime,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  discordCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.discordBg,
    letterSpacing: -0.2,
  },
  discordExternalIcon: {
    padding: 4,
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
    gap: 10,
  },

  // Cards (smaller for secondary items)
  socialCard: {
    flex: 1,
    backgroundColor: COLORS.limeSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  socialCardPressed: {
    backgroundColor: 'rgba(175, 252, 65, 0.12)',
    transform: [{ scale: 0.98 }],
  },
  socialIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(175, 252, 65, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  socialTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
  },
  socialSubtitle: {
    fontSize: 10,
    opacity: 0.55,
  },
  externalIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
})
