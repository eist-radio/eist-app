// app/(tabs)/archive/[slug].tsx

import { SelectableText } from '@/components/SelectableText';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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
import { ArchiveShowCard } from '../../../components/ArchiveShowCard';
import { FormattedShowTitle } from '../../../components/FormattedShowTitle';
import { useArchiveShowBySlug, useArchiveShowsByArtist } from '../../../hooks/useArchiveShows';
import { stripFormatting } from '../../../utils/stripFormatting';

const fallbackImage = require('../../../assets/images/eist_online.png');

const BackToTopButton = ({ onPress, visible }: { onPress: () => void; visible: boolean }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
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
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.backToTopTouchable}>
        <Ionicons name="chevron-up" size={32} color="#AFFC41" style={styles.chevronIcon} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const { width: screenWidth } = Dimensions.get('window');

function getShowImage(show: any): string | null {
  if (show?.mixcloud_match?.pictures) {
    const pics = show.mixcloud_match.pictures;
    return pics['1024wx1024h'] || pics['768wx768h'] || pics['640wx640h'] || pics.extra_large || null;
  }
  if (show?.soundcloud_match?.artwork_url) {
    return show.soundcloud_match.artwork_url.replace('-large', '-t500x500');
  }
  return null;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getPlayUrl(show: any): string | null {
  if (show?.mixcloud_match?.url) {
    return show.mixcloud_match.url;
  }
  if (show?.soundcloud_match?.permalink_url) {
    return show.soundcloud_match.permalink_url;
  }
  return null;
}

export default function ArchiveShowScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const { show, isLoading } = useArchiveShowBySlug(slug);
  const { shows: relatedShows } = useArchiveShowsByArtist(show?.artistSlug, 5);

  const [imageFailed, setImageFailed] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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
    setShowBackToTop(scrollable && scrollY > 100);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleImageError = useCallback(() => {
    setImageFailed(true);
  }, []);

  if (!slug) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>No show specified.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!show) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>Show not found.</Text>
      </View>
    );
  }

  const imageUrl = getShowImage(show);
  const imageSource = imageUrl && !imageFailed ? { uri: imageUrl } : fallbackImage;
  const playUrl = getPlayUrl(show);
  const plain = stripFormatting(show.description?.content);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  // Filter out the current show from related shows
  const otherShows = relatedShows.filter((s) => s.slug !== show.slug).slice(0, 4);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <PanGestureHandler
          onHandlerStateChange={handleSwipeGesture}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-10, 10]}
          shouldCancelWhenOutside={true}
        >
          <View style={{ flex: 1 }}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.contentContainer}
              contentContainerStyle={styles.content}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={imageSource}
                  style={styles.heroImage}
                  resizeMode="cover"
                  onError={handleImageError}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>

              <View style={styles.titleRow}>
                <Ionicons
                  name="musical-notes-outline"
                  size={36}
                  color={colors.primary}
                  style={styles.icon}
                />
                <View style={styles.titleContainer}>
                  <FormattedShowTitle
                    title={show.title}
                    color={colors.primary}
                    size={24}
                    style={styles.header}
                  />
                </View>
              </View>

              <View style={styles.textContainer}>
                <Link href={`/artist/${encodeURIComponent(show.artistSlug)}`}>
                  <Text style={[styles.artistName, { color: colors.primary }]}>
                    {show.artistName}
                  </Text>
                </Link>

                <Text style={[styles.date, { color: colors.text }]}>{formatDate(show.start)}</Text>

                {playUrl && (
                  <TouchableOpacity
                    style={[styles.playButton, { backgroundColor: colors.primary }]}
                    onPress={() => Linking.openURL(playUrl)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play" size={20} color={colors.background} />
                    <Text style={[styles.playButtonText, { color: colors.background }]}>
                      {show.mixcloud_match ? 'Play on Mixcloud' : 'Play on SoundCloud'}
                    </Text>
                  </TouchableOpacity>
                )}

                {paragraphs.length > 0 && (
                  <View style={styles.descriptionContainer}>
                    {paragraphs.map((p, i) => (
                      <SelectableText
                        key={i}
                        text={p}
                        style={[styles.bodyText, { color: colors.text }]}
                        linkStyle={{ color: colors.primary }}
                      />
                    ))}
                  </View>
                )}

                {otherShows.length > 0 && (
                  <View style={styles.relatedSection}>
                    <ThemedText
                      type="subtitle"
                      style={[styles.sectionTitle, { color: colors.primary }]}
                    >
                      More from {show.artistName}
                    </ThemedText>
                    {otherShows.map((relatedShow) => (
                      <ArchiveShowCard key={relatedShow.id} show={relatedShow} />
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
  imageContainer: {
    width: screenWidth,
    height: screenWidth,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginVertical: 16,
  },
  icon: {
    marginRight: 8,
    marginTop: 4,
  },
  titleContainer: {
    flex: 1,
  },
  header: {
    fontWeight: '700',
    lineHeight: 30,
  },
  textContainer: {
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  artistName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  date: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginBottom: 16,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'left',
  },
  relatedSection: {
    marginTop: 24,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  backToTopButton: {
    position: 'absolute',
    bottom: 20,
    left: '45%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToTopTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {},
});
