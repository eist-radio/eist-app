// app/(tabs)/discord.tsx

import { SelectableThemedText } from '@/components/SelectableThemedText'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'
import React, { useState } from 'react'
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

// éist brand colors (matching artist page)
const COLORS = {
  eist: '#4733FF',
  lime: '#AFFC41',
  limeSubtle: 'rgba(175, 252, 65, 0.08)',
  limeBorder: 'rgba(175, 252, 65, 0.25)',
}

// Feature item component
const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
  const { colors } = useTheme()
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <Ionicons name={icon as any} size={18} color={COLORS.lime} />
      </View>
      <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
    </View>
  )
}

export default function DiscordScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [isLoading, setIsLoading] = useState(false)
  const [buttonPressed, setButtonPressed] = useState(false)

  const joinDiscord = async () => {
    setIsLoading(true)
    try {
      const url = 'https://discord.gg/4eHnAAUmFN'
      const canOpen = await Linking.canOpenURL(url)

      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert(
          'Cannot Open Discord',
          'Unable to open Discord. Please make sure you have an internet connection or the Discord app installed.',
          [{ text: 'OK' }]
        )
      }
    } catch {
      Alert.alert('Error', 'Failed to open Discord. Please try again later.', [{ text: 'OK' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 48 }]}
    >
      {/* Header with title and logo */}
      <View style={styles.titleContainer}>
        <SelectableThemedText style={[styles.title, { color: colors.primary }]}>
          Discord
        </SelectableThemedText>
        <Pressable
          style={styles.logoContainer}
          onPress={() => Linking.openURL('https://eist.radio/support')}
          accessibilityRole="link"
        >
          <View style={styles.logoBackground}>
            <Image source={logoImage} style={{ width: 57, height: 57 }} resizeMode="contain" />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Discord Icon Card */}
        <View style={styles.iconCard}>
          <View style={styles.iconWrapper}>
            <Ionicons name="logo-discord" size={64} color={COLORS.lime} />
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.descriptionSection}>
          <Text style={[styles.heading, { color: colors.primary }]}>Join the Community</Text>
          <Text style={[styles.description, { color: colors.text }]}>
            Connect with fellow listeners, chat with DJs, and stay updated on upcoming shows and
            events.
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.primary + '25' }]} />

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionLabel, { color: colors.primary + '99' }]}>WHAT TO EXPECT</Text>
          <View style={styles.featuresList}>
            <FeatureItem icon="chatbubbles-outline" text="Live chat during broadcasts" />
            <FeatureItem icon="musical-notes-outline" text="Music recommendations & discovery" />
            <FeatureItem icon="notifications-outline" text="Show announcements & updates" />
            <FeatureItem icon="people-outline" text="A friendly community of music lovers" />
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.primary + '25' }]} />

        {/* Join Button */}
        <View style={styles.buttonSection}>
          <Pressable
            onPressIn={() => setButtonPressed(true)}
            onPressOut={() => setButtonPressed(false)}
            onPress={joinDiscord}
            disabled={isLoading}
            style={[
              styles.joinButton,
              buttonPressed && styles.joinButtonPressed,
              isLoading && styles.joinButtonDisabled,
            ]}
          >
            <Ionicons
              name="logo-discord"
              size={20}
              color={buttonPressed ? COLORS.lime : COLORS.eist}
              style={styles.buttonIcon}
            />
            <Text
              style={[styles.buttonText, buttonPressed && styles.buttonTextPressed]}
            >
              {isLoading ? 'Opening...' : 'Join the Discord Server'}
            </Text>
          </Pressable>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    paddingTop: 10,
  },
  logoContainer: {
    position: 'absolute',
    top: -44,
    right: 5,
  },
  logoBackground: {
    borderRadius: 26,
    padding: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Icon Card
  iconCard: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.limeSubtle,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Description Section
  descriptionSection: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.85,
  },

  // Divider
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 24,
  },

  // Features Section
  featuresSection: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.limeSubtle,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },

  // Button Section
  buttonSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lime,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.lime,
  },
  joinButtonPressed: {
    backgroundColor: 'transparent',
    borderColor: COLORS.lime,
  },
  joinButtonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: COLORS.eist,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  buttonTextPressed: {
    color: COLORS.lime,
  },

  bottomSpacer: {
    height: 24,
  },
})
