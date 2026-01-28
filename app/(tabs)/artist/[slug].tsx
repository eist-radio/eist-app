// app/(tabs)/artist/[slug].tsx

import { ArchiveShowCard } from '@/components/ArchiveShowCard';
import { SelectableText } from '@/components/SelectableText';
import { useArchiveShowsByArtist } from '@/hooks/useArchiveShows';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { apiKey } from '../../../config';
import { stripFormatting } from '../../../utils/stripFormatting';

// éist brand colors
const COLORS = {
  eist: '#4733FF',
  eistDark: '#3525CC',
  lime: '#AFFC41',
  limeSubtle: 'rgba(175, 252, 65, 0.15)',
  limeBorder: 'rgba(175, 252, 65, 0.35)',
  highlight: '#96BFE6',
  white: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
};

const BackToTopButton = ({
  onPress,
  visible,
}: {
  onPress: () => void;
  visible: boolean;
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [visible, animatedValue]);

  return (
    <Animated.View
      style={[
        styles.backToTopButton,
        {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.backToTopTouchable}
      >
        <Ionicons name="chevron-up" size={24} color={COLORS.eist} />
      </TouchableOpacity>
    </Animated.View>
  );
};

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

// Social icon button component
const SocialButton = ({
  icon,
  iconPack = 'ionicons',
  onPress,
  label,
}: {
  icon: string;
  iconPack?: 'ionicons' | 'fontawesome';
  onPress: () => void;
  label: string;
}) => {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[styles.socialButton, pressed && styles.socialButtonPressed]}
      accessibilityLabel={label}
    >
      {iconPack === 'fontawesome' ? (
        <FontAwesome5
          name={icon}
          size={16}
          color={pressed ? COLORS.eist : COLORS.lime}
        />
      ) : (
        <Ionicons
          name={icon as any}
          size={18}
          color={pressed ? COLORS.eist : COLORS.lime}
        />
      )}
    </Pressable>
  );
};

// Genre pill component
const GenrePill = ({ genre }: { genre: string }) => (
  <View style={styles.genrePill}>
    <Text style={styles.genrePillText}>{genre}</Text>
  </View>
);

function extractTagValue(
  tags: string[] | undefined,
  prefix: string
): string | undefined {
  if (!tags) return undefined;
  const found = tags.find((t) => t.startsWith(prefix));
  return found ? found.replace(prefix, '').toLowerCase() : undefined;
}

async function fetchArtistById(id: string): Promise<RawArtist> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  if (!res.ok) throw new Error(`Artist fetch failed: ${res.statusText}`);
  const json = (await res.json()) as { artist?: RawArtist };
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

// Show card component for the grid
const ShowCard = ({
  show,
  index,
  onPress,
}: {
  show: any;
  index: number;
  onPress: () => void;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay: index * 80,
      useNativeDriver: true,
    }).start();
  }, [animatedValue, index]);

  const getShowImage = () => {
    if (show.mixcloud_match?.pictures) {
      const pics = show.mixcloud_match.pictures;
      return (
        pics['640wx640h'] || pics.extra_large || pics.large || pics.medium
      );
    }
    if (show.soundcloud_match?.thumbnail) {
      return show.soundcloud_match.thumbnail;
    }
    return null;
  };

  const imageUrl = getShowImage();
  const hasPlayable = show.mixcloud_match || show.soundcloud_match;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Animated.View
      style={[
        styles.showCard,
        {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [15, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.showCardPressable,
          pressed && styles.showCardPressed,
        ]}
      >
        <View style={styles.showImageWrapper}>
          <Image
            source={
              imageUrl && !imageFailed
                ? { uri: imageUrl }
                : require('../../../assets/images/eist_online.png')
            }
            style={styles.showImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(71, 51, 255, 0.7)']}
            style={styles.showImageOverlay}
          />
          {hasPlayable && (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={12} color={COLORS.eist} />
            </View>
          )}
        </View>
        <View style={styles.showInfo}>
          <Text style={styles.showTitle} numberOfLines={2}>
            {show.title}
          </Text>
          <Text style={styles.showDate}>{formatDate(show.start)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default function ArtistScreen() {
  const { slug, id } = useLocalSearchParams<{ slug?: string; id?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const { data: artist } = useQuery({
    queryKey: ['artist', id],
    queryFn: () => fetchArtistById(id || ''),
    enabled: !!id,
  });

  const { shows: archivedShows } = useArchiveShowsByArtist(slug, 12);

  const fallbackImage = require('../../../assets/images/eist_online.png');
  const [imageFailed, setImageFailed] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [preloadedImageUrl, setPreloadedImageUrl] = useState<string | null>(
    null
  );
  const [imageReady, setImageReady] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [showAllShows, setShowAllShows] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const preloadImage = useCallback((uri: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!uri) {
        resolve(false);
        return;
      }

      if (Platform.OS === 'web') {
        try {
          const img = new (global as any).Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = uri;
        } catch {
          resolve(true);
        }
      } else {
        if (typeof Image.prefetch === 'function') {
          Image.prefetch(uri)
            .then(() => resolve(true))
            .catch(() => resolve(false));
        } else {
          resolve(true);
        }
      }
    });
  }, []);

  useEffect(() => {
    setImageFailed(false);
    setPreloadedImageUrl(null);
    setImageReady(false);
    setIsImageLoading(false);
  }, [slug, artist?.id]);

  useEffect(() => {
    const loadArtistImage = async () => {
      if (!artist) {
        setIsImageLoading(false);
        setImageReady(false);
        return;
      }

      const remoteImage =
        artist.logo?.['1024x1024'] ||
        artist.logo?.['512x512'] ||
        artist.logo?.['256x256'] ||
        artist.logo?.default;

      if (!remoteImage) {
        setIsImageLoading(false);
        setPreloadedImageUrl(null);
        setImageFailed(true);
        setImageReady(true);
        return;
      }

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

  const handleSwipeGesture = useCallback(
    (event: any) => {
      if (event.nativeEvent.state === State.END) {
        const { translationX, velocityX, translationY } = event.nativeEvent;

        if (Math.abs(translationX) > Math.abs(translationY)) {
          const threshold = Platform.OS === 'ios' ? 80 : 50;
          const velocityThreshold = Platform.OS === 'ios' ? 600 : 500;

          if (translationX > threshold && velocityX > velocityThreshold) {
            router.back();
          }
        }
      }
    },
    [router]
  );

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;

    const scrollable = contentHeight > layoutHeight + 10;
    setIsScrollable(scrollable);
    setShowBackToTop(scrollable && scrollY > 200);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const openLink = (url: string) =>
    Linking.canOpenURL(url).then((ok) => ok && Linking.openURL(url));

  // Loading states
  if (!id) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: COLORS.eist }]}>
        <Text style={styles.loadingText}>No artist specified.</Text>
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: COLORS.eist }]}>
        <ActivityIndicator size="large" color={COLORS.lime} />
        <Text style={styles.loadingText}>Loading artist...</Text>
      </View>
    );
  }

  const imageSource =
    preloadedImageUrl && !imageFailed
      ? { uri: preloadedImageUrl }
      : fallbackImage;

  const plain = stripFormatting(artist.description?.content);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  const socials = artist.socials ?? {};
  const tags = artist.tags ?? [];

  // Extract genres from tags
  const genres = tags
    .filter((t) => t.startsWith('GENRE_'))
    .map((t) => t.replace('GENRE_', '').replace(/_/g, ' '));

  // Build social links
  const socialLinks: { icon: string; iconPack: 'ionicons' | 'fontawesome'; url: string; label: string }[] = [];

  if (socials.site) socialLinks.push({ icon: 'globe-outline', iconPack: 'ionicons', url: socials.site, label: 'Website' });
  if (socials.instagramHandle) socialLinks.push({ icon: 'instagram', iconPack: 'fontawesome', url: `https://instagram.com/${socials.instagramHandle}`, label: 'Instagram' });
  if (socials.soundcloud) socialLinks.push({ icon: 'soundcloud', iconPack: 'fontawesome', url: `https://soundcloud.com/${socials.soundcloud}`, label: 'SoundCloud' });
  if (socials.mixcloud) socialLinks.push({ icon: 'mixcloud', iconPack: 'fontawesome', url: `https://mixcloud.com/${socials.mixcloud}`, label: 'Mixcloud' });
  if (socials.twitterHandle) socialLinks.push({ icon: 'twitter', iconPack: 'fontawesome', url: `https://twitter.com/${socials.twitterHandle}`, label: 'Twitter' });
  if (socials.facebook) socialLinks.push({ icon: 'facebook', iconPack: 'fontawesome', url: `https://facebook.com/${socials.facebook}`, label: 'Facebook' });

  const displayedShows = showAllShows ? archivedShows : archivedShows.slice(0, 8);
  const hasMoreShows = archivedShows.length > 8;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.screen}>
        <PanGestureHandler
          onHandlerStateChange={handleSwipeGesture}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-10, 10]}
          shouldCancelWhenOutside={true}
        >
          <View style={{ flex: 1 }}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              {/* Hero Section */}
              <View style={styles.heroSection}>
                <View style={styles.heroImageContainer}>
                  {imageReady && (preloadedImageUrl || imageFailed) ? (
                    <Image
                      key={`${artist.id}-${preloadedImageUrl || 'fallback'}`}
                      source={imageSource}
                      style={styles.heroImage}
                      resizeMode="cover"
                      onError={() => {
                        setImageFailed(true);
                        setPreloadedImageUrl(null);
                      }}
                    />
                  ) : (
                    <View style={styles.heroImagePlaceholder} />
                  )}
                  <LinearGradient
                    colors={[
                      'transparent',
                      'rgba(71, 51, 255, 0.4)',
                      'rgba(71, 51, 255, 0.95)',
                      COLORS.eist,
                    ]}
                    locations={[0, 0.5, 0.8, 1]}
                    style={styles.heroGradient}
                  />
                  {isImageLoading && (
                    <View style={styles.heroLoadingOverlay}>
                      <ActivityIndicator size="large" color={COLORS.lime} />
                    </View>
                  )}
                </View>

                {/* Artist Info - overlaid on gradient */}
                <View style={styles.heroContent}>
                  <Text style={styles.artistName}>
                    {artist.name || 'Unnamed Artist'}
                  </Text>

                  {/* Genre Pills */}
                  {genres.length > 0 && (
                    <View style={styles.genresRow}>
                      {genres.slice(0, 4).map((genre, i) => (
                        <GenrePill key={i} genre={genre} />
                      ))}
                    </View>
                  )}

                  {/* Social Icons */}
                  {socialLinks.length > 0 && (
                    <View style={styles.socialsRow}>
                      {socialLinks.map((social, i) => (
                        <SocialButton
                          key={i}
                          icon={social.icon}
                          iconPack={social.iconPack}
                          onPress={() => openLink(social.url)}
                          label={social.label}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Bio Section */}
              {paragraphs.length > 0 && (
                <View style={styles.bioSection}>
                  {paragraphs.map((p, i) => (
                    <SelectableText
                      key={i}
                      text={p}
                      style={styles.bioText}
                      linkStyle={styles.bioLink}
                    />
                  ))}
                </View>
              )}

              {/* Show History Section */}
              {archivedShows.length > 0 && (
                <View style={styles.showsSection}>
                  <View style={styles.showsHeader}>
                    <Text style={styles.showsHeading}>Show History</Text>
                    <View style={styles.showsCount}>
                      <Text style={styles.showsCountText}>
                        {archivedShows.length} shows
                      </Text>
                    </View>
                  </View>

                  <View style={styles.showsGrid}>
                    {displayedShows.map((show, index) => (
                      <ShowCard
                        key={show.id}
                        show={show}
                        index={index}
                        onPress={() =>
                          router.push(
                            `/archive/${encodeURIComponent(show.slug)}`
                          )
                        }
                      />
                    ))}
                  </View>

                  {hasMoreShows && (
                    <TouchableOpacity
                      style={styles.showMoreButton}
                      onPress={() => setShowAllShows(!showAllShows)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.showMoreText}>
                        {showAllShows
                          ? 'Show less'
                          : `+ ${archivedShows.length - 8} more shows`}
                      </Text>
                      <Ionicons
                        name={showAllShows ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={COLORS.lime}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Back to Artists */}
              <View style={styles.backSection}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.push('/artists')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="arrow-back"
                    size={16}
                    color={COLORS.lime}
                  />
                  <Text style={styles.backButtonText}>All Artists</Text>
                </TouchableOpacity>
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
    backgroundColor: COLORS.eist,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.lime,
    fontSize: 16,
    fontWeight: '500',
  },

  // Hero Section
  heroSection: {
    position: 'relative',
    width: '100%',
  },
  heroImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: COLORS.eistDark,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.eistDark,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  heroLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(71, 51, 255, 0.5)',
  },
  heroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  artistName: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: -0.5,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // Genre Pills
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  genrePill: {
    backgroundColor: COLORS.limeSubtle,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  genrePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.lime,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Social Buttons
  socialsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  socialButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(175, 252, 65, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialButtonPressed: {
    backgroundColor: COLORS.lime,
    borderColor: COLORS.lime,
  },

  // Bio Section
  bioSection: {
    padding: 20,
    paddingTop: 24,
  },
  bioText: {
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.lime,
    marginBottom: 16,
  },
  bioLink: {
    color: COLORS.white,
    textDecorationLine: 'underline',
  },

  // Shows Section
  showsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  showsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(175, 252, 65, 0.15)',
  },
  showsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.lime,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  showsCount: {
    backgroundColor: COLORS.eistDark,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  showsCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.lime,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  showsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  showCard: {
    width: (screenWidth - 32 - 24) / 2,
    marginHorizontal: 6,
    marginBottom: 16,
  },
  showCardPressable: {
    backgroundColor: COLORS.eist,
    borderRadius: 10,
    overflow: 'hidden',
  },
  showCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  showImageWrapper: {
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  showImage: {
    width: '100%',
    height: '100%',
  },
  showImageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  playBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showInfo: {
    padding: 10,
    backgroundColor: COLORS.eist,
  },
  showTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.lime,
    lineHeight: 18,
    marginBottom: 4,
  },
  showDate: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
    backgroundColor: 'rgba(175, 252, 65, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    borderRadius: 20,
    alignSelf: 'center',
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.lime,
  },

  // Back Section
  backSection: {
    padding: 20,
    paddingTop: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.lime,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Back to Top
  backToTopButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backToTopTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
