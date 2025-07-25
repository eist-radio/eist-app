// app/(tabs)/show/[slug].tsx

import { SelectableText } from '@/components/SelectableText';
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
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { FormattedShowTitle } from '../../../components/FormattedShowTitle';
import { apiKey } from '../../../config';
import { useTimezoneChange } from '../../../hooks/useTimezoneChange';
import { stripFormatting } from '../../../utils/stripFormatting';

const BackToTopButton = ({ onPress, visible }: { onPress: () => void; visible: boolean }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current
  
  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [visible, animatedValue])
  
  return (
    <Animated.View
      style={[
        styles.backToTopButton,
        { 
          opacity: animatedValue,
          transform: [{
            scale: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            })
          }]
        }
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.backToTopTouchable}
      >
        <Ionicons 
          name="chevron-up" 
          size={32} 
          color="#AFFC41" 
          style={styles.chevronIcon}
        />
      </TouchableOpacity>
    </Animated.View>
  )
}

const STATION_ID = 'eist-radio';
const { width: screenWidth } = Dimensions.get('window');

const logoImage = require('../../../assets/images/eist-logo-header.png')

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
    default?: string;
    '256x256'?: string;
    '512x512'?: string;
    '1024x1024'?: string;
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

function formatShowTime(start: string, end: string, timezone: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startTime = startDate
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
    .replace(/ (AM|PM)$/, '');

  const endTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  return `${startTime} - ${endTime}`;
}

function formatShowDate(start: string, timezone: string): string {
  const startDate = new Date(start);

  const dayName = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: timezone,
  });

  const monthName = startDate.toLocaleDateString('en-US', {
    month: 'long',
    timeZone: timezone,
  });

  const day = startDate.toLocaleDateString('en-US', {
    day: 'numeric',
    timeZone: timezone,
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
  const currentTimezone = useTimezoneChange();
  const shareViewRef = useRef<ScrollView>(null);
  const shareContentRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [preloadedImageUrl, setPreloadedImageUrl] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [hideShareButton, setHideShareButton] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  // Extract host image URL for dependency array (same priority as artist page)
  const hostImageUrl = host?.logo?.['1024x1024'] ||
    host?.logo?.['512x512'] ||
    host?.logo?.['256x256'] ||
    host?.logo?.default;

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

  const timeString = formatShowTime(event.startDateUtc, event.endDateUtc, currentTimezone);
  const dateString = formatShowDate(event.startDateUtc, currentTimezone);

  // Determine which image to use - try preloaded artist image first, fallback to eist online image
  const getBannerImage = () => {
    if (imageFailed || !preloadedImageUrl) {
      return require('../../../assets/images/eist_online.png');
    }
    
    return { uri: preloadedImageUrl };
  };



  const shareShow = async () => {
    if (!shareContentRef.current) {
      Alert.alert('Error', 'Content not ready for sharing');
      return;
    }
    
    setIsSharing(true);
    setHideShareButton(true); // Hide share button before screenshot
    
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
      setHideShareButton(false); // Show share button again after screenshot
    }
  };

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
    
    // Check if content is scrollable
    const scrollable = contentHeight > layoutHeight
    setIsScrollable(scrollable)
    
    // Show back button when scrolled past 100px AND content is scrollable
    setShowBackToTop(scrollable && scrollY > 100)
  }

  const scrollToTop = () => {
    shareViewRef.current?.scrollTo({ y: 0, animated: true })
  }

  return (
    <SwipeNavigator>
      <ScrollView
        ref={shareViewRef}
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
                onError={(error) => {
                  console.log('Image load error:', error.nativeEvent.error);
                  setImageFailed(true);
                  setPreloadedImageUrl(null);
                }}
                onLoad={() => {
                  console.log('Image loaded successfully');
                }}
              />
            ) : (
              <View style={[styles.bannerImage, { backgroundColor: colors.card }]} />
            )}
            {isImageLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            <TouchableOpacity
              style={styles.logoContainer}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('https://eist.radio/support')}
              accessibilityRole="link"
            >
              <View style={styles.logoBackground}>
                <Image
                  source={logoImage}
                  style={{ width: 81.4, height: 81.4 }}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* All content - inside shareable content */}
          <View style={styles.shareableTitle}>
            <View style={[
              styles.titleRow, 
              hideShareButton && { justifyContent: 'flex-start' }
            ]}>
              <FormattedShowTitle
                title={event.title}
                color={colors.primary}
                size={28}
                style={styles.header}
              />
              {!hideShareButton && (
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
              )}
            </View>
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
                <SelectableText
                  key={i}
                  text={p}
                  style={[styles.bodyText, { color: colors.text }]}
                  linkStyle={{ color: colors.primary }}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
              <BackToTopButton
          onPress={scrollToTop}
          visible={showBackToTop && isScrollable}
        />
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
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },

  shareableText: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  shareButtonInline: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
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
  logoContainer: { 
    position: 'absolute', 
    top: 36, 
    right: 18 
  },
  logoBackground: { 
    borderRadius: 37, 
    padding: 8,
  },

  backToTopButton: {
    position: 'absolute',
    bottom: 20,
    left: '45%',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToTopTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {
    // No specific styling needed, icon will be centered
  },

});
