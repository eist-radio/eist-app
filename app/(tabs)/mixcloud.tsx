// app/(tabs)/mixcloud.tsx

import { SwipeNavigator } from '@/components/SwipeNavigator'
import { ThemedText } from '@/components/ThemedText'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'
import React, { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, FlatList, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MixcloudShow, useMixcloudShows } from '../../hooks/useMixcloudShows'

const mixcloudLogo = require('../../assets/images/mc-logo-default.png')

const ShowItem = ({ show, onPress }: { show: MixcloudShow; onPress: () => void }) => {
  const { colors } = useTheme()
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

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
}

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
  const { colors } = useTheme()
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
    isFetchingNextPage 
  } = useMixcloudShows()

  // Flatten all pages into a single array
  const allShows = data?.pages.flatMap(page => page.shows) || []
  
  // Scroll state management
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [isScrollable, setIsScrollable] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const openShow = async (show: MixcloudShow) => {
    try {
      const canOpen = await Linking.canOpenURL(show.url)
      if (canOpen) {
        await Linking.openURL(show.url)
      } else {
        Alert.alert(
          'Cannot Open Show',
          'Unable to open this show. Please make sure you have an internet connection.',
          [{ text: 'OK' }]
        )
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to open show. Please try again later.',
        [{ text: 'OK' }]
      )
    }
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

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
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }

  const renderShowItem = ({ item }: { item: MixcloudShow }) => (
    <ShowItem show={item} onPress={() => openShow(item)} />
  )

  const renderFooter = () => {
    if (!isFetchingNextPage) return null
    return <LoadingFooter />
  }

  return (
    <SwipeNavigator>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Image
            source={mixcloudLogo}
            style={styles.logo}
            resizeMode="contain"
          />
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
            />
          ) : (
            <View style={styles.emptyContainer}>
              <ThemedText type="default" style={[styles.emptyText, { color: colors.text }]}>
                No shows available at the moment.
              </ThemedText>
            </View>
          )}
        </View>
        
        <BackToTopButton onPress={scrollToTop} visible={showBackToTop && isScrollable} />
      </View>
    </SwipeNavigator>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  showsList: {
    flex: 1,
  },
  showsListContent: {
    paddingBottom: 16,
  },
  showItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  showContent: {
    flex: 1,
    marginRight: 12,
  },
  showTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 24,
  },
  showDate: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
  },
  logo: {
    width: 172,
    marginTop: 12,
    marginBottom: 8,
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
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {
    // Empty style for now, can be used for future styling
  },

})
