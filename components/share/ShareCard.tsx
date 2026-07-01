// components/share/ShareCard.tsx
//
// Off-screen 1080×1920 (Instagram Story) composition captured for sharing a
// show. Purely presentational and fully determined by props — the show page
// mounts it off-screen and captures its ref with react-native-view-shot.
//
// Three stacked layers, no band or hairline: full-bleed artwork, a subtle éist-
// purple wash whose transparent→purple ramp crosses the golden line (so φ still
// governs the composition), and the show title / artist / date·time superimposed
// bottom-left. A faint text shadow guarantees legibility over any artwork.
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme/tokens';
import { FormattedShowTitle } from '../FormattedShowTitle';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

type ShareCardProps = {
  title: string;
  artistName?: string;
  dateTime: string;
  artworkSource: ImageSourcePropType;
  onArtworkLoad?: () => void;
};

export const ShareCard = React.forwardRef<View, ShareCardProps>(
  ({ title, artistName, dateTime, artworkSource, onArtworkLoad }, ref) => {
    return (
      <View ref={ref} style={s.card} collapsable={false}>
        <Image
          source={artworkSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={onArtworkLoad}
        />

        {/* Purple wash: transparent through the top half, ramping to near-solid
            éist purple at the bottom. The φ line (0.618) sits inside the ramp. */}
        <LinearGradient
          colors={['rgba(71,51,255,0)', 'rgba(71,51,255,0.55)', 'rgba(71,51,255,0.92)']}
          locations={[0.5, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Show text, superimposed bottom-left. */}
        <View style={s.textBlock}>
          <FormattedShowTitle
            title={title}
            color={colors.green}
            size={104}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={s.title}
          />
          {artistName ? <Text style={s.artist}>{artistName}</Text> : null}
          <Text style={s.dateTime}>{dateTime}</Text>
        </View>
      </View>
    );
  }
);

ShareCard.displayName = 'ShareCard';

// Faint shadow so foreground text stays legible over any artwork, on top of the
// wash — kept light so it reads clean, not heavy.
const shadow = {
  textShadowColor: 'rgba(0,0,0,0.35)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 8,
} as const;

const s = StyleSheet.create({
  card: { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, backgroundColor: colors.purple },
  textBlock: { position: 'absolute', left: 72, right: 72, bottom: 120 },
  title: {
    fontFamily: font.headingBold,
    fontWeight: '700',
    fontSize: 104,
    lineHeight: 108,
    letterSpacing: -1.5,
    color: colors.green,
    ...shadow,
  },
  artist: {
    fontFamily: font.body,
    fontWeight: '500',
    fontSize: 64,
    color: colors.text,
    marginTop: 34,
    ...shadow,
  },
  dateTime: {
    fontFamily: font.body,
    fontWeight: '500',
    fontSize: 50,
    color: 'rgba(231,229,229,0.8)',
    marginTop: 21,
    ...shadow,
  },
});
