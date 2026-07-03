import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { Chevron } from './Chevron';

export function BackTriangle() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={16} accessibilityRole="button" accessibilityLabel="Back">
      <Chevron direction="left" size={32} strokeWidth={3.5} />
    </Pressable>
  );
}
