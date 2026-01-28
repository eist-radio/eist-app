// components/ArtistNotifyButton.tsx

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNotifications } from '../hooks/useNotifications';

const COLORS = {
  lime: '#AFFC41',
  limeMuted: 'rgba(175, 252, 65, 0.5)',
  limeSubtle: 'rgba(175, 252, 65, 0.15)',
  limeBorder: 'rgba(175, 252, 65, 0.35)',
  eist: '#4733FF',
};

type ArtistNotifyButtonProps = {
  artistId: string;
  artistName: string;
  artistSlug: string;
};

export const ArtistNotifyButton: React.FC<ArtistNotifyButtonProps> = ({
  artistId,
  artistName,
  artistSlug,
}) => {
  const { isArtistSubscribed, toggleArtistSubscription, isLoading } =
    useNotifications();
  const [isToggling, setIsToggling] = useState(false);

  const isSubscribed = isArtistSubscribed(artistId);

  const handlePress = useCallback(async () => {
    if (isToggling || isLoading) return;

    setIsToggling(true);

    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await toggleArtistSubscription(artistId, artistName, artistSlug);
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
    } finally {
      setIsToggling(false);
    }
  }, [
    isToggling,
    isLoading,
    artistId,
    artistName,
    artistSlug,
    toggleArtistSubscription,
  ]);

  // Hide on web - notifications not supported
  if (Platform.OS === 'web') {
    return null;
  }

  const showLoading = isToggling || isLoading;

  return (
    <Pressable
      onPress={handlePress}
      disabled={showLoading}
      style={({ pressed }) => [
        styles.button,
        isSubscribed && styles.buttonSubscribed,
        pressed && !showLoading && styles.buttonPressed,
      ]}
      accessibilityLabel={
        isSubscribed
          ? `Unsubscribe from ${artistName} notifications`
          : `Subscribe to ${artistName} notifications`
      }
      accessibilityRole="button"
      accessibilityState={{ selected: isSubscribed }}
    >
      {showLoading ? (
        <ActivityIndicator
          size="small"
          color={isSubscribed ? COLORS.eist : COLORS.lime}
        />
      ) : (
        <View style={styles.content}>
          <Ionicons
            name={isSubscribed ? 'notifications' : 'notifications-outline'}
            size={16}
            color={isSubscribed ? COLORS.eist : COLORS.lime}
          />
          <Text
            style={[
              styles.text,
              isSubscribed ? styles.textSubscribed : styles.textDefault,
            ]}
          >
            {isSubscribed ? 'Subscribed' : 'Notify me'}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(175, 252, 65, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    minWidth: 120,
  },
  buttonSubscribed: {
    backgroundColor: COLORS.lime,
    borderColor: COLORS.lime,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textDefault: {
    color: COLORS.lime,
  },
  textSubscribed: {
    color: COLORS.eist,
  },
});
