// app/(tabs)/mixcloud.tsx

import { SwipeNavigator } from '@/components/SwipeNavigator'
import { ThemedText } from '@/components/ThemedText'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'
import React, { memo, useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, FlatList, Image, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MixcloudShow, useMixcloudShows } from '../../hooks/useMixcloudShows'

const mixcloudLogo = require('../../assets/images/mc-logo-default.png')
const logoImage = require('../../assets/images/eist-logo-header.png')

const ShowItem = memo(({ show, onPress }: { show: MixcloudShow; onPress: () => void }) => {
  const { colors } = useTheme()
  
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }, [])

  return (
    <TouchableOpacity
      style={[styles.showItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      {show.thumbnailUrl ? (
        <Image
          source={{ uri: show.thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: colors.border }]}>
          <Ionicons name="musical-notes" size={16} color={colors.text} />
        </View>
      )}
      <View style={styles.showContent}>
        <Text style={[styles.showTitle, { color: colors.text }]} numberOfLines={2}>
          {show.title}
        </Text>
        <Text style={[styles.showDate, { color: colors.text }]}>
          {formatDate(show.createdAt)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text} />
    </TouchableOpacity>
  )
})

ShowItem.displayName = 'ShowItem'

const LoadingFooter = () => {
  const { colors } = useTheme()
  return (
    <View style={styles.footerLoading}>
      <ActivityIndicator size="small" color={colors.primary} />
      <ThemedText type="default" style={[styles.footerText, { color: colors.text }]}>
        Loading more shows...
      </ThemedText>
    </View>
  )
}

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

export default function MixcloudScreen() {
  const { colors } = useTheme()
  const { 
    data, 
    isLoading, 
    error, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch 
  } = useMixcloudShows()

  const allShows = data?.pages.flatMap(page => page.shows) || []
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const openShow = useCallback(async (show: MixcloudShow) => {
    try {
      await Linking.openURL(show.url)
    } catch {
      Alert.alert('Error', 'Failed to open show. Please try again later.', [{ text: 'OK' }])
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [refetch])

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y
    setShowBackToTop(scrollY > 100)
  }

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 100)
  }

  const renderShowItem = useCallback(({ item }: { item: MixcloudShow }) => (
    <ShowItem show={item} onPress={() => openShow(item)} />
  ), [openShow])

  const renderFooter = () => (isFetchingNextPage ? <LoadingFooter /> : null)

  return (
    // Horizontal swipe disabled here; iOS back-swipe still works due to edge exclusion
    <SwipeNavigator horizontalEnabled={false} allowIOSBackSwipe>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.eistLogoContainer}
          activeOpacity={0.7}
          onPress={() => Linking.openURL('https://eist.radio/support')}
          accessibilityRole="link"
        >
          <View style={styles.eistLogoBackground}>
            <Image source={logoImage} style={{ width: 57, height: 57 }} resizeMode="contain" />
          </View>
        </TouchableOpacity>

        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://www.mixcloud.com/eistcork/')}
            accessibilityRole="link"
          >
            <Image source={mixcloudLogo} style={styles.logo} resizeMode="contain" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText type="default" style={[styles.loadingText, { color: colors.text }]}>
                Loading shows...
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <ThemedText type="default" style={[styles.errorText, { color: colors.text }]}>
                Unable to load shows. Please try again later.
              </ThemedText>
            </View>
          ) : allShows.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={allShows}
              renderItem={renderShowItem}
              keyExtractor={(item) => item.id}
              style={styles.showsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.showsListContent}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.1}
              ListFooterComponent={renderFooter}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              removeClippedSubviews
              maxToRenderPerBatch={5}
              windowSize={5}
              initialNumToRender={8}
              updateCellsBatchingPeriod={50}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <ThemedText type="default" style={[styles.emptyText, { color: colors.text }]}>
                No shows available at the moment.
              </ThemedText>
            </View>
          )}
        </View>

        <BackToTopButton onPress={scrollToTop} visible={showBackToTop} />
      </View>
    </SwipeNavigator>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', marginTop: 64 },
  content: { flex: 1, paddingHorizontal: 16 },
  showsList: { flex: 1 },
  showsListContent: { paddingBottom: 16 },
  showItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  thumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  showContent: { flex: 1, marginRight: 12 },
  showTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4, lineHeight: 24 },
  showDate: { fontSize: 14, opacity: 0.7, marginBottom: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 16, textAlign: 'center', opacity: 0.7 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 16, textAlign: 'center', opacity: 0.7 },
  footerLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  footerText: { fontSize: 14, opacity: 0.7 },
  logo: { width: 150, marginTop: 12, marginBottom: 8 },
  backToTopButton: { position: 'absolute', bottom: 20, left: '45%', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  backToTopTouchable: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  chevronIcon: {},
  eistLogoContainer: { position: 'absolute', top: 48, right: 18, zIndex: 1 },
  eistLogoBackground: { borderRadius: 26, padding: 6 },
})
