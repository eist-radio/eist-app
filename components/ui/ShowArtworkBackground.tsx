// components/ui/ShowArtworkBackground.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export function ShowArtworkBackground({ source, onError }: {
  source: React.ComponentProps<typeof Image>['source'];
  onError?: () => void;
}) {
  return (
    <>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" onError={onError} />
      <LinearGradient colors={['rgba(71,51,255,0.62)', 'rgba(71,51,255,0.62)']} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(10,4,30,0.45)','rgba(10,4,30,0)','rgba(10,4,30,0)','rgba(10,4,30,0.72)']} locations={[0,0.3,0.55,1]} style={StyleSheet.absoluteFill} />
    </>
  );
}
