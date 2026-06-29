import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { colors } from '../../theme/tokens';

export function HomeButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate('/')}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Home"
    >
      <Ionicons name="home" size={28} color={colors.green} />
    </Pressable>
  );
}
