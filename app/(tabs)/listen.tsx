// listen.tsx
import React from 'react'
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native'
import { useTheme } from '@react-navigation/native'
import { ThemedText } from '@/components/ThemedText'
import { useAudio } from '../../context/AudioContext'
import { Ionicons } from '@expo/vector-icons'

// Make sure you have a PNG here:
const logoImage = require('../../assets/images/eist-logo-header.png')

export default function ListenScreen() {
  const { colors } = useTheme()
  const { isPlaying, togglePlay } = useAudio()
  const { width, height } = Dimensions.get('window')
  const iconName = isPlaying ? 'pause-circle' : 'play-circle'

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.imageContainer, { height: height / 2 }]}>
        <Image
          source={require('../../assets/images/artist.jpeg')}
          style={{ width, height: width }}
          resizeMode="cover"
        />

        {/* logo */}
        <View style={styles.logoContainer}>
          <Image
            source={logoImage}
            style={{
              width: 112,
              height: 112,
            }}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.controlContainer}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <Ionicons name={iconName} size={48} color={colors.primary} />
          </TouchableOpacity>
          <ThemedText
            type="subtitle"
            style={[styles.artistName, { color: colors.text }]}
          >
            Dj Artist name here
          </ThemedText>
        </View>

        <ScrollView
          style={styles.nowPlayingContainer}
          contentContainerStyle={styles.nowPlayingContent}
        >
          <ThemedText
            type="subtitle"
            style={[styles.showTitle, { color: colors.text }]}
          >
            Current Show Title
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.showDescription, { color: colors.text }]}
          >
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.Show description goes here. This will later be pulled from the API.
            {/* …long text… */}
          </ThemedText>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  logoContainer: {
    position: 'absolute',
    bottom: 36,
    right: 24,
  },
  bottom: {
    flex: 1,
    paddingBottom: 12, // breathing room
    alignItems: 'flex-start',
  },
  controlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 6,
  },
  playButton: {
    marginRight: 16,
  },
  artistName: {
    fontSize: 26,
  },
  nowPlayingContainer: {
    flex: 1,
    width: '100%',
  },
  nowPlayingContent: {
    paddingHorizontal: 12,
  },
  showTitle: {
    fontSize: 20,
    marginBottom: 6,
  },
  showDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
})
