// app/(tabs)/archive.tsx

import { SelectableThemedText } from '@/components/SelectableThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  RefreshControl,
  SectionList,
  SectionListData,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveShowCard } from '../../components/ArchiveShowCard';
import { getAvailableMonths, useArchiveShowsByMonth } from '../../hooks/useArchiveShows';
import { ArchiveSection, ArchiveShow } from '../../types/archive';

const logoImage = require('../../assets/images/eist-logo-header.png');

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

export default function ArchiveScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { sections, isLoading, error, refetch, isRefetching } = useArchiveShowsByMonth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const sectionListRef = useRef<SectionList<ArchiveShow, ArchiveSection>>(null);

  const availableMonths = useMemo(() => getAvailableMonths(sections), [sections]);

  const filteredSections = useMemo(() => {
    let result = sections;

    // Filter by month if selected
    if (selectedMonth) {
      result = result.filter((s) => s.key === selectedMonth);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      result = result
        .map((section) => ({
          ...section,
          data: section.data.filter(
            (show) =>
              show.title.toLowerCase().includes(lower) ||
              show.artistName.toLowerCase().includes(lower)
          ),
        }))
        .filter((section) => section.data.length > 0);
    }

    return result;
  }, [sections, selectedMonth, searchQuery]);

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
    sectionListRef.current?.scrollToLocation({
      sectionIndex: 0,
      itemIndex: 0,
      animated: true,
    });
    setTimeout(() => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        animated: false,
      });
    }, 100);
  };

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<ArchiveShow, ArchiveSection> }) => (
      <SelectableThemedText style={[styles.sectionHeader, { color: colors.primary }]}>
        {section.title}
      </SelectableThemedText>
    ),
    [colors.primary]
  );

  const renderItem = useCallback(
    ({ item }: { item: ArchiveShow }) => <ArchiveShowCard show={item} />,
    []
  );

  const selectedMonthTitle = selectedMonth
    ? availableMonths.find((m) => m.key === selectedMonth)?.title ?? 'All'
    : 'All';

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
          Could not load archive.
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
          Archive
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

      <View style={styles.filterRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={18} color={colors.text} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search shows..."
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

        <TouchableOpacity
          style={[styles.monthButton, { backgroundColor: colors.card }]}
          onPress={() => setShowMonthPicker(true)}
        >
          <Text style={[styles.monthButtonText, { color: colors.primary }]} numberOfLines={1}>
            {selectedMonthTitle}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <SectionList
        ref={sectionListRef}
        sections={filteredSections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
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
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No shows found.
            </Text>
          </View>
        }
      />

      <BackToTopButton onPress={scrollToTop} visible={showBackToTop && isScrollable} />

      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>Select Month</Text>
            <TouchableOpacity
              style={[
                styles.monthOption,
                !selectedMonth && { backgroundColor: colors.primary + '20' },
              ]}
              onPress={() => {
                setSelectedMonth(null);
                setShowMonthPicker(false);
              }}
            >
              <Text
                style={[
                  styles.monthOptionText,
                  { color: !selectedMonth ? colors.primary : colors.text },
                ]}
              >
                All Months
              </Text>
            </TouchableOpacity>
            {availableMonths.map((month) => (
              <TouchableOpacity
                key={month.key}
                style={[
                  styles.monthOption,
                  selectedMonth === month.key && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => {
                  setSelectedMonth(month.key);
                  setShowMonthPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.monthOptionText,
                    { color: selectedMonth === month.key ? colors.primary : colors.text },
                  ]}
                >
                  {month.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, paddingTop: 10 },
  sectionHeader: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  list: { paddingBottom: 16 },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logoContainer: { position: 'absolute', top: -44, right: 5 },
  logoBackground: { borderRadius: 26, padding: 6 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    maxWidth: 140,
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxHeight: '70%',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  monthOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  monthOptionText: {
    fontSize: 16,
  },
});
