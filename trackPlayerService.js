// trackPlayerService.js

import { Platform } from 'react-native';

// Only import TrackPlayer on mobile platforms
let TrackPlayer, Event, State;
if (Platform.OS !== 'web') {
  const trackPlayerModule = require('@vmsilva/react-native-track-player');
  TrackPlayer = trackPlayerModule.default;
  Event = trackPlayerModule.Event;
  State = trackPlayerModule.State;
}

// Track current playback state internally
let currentPlaybackState = State?.None || 'none';

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream'

// Storage keys for remembering last played state
const LAST_PLAYED_KEY = 'eist_last_played_timestamp'
const WAS_PLAYING_KEY = 'eist_was_playing'

// Helper functions for storing/retrieving last played state
const storeLastPlayedState = async (wasPlaying) => {
    try {
        const AsyncStorage = await import('@react-native-async-storage/async-storage')
        await AsyncStorage.default.setItem(LAST_PLAYED_KEY, Date.now().toString())
        await AsyncStorage.default.setItem(WAS_PLAYING_KEY, wasPlaying.toString())
    } catch (error) {
        console.error('Failed to store last played state:', error)
    }
}

const getLastPlayedState = async () => {
    try {
        const AsyncStorage = await import('@react-native-async-storage/async-storage')
        const timestamp = await AsyncStorage.default.getItem(LAST_PLAYED_KEY)
        const wasPlaying = await AsyncStorage.default.getItem(WAS_PLAYING_KEY)

        if (timestamp && wasPlaying) {
            return {
                timestamp: parseInt(timestamp, 10),
                wasPlaying: wasPlaying === 'true'
            }
        }
    } catch (error) {
        console.error('Failed to get last played state:', error)
    }
    return null
}

const shouldAutoPlayOnCarPlay = async () => {
    const lastState = await getLastPlayedState()
    if (!lastState) return false

    // Check if the app was playing within the last 24 hours
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000)
    return lastState.wasPlaying && lastState.timestamp > twentyFourHoursAgo
}

// Clean reset function for fresh stream
const cleanResetAndPlay = async () => {
    // Skip on web platform
    if (Platform.OS === 'web') {
        return;
    }

    try {
        console.log('Service: Performing clean reset and play...')

        // Stop current playback
        await TrackPlayer.stop().catch(() => { })

        // Get current queue to preserve metadata
        const currentQueue = await TrackPlayer.getQueue().catch(() => [])
        const currentTrack = currentQueue[0]

        // Reset queue to clear any buffered data
        await TrackPlayer.reset().catch(() => { })

        // Small delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 100))

        // Re-add fresh stream track with preserved or default metadata
        const trackToAdd = {
            id: 'radio-stream-' + Date.now(),
            url: STREAM_URL,
            title: currentTrack?.title || 'éist',
            artist: currentTrack?.artist || 'éist',
            artwork: currentTrack?.artwork || require('./assets/images/eist-square.png'),
            isLiveStream: true,
        }

        console.log('TrackPlayer.add (service) - trackToAdd:', JSON.stringify(trackToAdd, null, 2));
        try {
            await TrackPlayer.add(trackToAdd)
        } catch (addError) {
            console.error('TrackPlayer.add (service) failed:', addError)
            throw addError
        }

        // Start fresh playback
        await TrackPlayer.play()
        await storeLastPlayedState(true)

        console.log('Service: Clean reset and play completed')
    } catch (err) {
        console.error('Service: Clean reset and play failed:', err)
    }
}

// Ensure track exists for metadata display when stopped
const ensureTrackForDisplay = async () => {
    // Skip on web platform
    if (Platform.OS === 'web') {
        return;
    }

    try {
        const queue = await TrackPlayer.getQueue()
        if (!queue || queue.length === 0) {
            const trackToAdd = {
                id: 'radio-stream-' + Date.now(),
                url: STREAM_URL,
                title: 'éist',
                artist: 'éist',
                artwork: require('./assets/images/eist-square.png'),
                isLiveStream: true,
            }
            
            console.log('TrackPlayer.add (service ensureTrackForDisplay) - trackToAdd:', JSON.stringify(trackToAdd, null, 2));
            try {
                await TrackPlayer.add(trackToAdd)
            } catch (addError) {
                console.error('TrackPlayer.add (service ensureTrackForDisplay) failed:', addError)
                throw addError
            }
        }
    } catch (err) {
        console.error('Service: Failed to ensure track for display:', err)
    }
}

const playbackService = async () => {
    // Skip on web platform
    if (Platform.OS === 'web') {
        return;
    }

    // Handle remote play from CarPlay, Control Center, lock screen
    TrackPlayer.addEventListener(Event.RemotePlay, async () => {
        console.log('Service: Remote Play event received (CarPlay/Control Center)')
        try {
            // Always perform clean reset and start fresh stream
            await cleanResetAndPlay()
        } catch (error) {
            console.error('Service: Error in remote play:', error)
        }
    })

    // Handle remote stop from CarPlay, Control Center, lock screen
    TrackPlayer.addEventListener(Event.RemoteStop, async () => {
        console.log('Service: Remote Stop event received')
        try {
            await TrackPlayer.stop()
            await ensureTrackForDisplay() // Keep metadata visible
            await storeLastPlayedState(false)
        } catch (error) {
            console.error('Service: Error in remote stop:', error)
        }
    })

    // Handle remote pause
    TrackPlayer.addEventListener(Event.RemotePause, async () => {
        console.log('Service: Remote Pause event received - treating as stop for radio')
        try {
            await TrackPlayer.stop()
            await ensureTrackForDisplay() // Keep metadata visible
            await storeLastPlayedState(false)
        } catch (error) {
            console.error('Service: Error in remote pause:', error)
        }
    })

    // Handle playback state changes
    TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
        console.log('Service: Playback state changed:', state)
        
        // Update our internal state tracking
        currentPlaybackState = state;

        // Ensure metadata display is maintained when stopped
        if (state === State.Stopped) {
            await ensureTrackForDisplay()
        }

        // Handle CarPlay auto-resume when audio session becomes ready
        if (state === State.Ready) {
            try {
                const shouldAutoPlay = await shouldAutoPlayOnCarPlay()
                if (shouldAutoPlay) {
                    console.log('Service: Audio ready, checking for CarPlay auto-resume')
                    // Small delay to ensure CarPlay connection is stable
                    setTimeout(async () => {
                        try {
                            // Use our tracked state instead of calling getState()
                            if (currentPlaybackState === State.Ready) {
                                console.log('Service: Auto-resuming on CarPlay connection')
                                await cleanResetAndPlay()
                            }
                        } catch (error) {
                            console.error('Service: Error during CarPlay auto-resume:', error)
                        }
                    }, 1000)
                }
            } catch (error) {
                console.error('Service: Error checking CarPlay auto-resume:', error)
            }
        }
    })

    // Handle playback errors and audio session interruptions
    TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
        console.error('Service: Playback error:', error)

        // For audio session interruptions, just store the playing state
        // Recovery will be handled by the context when the app becomes active
        if (error.message?.includes('interrupted') ||
            error.message?.includes('session') ||
            error.message?.includes('audio') ||
            error.message?.includes('conflict')) {
            console.log('Service: Audio session interruption detected')
            await storeLastPlayedState(true) // Remember we were playing
        }
    })
}

export default playbackService