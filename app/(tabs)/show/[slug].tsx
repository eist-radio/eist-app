// app/(tabs)/show/[slug].tsx

import { SwipeNavigator } from '@/components/SwipeNavigator';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { apiKey } from '../../../config';
import { stripFormatting } from '../../../utils/stripFormatting';

const STATION_ID = 'eist-radio';
const { width: screenWidth } = Dimensions.get('window');

type RawScheduleItem = {
  id: string;
  stationId: string;
  title: string;
  startDateUtc: string;
  endDateUtc: string;
  description?: { content?: any[] };
  duration: number;
  timezone: string;
  color?: string;
  artistIds?: string[];
  isRecurring: boolean;
  media:
    | { type: 'mix'; trackId?: string }
    | { type: 'playlist'; playlistId: string }
    | { type: 'live' };
};

type Artist = { 
  id: string; 
  name?: string;
  logo?: {
    '256x256'?: string;
    [key: string]: string | undefined;
  };
};

async function fetchEventById(id: string): Promise<RawScheduleItem> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  const startIso = `${today.toISOString().split('T')[0]}T00:00:00Z`;
  const endIso = `${end.toISOString().split('T')[0]}T23:59:59Z`;

  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
    `?startDate=${startIso}&endDate=${endIso}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const json = await res.json();
  const match = (json.schedules || []).find((e: RawScheduleItem) => e.id === id);
  if (!match) throw new Error('Show not found');
  return match;
}

async function fetchHostArtist(artistId: string): Promise<Artist> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${artistId}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const json = await res.json();
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

function formatShowTime(start: string, end: string): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const startTime = startDate
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    })
    .replace(/ (AM|PM)$/, '');

  const endTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  });

  return `${startTime} - ${endTime}`;
}

function formatShowDate(start: string): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startDate = new Date(start);

  const dayName = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: tz,
  });

  const monthName = startDate.toLocaleDateString('en-US', {
    month: 'long',
    timeZone: tz,
  });

  const day = startDate.toLocaleDateString('en-US', {
    day: 'numeric',
    timeZone: tz,
  });

  // Add ordinal suffix to day
  let dayWithSuffix = day;
  if (day.endsWith('1') && day !== '11') {
    dayWithSuffix = day + 'st';
  } else if (day.endsWith('2') && day !== '12') {
    dayWithSuffix = day + 'nd';
  } else if (day.endsWith('3') && day !== '13') {
    dayWithSuffix = day + 'rd';
  } else {
    dayWithSuffix = day + 'th';
  }

  return `${dayName}, ${monthName} ${dayWithSuffix}`;
}

export default function ShowScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const shareViewRef = useRef<ScrollView>(null);
  const shareContentRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [preloadedImageUrl, setPreloadedImageUrl] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);

  // Preload image function (same as listen page)
  const preloadImage = useCallback((uri: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!uri) {
        resolve(false)
        return
      }

      // Check if we're on web or native
      if (Platform.OS === 'web') {
        // Web environment - use standard HTML Image preloading
        try {
          const img = new (global as any).Image()
          img.onload = () => {
            console.log('Image preloaded successfully (web):', uri)
            resolve(true)
          }
          img.onerror = (error: any) => {
            console.log('Image preload failed (web):', error)
            resolve(false)
          }
          img.src = uri
        } catch (error) {
          console.log('Web image preload not supported:', error)
          resolve(true) // Fallback: assume image will load fine
        }
      } else {
        // React Native environment
        if (typeof Image.prefetch === 'function') {
          Image.prefetch(uri)
            .then(() => {
              console.log('Image preloaded successfully:', uri)
              resolve(true)
            })
            .catch((error) => {
              console.log('Image preload failed:', error)
              resolve(false)
            })
        } else {
          console.log('Image.prefetch not available, skipping preload')
          resolve(true)
        }
      }
    })
  }, []);

  if (!slug) {
    return (
      <SwipeNavigator>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <Text style={{ color: colors.notification }}>No show selected.</Text>
        </View>
      </SwipeNavigator>
    );
  }

  const { data: event } = useQuery({
    queryKey: ['show', slug],
    queryFn: () => fetchEventById(slug),
  });

  const hostId = event?.artistIds?.[0];
  const { data: host } = useQuery({
    queryKey: ['artist', hostId],
    queryFn: () => fetchHostArtist(hostId!),
    enabled: Boolean(hostId),
  });

  // Reset image states when host changes
  useEffect(() => {
    setImageFailed(false);
    setPreloadedImageUrl(null);
    setImageReady(false); // Hide image until new host image is ready
  }, [hostId, host?.id]);

  // Extract host image URL for dependency array
  const hostImageUrl = host?.logo?.['256x256'];

  // Preload artist image when host data becomes available
  useEffect(() => {
    const loadArtistImage = async () => {
      // If there's no hostId at all, show fallback immediately
      if (!hostId) {
        setIsImageLoading(false);
        setPreloadedImageUrl(null);
        setImageFailed(false);
        setImageReady(true);
        return;
      }

      // If we have a hostId but no host data yet, wait
      if (hostId && !host) {
        setImageReady(false);
        return;
      }

      // If we have host data but no image URL, show fallback
      if (!hostImageUrl) {
        setIsImageLoading(false);
        setPreloadedImageUrl(null);
        setImageFailed(false);
        setImageReady(true); // No remote image, fallback is ready
        return;
      }

      // We have an image URL, try to preload it
      setIsImageLoading(true);
      
      try {
        const success = await preloadImage(hostImageUrl);
        
        if (success) {
          setPreloadedImageUrl(hostImageUrl);
          setImageFailed(false);
        } else {
          setImageFailed(true);
          setPreloadedImageUrl(null);
        }
      } catch (error) {
        console.error('Image preload error:', error);
        setImageFailed(true);
        setPreloadedImageUrl(null);
      } finally {
        setIsImageLoading(false);
        setImageReady(true); // Image is ready (either preloaded or fallback)
      }
    };

    loadArtistImage();
  }, [hostId, host, hostImageUrl, preloadImage]);

  if (!event) {
    return (
      <SwipeNavigator>
        <View style={[styles.screen, styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SwipeNavigator>
    );
  }

  const plain = stripFormatting(event.description?.content || []);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  const timeString = formatShowTime(event.startDateUtc, event.endDateUtc);
  const dateString = formatShowDate(event.startDateUtc);

  // Determine which image to use - try preloaded artist image first, fallback to schedule image
  const getBannerImage = () => {
    if (imageFailed || !preloadedImageUrl) {
      return require('../../../assets/images/schedule.png');
    }
    
    return { uri: preloadedImageUrl };
  };

  const handleImageError = () => {
    console.log('Host image failed to load, falling back to schedule image');
    setImageFailed(true);
    setPreloadedImageUrl(null);
  };

  const shareShow = async () => {
    if (!shareContentRef.current) {
      Alert.alert('Error', 'Content not ready for sharing');
      return;
    }
    
    setIsSharing(true);
    try {
      // Longer delay to ensure logo renders and view is fully updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Double-check ref is still valid
      if (!shareContentRef.current) {
        throw new Error('Share content ref is null');
      }

      // Create a share-optimized view capture of just the content (excluding share button)
      const uri = await captureRef(shareContentRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: screenWidth,
      });

      // Resize image maintaining aspect ratio for optimal sharing
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }], // Only specify width, let height adjust proportionally
        { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
      );

      // Check if sharing is available and share image directly
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(manipulatedImage.uri, {
          mimeType: 'image/png',
        });
      } else {
        // Fallback for platforms without native sharing
        Alert.alert(
          'Share Not Available',
          'Sharing is not supported on this device',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Share creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Share Failed', 
        `Unable to create share image: ${errorMessage}. Please try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SwipeNavigator>
      <ScrollView
        ref={shareViewRef}
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        <View 
          ref={shareContentRef} 
          style={styles.shareableContent}
          collapsable={false}
        >
          <View style={styles.bannerContainer}>
            {imageReady ? (
              <Image
                key={`${hostId}-${preloadedImageUrl || 'fallback'}`}
                source={getBannerImage()}
                style={styles.bannerImage}
                resizeMode="cover"
                onError={handleImageError}
              />
            ) : (
              <View style={[styles.bannerImage, { backgroundColor: colors.card }]} />
            )}
            {isImageLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          </View>

          {/* All content - inside shareable content */}
          <View style={styles.shareableTitle}>
            <ThemedText
              type="subtitle"
              style={[styles.header, { color: colors.primary }]}
            >
              {event.title}
            </ThemedText>
          </View>

          <View style={styles.shareableText}>
            {host?.name && (
              <View style={styles.hostRow}>
                <TouchableOpacity
                  onPress={() => hostId && router.push(`/artist/${hostId}`)}
                  disabled={!hostId}
                >
                  <ThemedText
                    type="default"
                    style={[styles.hostText, { color: colors.primary }]}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                  >
                    {host.name}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dateTimeRow}>
              <ThemedText
                type="default"
                style={[styles.dateText, { color: colors.text }]}
              >
                {dateString}
              </ThemedText>
              <ThemedText
                type="default"
                style={[styles.timeText, { color: colors.text }]}
              >
                {timeString}
              </ThemedText>
            </View>

            <View style={styles.textContainer}>
              {paragraphs.map((p, i) => (
                <ThemedText
                  key={i}
                  type="default"
                  style={[styles.bodyText, { color: colors.text }]}
                >
                  {p}
                </ThemedText>
              ))}
            </View>
          </View>
        </View>

        {/* Share button positioned outside shareable content */}
        <View style={styles.shareButtonAbsolute}>
          <TouchableOpacity 
            onPress={shareShow} 
            style={styles.shareButtonInline}
            disabled={isSharing}
            accessibilityLabel="Share show"
            accessibilityHint="Share this show information as an image"
            accessibilityRole="button"
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="share-outline" size={28} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SwipeNavigator>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 0,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'flex-start',
    paddingBottom: 24,
  },
  bannerContainer: {
    width: screenWidth,
    height: screenWidth,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },

  header: {
    fontSize: 28,
    fontWeight: '700',
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 32,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '400',
    fontStyle: 'italic',
    marginHorizontal: 2,
    marginVertical: 2,
    marginRight: 6,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '400',
    fontStyle: 'italic',
    marginHorizontal: 2,
    marginVertical: 2,
  },
  hostRow: {
    marginBottom: 6,
    paddingRight: 60, // Extra space to avoid share button collision
  },
  hostText: {
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 22,
    marginHorizontal: 2,
    marginVertical: 2,
    flexWrap: 'wrap',
  },
  textContainer: {
    width: '100%',
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 22,
    marginHorizontal: 2,
    marginVertical: 2,
    marginBottom: 12,
    textAlign: 'left',
  },

  desaturateOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  gauzeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#AFFC41',
    opacity: 0.2,
  },
  shareableContent: {
    width: '100%',
    backgroundColor: '#4733FF',
  },

  shareableTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 2,
    paddingRight: 60, // Extra space for share button
  },

  shareableText: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  shareButtonInline: {
    padding: 12, // Increased for better touch target (52x52 total)
    borderRadius: 8,
  },

  shareButtonAbsolute: {
    position: 'absolute',
    top: screenWidth + 16, // Banner height + title padding
    right: 16,
    zIndex: 1,
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

});
