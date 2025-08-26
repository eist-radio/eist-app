// app/(tabs)/artist/[slug].tsx

import { SelectableText } from '@/components/SelectableText';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { apiKey } from '../../../config';
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

type RawArtist = {
  id: string;
  name?: string;
  description?: { content?: any[] };
  logo?: {
    default?: string;
    '256x256'?: string;
    '512x512'?: string;
    '1024x1024'?: string;
  };
  socials?: {
    twitterHandle?: string;
    instagramHandle?: string;
    facebook?: string;
    mixcloud?: string;
    soundcloud?: string;
    site?: string;
  };
  tags?: string[];
};

function extractTagValue(tags: string[] | undefined, prefix: string): string | undefined {
  if (!tags) return undefined;
  const found = tags.find((t) => t.startsWith(prefix));
  return found ? found.replace(prefix, '').toLowerCase() : undefined;
}

async function fetchArtistBySlug(slug: string): Promise<RawArtist> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  if (!res.ok) throw new Error(`Artist fetch failed: ${res.statusText}`);
  const json = (await res.json()) as { artist?: RawArtist };
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

export default function ArtistScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  // Move all hooks to the top before any conditional returns
  const { data: artist } = useQuery({
    queryKey: ['artist', slug],
    queryFn: () => fetchArtistBySlug(slug || ''),
    enabled: !!slug, // Only run query if slug exists
  });

  const fallbackImage = require('../../../assets/images/eist_online.png');
  const [imageFailed, setImageFailed] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [preloadedImageUrl, setPreloadedImageUrl] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Preload image function (same as other pages)
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
            resolve(true)
          }
          img.onerror = () => {
            resolve(false)
          }
          img.src = uri
        } catch {
          resolve(true) // Fallback: assume image will load fine
        }
      } else {
        // React Native environment
        if (typeof Image.prefetch === 'function') {
          Image.prefetch(uri)
            .then(() => {
              resolve(true)
            })
            .catch(() => {
              resolve(false)
            })
        } else {
          resolve(true)
        }
      }
    })
  }, []);

  // Reset image states when artist changes
  useEffect(() => {
    setImageFailed(false);
    setPreloadedImageUrl(null);
    setImageReady(false); // Hide image until new artist image is ready
  }, [slug, artist?.id]);

  // Preload artist image when artist data becomes available
  useEffect(() => {
    const loadArtistImage = async () => {
      // If there's no artist data yet, wait
      if (!artist) {
        setIsImageLoading(false);
        setImageReady(false); // Still loading artist data
        return;
      }

      // Check for any available image
      const remoteImage =
        artist.logo?.['1024x1024'] ||
        artist.logo?.['512x512'] ||
        artist.logo?.['256x256'] ||
        artist.logo?.default;
      
      // If artist exists but has no image, show fallback
      if (!remoteImage) {
        setIsImageLoading(false);
        setPreloadedImageUrl(null);
        setImageFailed(false);
        setImageReady(true); // No remote image, show fallback
        return;
      }

      // We have an image URL, try to preload it
      setIsImageLoading(true);
      
      try {
        const success = await preloadImage(remoteImage);
        
        if (success) {
          setPreloadedImageUrl(remoteImage);
          setImageFailed(false);
        } else {
          setPreloadedImageUrl(null);
          setImageFailed(true);
        }
      } catch {
        setPreloadedImageUrl(null);
        setImageFailed(true);
      } finally {
        setIsImageLoading(false);
        setImageReady(true);
      }
    };

    loadArtistImage();
  }, [artist, preloadImage]);

  const handleSwipeGesture = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Check for right swipe: positive translation and velocity
      if (translationX > 50 && velocityX > 500) {
        router.back();
      }
    }
  }, [router]);

  if (!slug) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>
          No artist specified.
        </Text>
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>
          Loading artist...
        </Text>
      </View>
    );
  }

  // Use preloaded image instead of direct remote image
  const imageSource =
    imageFailed || !preloadedImageUrl
      ? fallbackImage
      : { uri: preloadedImageUrl };

  const plain = stripFormatting(artist.description?.content);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  const socials = artist.socials ?? {};
  const tags = artist.tags ?? [];

  const entries: [string, string][] = [];

  if (socials.site) entries.push(['Website', socials.site]);
  if (socials.twitterHandle)
    entries.push(['Twitter', `https://twitter.com/${socials.twitterHandle}`]);
  if (socials.instagramHandle)
    entries.push(['Instagram', `https://instagram.com/${socials.instagramHandle}`]);
  if (socials.facebook)
    entries.push(['Facebook', `https://facebook.com/${socials.facebook}`]);
  if (socials.mixcloud)
    entries.push(['Mixcloud', `https://mixcloud.com/${socials.mixcloud}`]);
  if (socials.soundcloud)
    entries.push(['SoundCloud', `https://soundcloud.com/${socials.soundcloud}`]);

  const mcUsername = extractTagValue(tags, 'MC-USERNAME_');
  const scUsername = extractTagValue(tags, 'SC-USERNAME_');
  const hostScPlaylist = extractTagValue(tags, 'HOST-SC-PLAYLIST_');
  const hostMcPlaylist = extractTagValue(tags, 'HOST-MC-PLAYLIST_');
  const eistMcPlaylist = extractTagValue(tags, 'EIST-MC-PLAYLIST_');

  if (scUsername && hostScPlaylist) {
    entries.push([
      'SoundCloud archive',
      `https://soundcloud.com/${scUsername}/sets/${hostScPlaylist}`,
    ]);
  }

  if (eistMcPlaylist) {
    entries.push([
      'éist archive',
      `https://www.mixcloud.com/eistcork/playlists/${eistMcPlaylist}`,
    ]);
  }

  if (mcUsername && hostMcPlaylist) {
    entries.push([
      'Mixcloud archive',
      `https://mixcloud.com/${mcUsername}/playlists/${hostMcPlaylist}`,
    ]);
  }

  const openLink = (url: string) =>
    Linking.canOpenURL(url).then((ok) => ok && Linking.openURL(url));

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
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ 
        y: 0, 
        animated: true 
      })
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <PanGestureHandler onHandlerStateChange={handleSwipeGesture}>
          <View style={{ flex: 1 }}>
            <View style={styles.avatarContainer}>
          {imageReady ? (
            <Image
              key={`${artist.id}-${preloadedImageUrl || 'fallback'}`}
              source={imageSource}
              style={styles.fullWidthAvatar}
              resizeMode="cover"
              onError={(error) => {
                setImageFailed(true);
                setPreloadedImageUrl(null);
              }}
            />
          ) : (
            <View style={[styles.fullWidthAvatar, { backgroundColor: colors.card }]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.2)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {isImageLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.contentContainer}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.titleRow}>
            <Ionicons
              name="headset-outline"
              size={36}
              color={colors.primary}
              style={styles.icon}
            />
            <ThemedText
              type="subtitle"
              style={[styles.header, { color: colors.primary }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {artist.name || 'Unnamed Artist'}
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

            {entries.length > 0 && (
              <View style={styles.linkRow}>
                {entries.map(([label, url], idx) => (
                  <React.Fragment key={label}>
                    <TouchableOpacity onPress={() => openLink(url)}>
                      <Text style={[styles.linkText, { color: colors.primary }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                    {idx < entries.length - 1 && (
                      <Text style={[styles.separator, { color: colors.text }]}>
                        {' / '}
                      </Text>
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
            </ScrollView>
            <BackToTopButton
              onPress={scrollToTop}
              visible={showBackToTop && isScrollable}
            />
          </View>
        </PanGestureHandler>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 0,
  },
  content: {
    alignItems: 'flex-start',
    paddingBottom: 24,
  },
  contentContainer: {
    flex: 1,
  },
  avatarContainer: {
    width: screenWidth,
    height: screenWidth,
    position: 'relative',
  },
  fullWidthAvatar: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
  },
  icon: {
    marginRight: 8,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 32,
  },
  textContainer: {
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'left',
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 18,
    fontWeight: '600',
  },
  separator: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    // No specific styling needed, icon will handle its own size
  },
});
