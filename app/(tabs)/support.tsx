// app/(tabs)/support.tsx

import { Ionicons } from '@expo/vector-icons'
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

type LinkCardProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
  onPress: () => void
  highlight?: boolean
}

const LinkCard = ({ icon, title, description, onPress, highlight }: LinkCardProps) => {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.linkCard,
        highlight && styles.linkCardHighlight,
        pressed && styles.linkCardPressed,
      ]}
    >
      <View style={[styles.linkIconWrapper, highlight && styles.linkIconHighlight]}>
        <Ionicons name={icon} size={24} color={COLORS.lime} />
      </View>
      <View style={styles.linkContent}>
        <Text style={[styles.linkTitle, { color: colors.primary }]}>{title}</Text>
        <Text style={[styles.linkDescription, { color: colors.text }]}>{description}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.primary} style={{ opacity: 0.5 }} />
    </Pressable>
  )
}

export default function SupportScreen() {
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
          <Text style={[styles.title, { color: colors.primary }]}>Support</Text>
          <Pressable
            style={styles.logoContainer}
            onPress={() => Linking.openURL('https://eist.radio/support')}
            accessibilityRole="link"
          >
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          </Pressable>
        </View>

        {/* Hero message */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroText, { color: colors.text }]}>
            éist is a volunteer-run internet radio station based in Cork, Ireland.
          </Text>
          <Text style={[styles.heroSubtext, { color: colors.text }]}>
            Your support helps us stay on air and continue bringing you great music.
          </Text>
        </View>

        {/* Support Options */}
        <View style={styles.linksSection}>
          <LinkCard
            icon="heart"
            title="Donate"
            description="Help keep éist on air"
            onPress={() => openUrl('https://eist.radio/support', 'Donate')}
            highlight
          />
          <LinkCard
            icon="globe-outline"
            title="Website"
            description="eist.radio"
            onPress={() => openUrl('https://eist.radio', 'Website')}
          />
          <LinkCard
            icon="mail-outline"
            title="Contact"
            description="Get in touch with us"
            onPress={() => openUrl('mailto:hello@eist.radio', 'Email')}
          />
        </View>

        {/* Listen elsewhere */}
        <View style={styles.listenSection}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>LISTEN ELSEWHERE</Text>
          <View style={styles.listenLinks}>
            <Pressable
              style={styles.listenLink}
              onPress={() => openUrl('https://www.mixcloud.com/eistcork/', 'Mixcloud')}
            >
              <Text style={[styles.listenLinkText, { color: colors.text }]}>Mixcloud</Text>
              <Ionicons name="open-outline" size={14} color={colors.text} style={{ opacity: 0.4 }} />
            </Pressable>
            <Text style={[styles.listenDivider, { color: colors.text }]}>·</Text>
            <Pressable
              style={styles.listenLink}
              onPress={() => openUrl('https://soundcloud.com/eistcork', 'SoundCloud')}
            >
              <Text style={[styles.listenLinkText, { color: colors.text }]}>SoundCloud</Text>
              <Ionicons name="open-outline" size={14} color={colors.text} style={{ opacity: 0.4 }} />
            </Pressable>
          </View>
        </View>

        {/* Version */}
        <Text style={[styles.versionText, { color: colors.text }]}>
          App version 1.0.0
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
    marginBottom: 24,
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

  // Hero
  heroSection: {
    marginBottom: 32,
  },
  heroText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 8,
  },
  heroSubtext: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.7,
  },

  // Links
  linksSection: {
    gap: 12,
    marginBottom: 32,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.limeSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    padding: 16,
  },
  linkCardHighlight: {
    backgroundColor: 'rgba(175, 252, 65, 0.1)',
    borderColor: 'rgba(175, 252, 65, 0.3)',
  },
  linkCardPressed: {
    backgroundColor: 'rgba(175, 252, 65, 0.15)',
  },
  linkIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(175, 252, 65, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  linkIconHighlight: {
    backgroundColor: 'rgba(175, 252, 65, 0.2)',
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  linkDescription: {
    fontSize: 13,
    opacity: 0.6,
  },

  // Listen elsewhere
  listenSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.7,
  },
  listenLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listenLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listenLinkText: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.8,
  },
  listenDivider: {
    opacity: 0.4,
  },

  // Version
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.35,
    marginTop: 8,
  },
})
