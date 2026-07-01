// app/archive/[slug].tsx

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { FormattedShowTitle } from '../../components/FormattedShowTitle';
import { HeaderLeftNav } from '../../components/ui/HeaderLeftNav';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { PageScaffold } from '../../components/ui/PageScaffold';
import { PlatformDisc } from '../../components/ui/PlatformDisc';
import { ShowArtworkBackground } from '../../components/ui/ShowArtworkBackground';
import { SpinningLogo } from '../../components/ui/SpinningLogo';
import { useArchiveShowBySlug } from '../../hooks/useArchiveShows';
import { colors, font, type as t } from '../../theme/tokens';
import { stripFormatting } from '../../utils/stripFormatting';

const fallbackImage = require('../../assets/images/eist_online.png');

function getShowImage(show: any): string | null {
  if (show?.soundcloud_match?.thumbnail) {
    return show.soundcloud_match.thumbnail;
  }
  if (show?.mixcloud_match?.pictures) {
    const pics = show.mixcloud_match.pictures;
    return (
      pics['1024wx1024h'] ||
      pics['768wx768h'] ||
      pics['640wx640h'] ||
      pics.extra_large ||
      null
    );
  }
  return null;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ArchiveShowScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const router = useRouter();

  const { data: show, isLoading } = useArchiveShowBySlug(slug);

  const [imageFailed, setImageFailed] = useState(false);

  if (isLoading || !show) {
    return <PageScaffold left={<HeaderLeftNav />}>{null}</PageScaffold>;
  }

  const imageUrl = getShowImage(show);
  const imageSource =
    imageUrl && !imageFailed ? { uri: imageUrl } : fallbackImage;

  const mixcloudUrl = show.mixcloud_match?.url;
  const soundcloudUrl = show.soundcloud_match?.url;
  const hasPlayable = mixcloudUrl || soundcloudUrl;
  const primaryPlatform = soundcloudUrl ? 'soundcloud' : 'mixcloud';
  const primaryUrl = soundcloudUrl || mixcloudUrl;

  const plain = stripFormatting(show.description?.content);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  return (
    <PageScaffold left={<HeaderLeftNav />} right={<SpinningLogo />} transparentBg liveNow>
      <ShowArtworkBackground
        source={imageSource}
        onError={() => setImageFailed(true)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Eyebrow>listen back</Eyebrow>

        <View style={{ height: 18 }} />

        <FormattedShowTitle
          title={show.title}
          color={colors.green}
          size={42}
          numberOfLines={4}
          adjustsFontSizeToFit
          style={{
            fontFamily: font.headingBold,
            fontWeight: '700',
            letterSpacing: -0.8,
            lineHeight: 43,
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 10,
          }}
        >
          <Pressable
            onPress={() =>
              router.push(
                `/artist/${encodeURIComponent(show.artistSlug)}` +
                  (show.artistIds?.[0] ? `?id=${encodeURIComponent(show.artistIds[0])}` : '')
              )
            }
          >
            <Text
              style={{
                fontFamily: font.body,
                fontWeight: '600',
                fontSize: 16,
                color: colors.green,
              }}
            >
              {show.artistName}
            </Text>
          </Pressable>
          <Text style={[t.meta, { color: colors.text }]}>
            {`· ${formatDate(show.start)}`}
          </Text>
        </View>

        {hasPlayable && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 21,
              marginTop: 28,
            }}
          >
            <Pressable
              onPress={() => primaryUrl && Linking.openURL(primaryUrl)}
              accessibilityRole="button"
              accessibilityLabel={
                primaryPlatform === 'soundcloud'
                  ? 'Listen on SoundCloud'
                  : 'Listen on Mixcloud'
              }
            >
              <PlatformDisc platform={primaryPlatform} size={68} />
            </Pressable>
            <Text
              style={{
                fontFamily: font.body,
                fontWeight: '600',
                fontSize: 26,
                letterSpacing: 0.2,
                color: colors.green,
              }}
            >
              {primaryPlatform === 'soundcloud'
                ? 'Listen on SoundCloud'
                : 'Listen on Mixcloud'}
            </Text>
          </View>
        )}

        {paragraphs.map((p, i) => (
          <Text
            key={i}
            style={[t.bio, { color: colors.text, marginTop: i === 0 ? 30 : 14 }]}
          >
            {p}
          </Text>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}
