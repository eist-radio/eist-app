// hooks/useShareShow.ts
//
// Capture + share orchestration for the show share card. Given a ref to an
// off-screen ShareCard, captures it at a crisp 1080×1920 PNG and opens the
// system share sheet. Native-only (view-shot / sharing don't exist on web).
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
      // Warm the remote artwork into cache so the off-screen card has it painted,
      // then give it a beat to render before we snapshot. Best-effort: on failure
      // the card falls back to the bundled éist image and we still capture.
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
