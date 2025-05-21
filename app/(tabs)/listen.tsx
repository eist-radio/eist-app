// app/(tabs)/listen.tsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAudio } from '../../context/AudioContext';

export default function ListenScreen() {
  const { isPlaying, togglePlay } = useAudio();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Listen to EIST Radio</Text>
      <Button title={isPlaying ? 'Pause' : 'Play'} onPress={togglePlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 16 },
});
