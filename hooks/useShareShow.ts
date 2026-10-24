// hooks/useShareShow.ts
// Captures the off-screen ShareCard as a 1080×1920 PNG and opens the share sheet. Native only.
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, Image, Platform, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../components/share/ShareCard';

export function useShareShow({
  cardRef,
  artworkUrl,
}: {
  cardRef: React.RefObject<View | null>;
  artworkUrl?: string;
}) {
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(async () => {
    if (Platform.OS === 'web' || isSharing) return;
    setIsSharing(true);
    try {
      // Warm the artwork cache and let the card render before capturing. Falls back to the bundled image.
      if (artworkUrl) {
        try {
          await Image.prefetch(artworkUrl);
        } catch {
          // ignore — fallback image path
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 120));

      if (!cardRef.current) throw new Error('Share card not mounted');

      // Force an exact 1080×1920 export regardless of device pixel ratio.
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'Sharing isn’t available on this device.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Share',
      });
    } catch (error) {
      console.error('Share failed:', error);
      Alert.alert('Share failed', 'Couldn’t create the share image. Please try again.');
    } finally {
      setIsSharing(false);
    }
  }, [cardRef, artworkUrl, isSharing]);

  return { share, isSharing };
}
