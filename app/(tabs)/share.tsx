// app/(tabs)/share.tsx

import * as Sharing from 'expo-sharing';
import React, { useRef } from 'react';
import {
  Alert,
  Button,
  findNodeHandle,
  StyleSheet,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

export default function ShareNow() {
  const viewRef = useRef<View>(null);

  const onShareScreenshot = async () => {
    try {
      if (!viewRef.current) {
        throw new Error('View not ready');
      }
      // Get the native tag
      const tag = findNodeHandle(viewRef.current);
      if (!tag) {
        throw new Error('Could not find view handle');
      }

      // Capture the entire view as PNG
      const uri = await captureRef(tag, { format: 'png', quality: 0.8 });

      // Fire the native share sheet with that image
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('No share targets available');
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Screenshot',
      });
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    }
  };

  return (
    <View style={styles.container} ref={viewRef} collapsable={false}>
      <Button title="Share Screenshot" onPress={onShareScreenshot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    backgroundColor:'#4733FF',
    padding:        16,
  },
});
