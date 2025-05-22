// listen.tsx
import React from 'react'
import {
  View, StyleSheet, Image, TouchableOpacity,
  Dimensions, ScrollView,
} from 'react-native'
import { SvgUri } from 'react-native-svg';
import { Asset } from 'expo-asset';
import { useTheme } from '@react-navigation/native'
import { ThemedText } from '@/components/ThemedText'
import { useAudio } from '../../context/AudioContext'
import { Ionicons } from '@expo/vector-icons'
import EistLogo from '../../assets/images/eist-logo-header.svg';

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

        {/* logo with drop shadow */}
        <View style={styles.logoContainer}>
          <EistLogo
            width={96}
            height={96}
            fill={colors.primary}
          />
        </View>

      </View>

      <View style={styles.bottom}>

        <View style={styles.controlContainer}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <Ionicons name={iconName} size={48} color={colors.primary} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={[styles.artistName, { color: colors.text }]}>
            Dj Artist name here
          </ThemedText>
        </View>

        <ScrollView
          style={styles.nowPlayingContainer}
          contentContainerStyle={styles.nowPlayingContent}
        >
          <ThemedText type="subtitle" style={[styles.showTitle, { color: colors.text }]}>
            Current Show Title
          </ThemedText>
          <ThemedText type="body" style={[styles.showDescription, { color: colors.text }]}>
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            Show description goes here. This will later be pulled from the API.
            {/* …long text… */}
          </ThemedText>
        </ScrollView>
      </View>
    </View>
    )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  imageContainer: {
    width: '100%', position: 'relative', overflow: 'hidden',
  },
  logoContainer: {
    position: 'absolute',
    top: 10,
    right: 16,
    // iOS shadow:
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    // Android shadow:
    elevation: 2,
  },
  bottom: {
    flex: 1, paddingTop: 24, paddingBottom: 24,
    paddingLeft: 0, paddingRight: 0, alignItems: 'flex-start',
  },
  title: {
    fontSize: 24, marginBottom: 24,
    alignSelf: 'stretch', textAlign: 'center',
  },
  controlContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 24, paddingLeft: 24,
  },
  playButton: { marginRight: 16 },
  artistName: { fontSize: 18 },
  nowPlayingContainer: { flex: 1, width: '100%' },
  nowPlayingContent: { paddingHorizontal: 24 },
  showTitle: { fontSize: 20, marginBottom: 8 },
  showDescription: { fontSize: 16, lineHeight: 22 },
})
