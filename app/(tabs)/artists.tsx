// app/(tabs)/artists.tsx

import { SelectableThemedText } from '@/components/SelectableThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistCard } from '../../components/ArtistCard';
import { useFilteredArtists } from '../../hooks/useArtists';
import { DerivedArtist } from '../../types/archive';

const logoImage = require('../../assets/images/eist-logo-header.png');

const BackToTopButton = ({ onPress, visible }: { onPress: () => void; visible: boolean }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
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

export default function ArtistsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const { artists, isLoading, error, refetch, isRefetching } = useFilteredArtists(searchQuery);

  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const scrollable = contentHeight > layoutHeight + 10;
    setIsScrollable(scrollable);
    setShowBackToTop(scrollable && scrollY > 100);
  };

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderItem = useCallback(
    ({ item }: { item: DerivedArtist }) => <ArtistCard artist={item} imageUrl={item.imageUrl} />,
    []
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SelectableThemedText style={{ color: colors.notification, fontSize: 18 }}>
          Could not load artists.
        </SelectableThemedText>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 48 }]}
    >
      <View style={styles.titleContainer}>
        <SelectableThemedText style={[styles.title, { color: colors.primary }]}>
          Artists
        </SelectableThemedText>
        <TouchableOpacity
          style={styles.logoContainer}
          activeOpacity={0.7}
          onPress={() => Linking.openURL('https://eist.radio/support')}
          accessibilityRole="link"
        >
          <View style={styles.logoBackground}>
            <Image source={logoImage} style={{ width: 57, height: 57 }} resizeMode="contain" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={18} color={colors.text} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search artists..."
          placeholderTextColor={colors.text + '80'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={artists}
        keyExtractor={(item) => item.slug}
        numColumns={2}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.background}
          />
        }
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No artists found.
            </Text>
          </View>
        }
      />

      <BackToTopButton onPress={scrollToTop} visible={showBackToTop && isScrollable} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, paddingTop: 10 },
  list: { paddingBottom: 16, paddingTop: 8 },
  row: {
    justifyContent: 'flex-start',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logoContainer: { position: 'absolute', top: -44, right: 5 },
  logoBackground: { borderRadius: 26, padding: 6 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
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
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {},
});
