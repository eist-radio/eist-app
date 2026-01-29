// app/(tabs)/archive/[slug].tsx

import { SelectableText } from '@/components/SelectableText';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { FormattedShowTitle } from '../../../components/FormattedShowTitle';
import {
  useArchiveShowBySlug,
  useArchiveShowsByArtist,
} from '../../../hooks/useArchiveShows';
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
  soundcloud: '#FF5500',
  mixcloud: '#5000FF',
};

const fallbackImage = require('../../../assets/images/eist_online.png');
const { width: screenWidth } = Dimensions.get('window');

// Back to top button
const BackToTopButton = ({
  onPress,
  visible,
}: {
  onPress: () => void;
  visible: boolean;
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: visible ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
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
          pointerEvents: visible ? 'auto' : 'none',
        },
      ]}
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

// Platform play button
const PlatformPlayButton = ({
  platform,
  url,
  isPrimary,
}: {
  platform: 'mixcloud' | 'soundcloud';
  url: string;
  isPrimary?: boolean;
}) => {
  const [pressed, setPressed] = useState(false);
  const isMixcloud = platform === 'mixcloud';

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => Linking.openURL(url)}
      style={[
        styles.platformButton,
        isPrimary && styles.platformButtonPrimary,
        pressed && styles.platformButtonPressed,
      ]}
    >
      <View style={styles.platformButtonContent}>
        <Ionicons
          name="play"
          size={isPrimary ? 16 : 14}
          color={isPrimary ? COLORS.eist : COLORS.lime}
        />
        <Text
          style={[
            styles.platformButtonText,
            isPrimary && styles.platformButtonTextPrimary,
          ]}
        >
          Play
        </Text>
        <View style={styles.platformDivider} />
        <FontAwesome5
          name={isMixcloud ? 'mixcloud' : 'soundcloud'}
          size={isPrimary ? 14 : 12}
          color={isPrimary ? COLORS.eist : COLORS.lime}
        />
      </View>
    </Pressable>
  );
};

// External link button
const ExternalLinkButton = ({
  platform,
  url,
}: {
  platform: 'mixcloud' | 'soundcloud';
  url: string;
}) => {
  const [pressed, setPressed] = useState(false);
  const isMixcloud = platform === 'mixcloud';

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => Linking.openURL(url)}
      style={[styles.externalLink, pressed && styles.externalLinkPressed]}
    >
      <Text style={styles.externalLinkText}>
        Open in {isMixcloud ? 'Mixcloud' : 'SoundCloud'}
      </Text>
      <Ionicons name="open-outline" size={14} color={COLORS.textMuted} />
    </Pressable>
  );
};

// Related show card
const RelatedShowCard = ({
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
      duration: 350,
      delay: index * 60,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animatedValue, index]);

  const getShowImage = () => {
    // Try SoundCloud thumbnail first
    if (show.soundcloud_match?.thumbnail) {
      return show.soundcloud_match.thumbnail;
    }
    // Try Mixcloud pictures
    if (show.mixcloud_match?.pictures) {
      const pics = show.mixcloud_match.pictures;
      return pics['640wx640h'] || pics.extra_large || pics.large || pics.medium || null;
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
        styles.relatedCard,
        {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.relatedCardPressable,
          pressed && styles.relatedCardPressed,
        ]}
      >
        <View style={styles.relatedImageWrapper}>
          <Image
            source={
              imageUrl && !imageFailed
                ? { uri: imageUrl }
                : fallbackImage
            }
            style={styles.relatedImage}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(71, 51, 255, 0.7)']}
            style={styles.relatedImageOverlay}
          />
          {hasPlayable && (
            <View style={styles.relatedPlayBadge}>
              <Ionicons name="play" size={10} color={COLORS.eist} />
            </View>
          )}
        </View>
        <View style={styles.relatedInfo}>
          <Text style={styles.relatedTitle} numberOfLines={2}>
            {show.title}
          </Text>
          <Text style={styles.relatedDate}>{formatDate(show.start)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

function getShowImage(show: any): string | null {
  // Try SoundCloud thumbnail first
  if (show?.soundcloud_match?.thumbnail) {
    return show.soundcloud_match.thumbnail;
  }
  // Try Mixcloud pictures (prefer larger sizes for hero)
  if (show?.mixcloud_match?.pictures) {
    const pics = show.mixcloud_match.pictures;
    return pics['1024wx1024h'] || pics['768wx768h'] || pics['640wx640h'] || pics.extra_large || null;
  }
  return null;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ArchiveShowScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const { data: show, isLoading } = useArchiveShowBySlug(slug);
  const { shows: relatedShows } = useArchiveShowsByArtist(show?.artistSlug, 5);

  const [imageFailed, setImageFailed] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (show) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [show, fadeAnim]);

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

  const handleShare = async () => {
    if (!show) return;
    try {
      await Share.share({
        title: show.title,
        message: `Check out "${show.title}" by ${show.artistName} on éist radio`,
        url: `https://eist.radio/archive/${slug}`,
      });
    } catch (error) {
      // Ignore share errors
    }
  };

  // Loading states
  if (!slug) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: COLORS.eist }]}>
        <Text style={styles.loadingText}>No show specified.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: COLORS.eist }]}>
        <ActivityIndicator size="large" color={COLORS.lime} />
        <Text style={styles.loadingText}>Loading show...</Text>
      </View>
    );
  }

  if (!show) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: COLORS.eist }]}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.lime} />
        <Text style={styles.loadingText}>Show not found.</Text>
        <TouchableOpacity
          style={styles.errorBackButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageUrl = getShowImage(show);
  const imageSource = imageUrl && !imageFailed ? { uri: imageUrl } : fallbackImage;

  const mixcloudUrl = show.mixcloud_match?.url;
  const soundcloudUrl = show.soundcloud_match?.url;
  const hasPlayable = mixcloudUrl || soundcloudUrl;
  const primaryPlatform = soundcloudUrl ? 'soundcloud' : 'mixcloud';
  const primaryUrl = soundcloudUrl || mixcloudUrl;

  const plain = stripFormatting(show.description?.content);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  const otherShows = relatedShows.filter((s) => s.slug !== show.slug).slice(0, 4);

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
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
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
                    <Image
                      source={imageSource}
                      style={styles.heroImage}
                      contentFit="cover"
                      onError={() => setImageFailed(true)}
                    />
                    <LinearGradient
                      colors={[
                        'transparent',
                        'rgba(71, 51, 255, 0.3)',
                        'rgba(71, 51, 255, 0.9)',
                        COLORS.eist,
                      ]}
                      locations={[0, 0.45, 0.75, 1]}
                      style={styles.heroGradient}
                    />

                    {/* Play overlay on image */}
                    {hasPlayable && primaryUrl && (
                      <Pressable
                        style={styles.heroPlayOverlay}
                        onPress={() => Linking.openURL(primaryUrl)}
                      >
                        <View style={styles.heroPlayButton}>
                          <Ionicons name="play" size={32} color={COLORS.eist} />
                        </View>
                      </Pressable>
                    )}
                  </View>

                  {/* Show Info */}
                  <View style={styles.heroContent}>
                    <Text style={styles.showDate}>{formatDate(show.start)}</Text>

                    <FormattedShowTitle
                      title={show.title}
                      color={COLORS.white}
                      size={28}
                      style={styles.showTitle}
                    />

                    {/* Artist Link */}
                    <Pressable
                      style={styles.artistLink}
                      onPress={() => {
                        // Need to get artist ID - for now just navigate to artists page
                        router.push('/artists');
                      }}
                    >
                      <Text style={styles.artistLinkLabel}>by</Text>
                      <Text style={styles.artistLinkName}>{show.artistName}</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={COLORS.lime}
                        style={styles.artistLinkArrow}
                      />
                    </Pressable>

                    {/* Primary Play Button */}
                    {hasPlayable && primaryUrl && (
                      <PlatformPlayButton
                        platform={primaryPlatform}
                        url={primaryUrl}
                        isPrimary
                      />
                    )}

                    {/* No archive badge */}
                    {!hasPlayable && (
                      <View style={styles.noArchiveBadge}>
                        <Ionicons
                          name="cloud-offline-outline"
                          size={14}
                          color={COLORS.textMuted}
                        />
                        <Text style={styles.noArchiveText}>
                          Archive Not Available
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Description Section */}
                {paragraphs.length > 0 && (
                  <View style={styles.descriptionSection}>
                    {paragraphs.map((p, i) => (
                      <SelectableText
                        key={i}
                        text={p}
                        style={styles.descriptionText}
                        linkStyle={styles.descriptionLink}
                      />
                    ))}
                  </View>
                )}

                {/* Listen Back Section */}
                {hasPlayable && (
                  <View style={styles.listenSection}>
                    <Text style={styles.listenHeading}>Listen Back</Text>

                    <View style={styles.externalLinksRow}>
                      {soundcloudUrl && (
                        <ExternalLinkButton
                          platform="soundcloud"
                          url={soundcloudUrl}
                        />
                      )}
                      {mixcloudUrl && (
                        <ExternalLinkButton
                          platform="mixcloud"
                          url={mixcloudUrl}
                        />
                      )}
                    </View>
                  </View>
                )}

                {/* More from Artist Section */}
                {otherShows.length > 0 && (
                  <View style={styles.moreSection}>
                    <View style={styles.moreHeader}>
                      <Text style={styles.moreHeading}>
                        More from {show.artistName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => router.push('/artists')}
                        style={styles.viewAllLink}
                      >
                        <Text style={styles.viewAllText}>View Artist</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={12}
                          color={COLORS.lime}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.relatedGrid}>
                      {otherShows.map((relatedShow, index) => (
                        <RelatedShowCard
                          key={relatedShow.id}
                          show={relatedShow}
                          index={index}
                          onPress={() =>
                            router.push(
                              `/archive/${encodeURIComponent(relatedShow.slug)}`
                            )
                          }
                        />
                      ))}
                    </View>
                  </View>
                )}

                {/* Navigation Section */}
                <View style={styles.navSection}>
                  <TouchableOpacity
                    style={styles.backToArtistButton}
                    onPress={() => router.push('/artists')}
                  >
                    <Ionicons name="arrow-back" size={16} color={COLORS.lime} />
                    <Text style={styles.backToArtistText}>
                      Back to {show.artistName}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShare}
                  >
                    <Text style={styles.shareText}>Share</Text>
                    <Ionicons
                      name="share-outline"
                      size={16}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>

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
  errorBackButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    borderRadius: 4,
  },
  errorBackText: {
    color: COLORS.lime,
    fontSize: 14,
    fontWeight: '600',
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
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
  },
  heroPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '30%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPlayButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  heroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  showDate: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: COLORS.lime,
    marginBottom: 8,
  },
  showTitle: {
    fontWeight: '700',
    marginBottom: 12,
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)' }
      : {
          textShadowColor: 'rgba(0, 0, 0, 0.3)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 4,
        }),
  },
  artistLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  artistLinkLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  artistLinkName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  artistLinkArrow: {
    opacity: 0.7,
  },

  // Platform Button
  platformButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    borderRadius: 4,
    backgroundColor: 'rgba(175, 252, 65, 0.08)',
  },
  platformButtonPrimary: {
    backgroundColor: COLORS.lime,
    borderColor: COLORS.lime,
  },
  platformButtonPressed: {
    opacity: 0.8,
  },
  platformButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformButtonText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.lime,
  },
  platformButtonTextPrimary: {
    color: COLORS.eist,
  },
  platformDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(71, 51, 255, 0.25)',
    marginHorizontal: 4,
  },

  // No Archive Badge
  noArchiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  noArchiveText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },

  // Description Section
  descriptionSection: {
    padding: 20,
    paddingTop: 24,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.lime,
    marginBottom: 16,
  },
  descriptionLink: {
    color: COLORS.white,
    textDecorationLine: 'underline',
  },

  // Listen Section
  listenSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginHorizontal: 16,
    backgroundColor: COLORS.eist,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(175, 252, 65, 0.1)',
  },
  listenHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: COLORS.lime,
    marginBottom: 16,
  },
  externalLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  externalLinkPressed: {
    opacity: 0.7,
  },
  externalLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },

  // More Section
  moreSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  moreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  moreHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.lime,
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  relatedCard: {
    width: (screenWidth - 32 - 24) / 2,
    marginHorizontal: 6,
    marginBottom: 16,
  },
  relatedCardPressable: {
    backgroundColor: COLORS.eist,
    borderRadius: 8,
    overflow: 'hidden',
  },
  relatedCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  relatedImageWrapper: {
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  relatedImage: {
    width: '100%',
    height: '100%',
  },
  relatedImageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  relatedPlayBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedInfo: {
    padding: 10,
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.lime,
    lineHeight: 18,
    marginBottom: 4,
  },
  relatedDate: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Navigation Section
  navSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(175, 252, 65, 0.1)',
  },
  backToArtistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    borderRadius: 4,
  },
  backToArtistText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.lime,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
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
