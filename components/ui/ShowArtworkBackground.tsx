// components/ui/ShowArtworkBackground.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export function ShowArtworkBackground({ source, onError }: {
  source: React.ComponentProps<typeof Image>['source'] | null;
  onError?: () => void;
}) {
  return (
    <>
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} onError={onError} />
      ) : null}
      <LinearGradient colors={['rgba(71,51,255,0.46)', 'rgba(71,51,255,0.46)']} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(8,4,26,0.35)','rgba(8,4,26,0)','rgba(8,4,26,0)','rgba(8,4,26,0.82)']} locations={[0,0.38,0.52,1]} style={StyleSheet.absoluteFill} />
    </>
  );
}
