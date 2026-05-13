// components/ReminderButton.tsx

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useNotifications } from '../hooks/useNotifications';

const COLORS = {
  lime: '#AFFC41',
  limeMuted: 'rgba(175, 252, 65, 0.5)',
  limeSubtle: 'rgba(175, 252, 65, 0.15)',
};

type ReminderButtonProps = {
  showId: string;
  showTitle: string;
  artistName?: string;
  startDateUtc: string;
  size?: number;
  disabled?: boolean;
};

export const ReminderButton: React.FC<ReminderButtonProps> = ({
  showId,
  showTitle,
  artistName,
  startDateUtc,
  size = 22,
  disabled = false,
}) => {
  const { isShowReminderSet, toggleShowReminder, isLoading } =
    useNotifications();
  const [isToggling, setIsToggling] = useState(false);

  const isSet = isShowReminderSet(showId);

  // Check if show has already started
  const showStart = new Date(startDateUtc);
  const hasStarted = showStart <= new Date();

  const handlePress = useCallback(async () => {
    if (isToggling || isLoading || disabled || hasStarted) return;

    setIsToggling(true);

    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await toggleShowReminder({
        showId,
        showTitle,
        artistName,
        startDateUtc,
      });
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
    } finally {
      setIsToggling(false);
    }
  }, [
    isToggling,
    isLoading,
    disabled,
    hasStarted,
    showId,
    showTitle,
    artistName,
    startDateUtc,
    toggleShowReminder,
  ]);

  // Hide on web (notifications not supported) or for shows already started
  if (Platform.OS === 'web' || hasStarted) {
    return null;
  }

  const isDisabled = disabled || hasStarted || isLoading;
  const showLoading = isToggling;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
      accessibilityLabel={
        isSet ? 'Remove show reminder' : 'Set show reminder'
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected: isSet }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {showLoading ? (
        <ActivityIndicator size="small" color={COLORS.lime} />
      ) : (
        <View style={styles.iconContainer}>
          <Ionicons
            name={isSet ? 'notifications' : 'notifications-outline'}
            size={size}
            color={isDisabled ? COLORS.limeMuted : COLORS.lime}
          />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    backgroundColor: COLORS.limeSubtle,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
