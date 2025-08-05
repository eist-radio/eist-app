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
        // Don't let errors propagate - just log them
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
        // Don't let errors propagate - just log them
    }
    return null
}

const shouldAutoPlayOnCarPlay = async () => {
    try {
        const lastState = await getLastPlayedState()
        if (!lastState) return false

        // Check if the app was playing within the last 24 hours
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000)
        return lastState.wasPlaying && lastState.timestamp > twentyFourHoursAgo
    } catch (error) {
        console.error('Error checking auto-play state:', error)
        return false
    }
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

        console.log('Service: Adding track to queue:', JSON.stringify(trackToAdd, null, 2))
        
        try {
            await TrackPlayer.add(trackToAdd)
            await TrackPlayer.play()
            await storeLastPlayedState(true)
            console.log('Service: Stream started successfully')
        } catch (addError) {
            console.error('Service: TrackPlayer.add or play failed:', addError)
            // Don't let errors propagate - just log them
        }
    } catch (error) {
        console.error('Service: Clean reset and play failed:', error)
        // Don't let errors propagate - just log them
    }
}

// Function to ensure track exists in queue for metadata display
const ensureTrackForDisplay = async () => {
    // Skip on web platform
    if (Platform.OS === 'web') {
        return;
    }

    try {
        const queue = await TrackPlayer.getQueue()
        if (!queue || queue.length === 0) {
            // Add a track for display purposes (stopped state)
            const trackToAdd = {
                id: 'radio-display-' + Date.now(),
                url: STREAM_URL,
                title: 'éist',
                artist: 'éist',
                artwork: require('./assets/images/eist-square.png'),
                isLiveStream: true,
            }
            
            console.log('Service: TrackPlayer.add (ensureTrackForDisplay) - trackToAdd:', JSON.stringify(trackToAdd, null, 2));
            try {
                await TrackPlayer.add(trackToAdd)
            } catch (addError) {
                console.error('Service: TrackPlayer.add failed in ensureTrackForDisplay:', addError)
                // Don't let errors propagate - just log them
            }
        }
    } catch (err) {
        console.error('Service: Ensure track for display failed:', err)
        // Don't let errors propagate - just log them
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
            // Don't let errors propagate - just log them
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
            // Don't let errors propagate - just log them
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
            // Don't let errors propagate - just log them
            // This prevents any potential navigation issues
        }
    })

    // Handle remote play/pause toggle (for compact capabilities)
    TrackPlayer.addEventListener(Event.RemotePlayPause, async () => {
        console.log('Service: Remote PlayPause event received')
        try {
            const state = await TrackPlayer.getPlaybackState();
            if (state.state === State.Playing) {
                console.log('Service: Currently playing, pausing...')
                await TrackPlayer.stop()
                await ensureTrackForDisplay() // Keep metadata visible
                await storeLastPlayedState(false)
            } else {
                console.log('Service: Currently stopped/paused, playing...')
                await cleanResetAndPlay()
            }
        } catch (error) {
            console.error('Service: Error in remote play/pause:', error)
            // Don't let errors propagate - just log them
        }
    })

    // Handle playback state changes
    TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
        console.log('Service: Playback state changed:', state)
        currentPlaybackState = state

        // Ensure metadata display is maintained when stopped
        if (state === State.Stopped) {
            try {
                await ensureTrackForDisplay()
            } catch (error) {
                console.error('Service: Error ensuring track for display:', error)
                // Don't let errors propagate - just log them
            }
        }
    })

    // Handle playback errors
    TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
        console.error('Service: Playback error:', error)

        // Handle audio session interruptions
        if (error.message?.includes('interrupted') ||
            error.message?.includes('session') ||
            error.message?.includes('carplay') ||
            error.message?.includes('android auto') ||
            error.message?.includes('bluetooth')) {
            console.log('Service: Audio session interruption detected')
            try {
                await TrackPlayer.stop()
                await ensureTrackForDisplay()
                await storeLastPlayedState(false)
            } catch (stopError) {
                console.error('Service: Error stopping playback after interruption:', stopError)
                // Don't let errors propagate - just log them
            }
        }
    })

    // Handle queue ended
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
        console.log('Service: Playback queue ended')
        try {
            await ensureTrackForDisplay()
            await storeLastPlayedState(false)
        } catch (error) {
            console.error('Service: Error handling queue ended:', error)
            // Don't let errors propagate - just log them
        }
    })

    // Handle remote next (skip to next track)
    TrackPlayer.addEventListener(Event.RemoteNext, async () => {
        console.log('Service: Remote Next event received - restarting stream for radio')
        try {
            await cleanResetAndPlay()
        } catch (error) {
            console.error('Service: Error in remote next:', error)
            // Don't let errors propagate - just log them
        }
    })

    // Handle remote previous (skip to previous track)
    TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
        console.log('Service: Remote Previous event received - restarting stream for radio')
        try {
            await cleanResetAndPlay()
        } catch (error) {
            console.error('Service: Error in remote previous:', error)
            // Don't let errors propagate - just log them
        }
    })

    // Handle remote seek
    TrackPlayer.addEventListener(Event.RemoteSeek, async ({ position }) => {
        console.log('Service: Remote Seek event received - position:', position)
        // For live radio, seeking doesn't make sense, so we ignore it
        // But we could restart the stream if needed
    })

    // Handle remote jump forward
    TrackPlayer.addEventListener(Event.RemoteJumpForward, async ({ interval }) => {
        console.log('Service: Remote Jump Forward event received - interval:', interval)
        // For live radio, jumping forward doesn't make sense, so we ignore it
    })

    // Handle remote jump backward
    TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({ interval }) => {
        console.log('Service: Remote Jump Backward event received - interval:', interval)
        // For live radio, jumping backward doesn't make sense, so we ignore it
    })
}

export default playbackService;