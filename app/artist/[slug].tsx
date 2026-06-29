// app/artist/[slug].tsx

import { useArchiveShowsByArtist } from '@/hooks/useArchiveShows';
import { useArtistMapping } from '@/hooks/useArtists';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { apiKey } from '../../config';
import { HeaderLeftNav } from '../../components/ui/HeaderLeftNav';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { NotifyControl } from '../../components/ui/NotifyControl';
import { PageScaffold } from '../../components/ui/PageScaffold';
import { SpinningLogo } from '../../components/ui/SpinningLogo';
import { Chevron } from '../../components/ui/Chevron';
import { ShowArtworkBackground } from '../../components/ui/ShowArtworkBackground';
import { FormattedShowTitle } from '../../components/FormattedShowTitle';
import { useNotifications } from '../../hooks/useNotifications';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';
import { stripFormatting } from '../../utils/stripFormatting';
import { fetchNextShowForArtist, formatNextShowDate } from '../../utils/nextShow';
import { colors, type as t } from '../../theme/tokens';

const STATION_ID = 'eist-radio';
const fallbackImage = require('../../assets/images/eist_online.png');

type RawArtist = {
  id: string;
  slug?: string;
  name?: string;
  description?: { content?: any[] };
  logo?: {
    default?: string;
    '256x256'?: string;
    '512x512'?: string;
    '1024x1024'?: string;
  };
  socials?: {
    twitterHandle?: string;
    instagramHandle?: string;
    facebook?: string;
    mixcloud?: string;
    soundcloud?: string;
    site?: string;
  };
  tags?: string[];
};

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

async function fetchArtistById(id: string): Promise<RawArtist> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  if (!res.ok) throw new Error(`Artist fetch failed: ${res.statusText}`);
  const json = (await res.json()) as { artist?: RawArtist };
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

export default function ArtistScreen() {
  const { slug, id: queryId } = useLocalSearchParams<{ slug?: string; id?: string }>();
  const id = queryId ?? slug;
  const router = useRouter();
  const currentTimezone = useTimezoneChange();
  const { data: artistMapping } = useArtistMapping();

  const { data: artist } = useQuery({
    queryKey: ['artist', id],
    queryFn: () => fetchArtistById(id || ''),
    enabled: !!id,
  });

  const { data: nextShow } = useQuery({
    queryKey: ['artist-next-show', id, currentTimezone],
    queryFn: () => fetchNextShowForArtist(id || '', currentTimezone),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // The archive indexes shows by its own artistSlug. The authoritative match is
  // the artist mapping (built from the archive shows themselves: id -> slug),
  // then the normalized artist name (the archive uses the same scheme). The
  // RadioCult artist.slug is a different field that often doesn't match, so it's
  // only a last-resort fallback — preferring it left some artists with no
  // past shows.
  const routeSlug =
    queryId || (artist && slug && slug !== artist.id) ? slug : undefined;
  const mappedSlug = id ? artistMapping?.[id]?.slug : undefined;
  const nameSlug = artist?.name ? normalizeSlug(artist.name) : undefined;
  const archiveArtistSlug =
    mappedSlug ?? nameSlug ?? routeSlug ?? artist?.slug;

  const { shows: archivedShows } = useArchiveShowsByArtist(archiveArtistSlug, 12);

  const { isArtistSubscribed, toggleArtistSubscription, isLoading } = useNotifications();
  const [isToggling, setIsToggling] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const isSubscribed = artist ? isArtistSubscribed(artist.id) : false;

  const onToggleNotify = useCallback(async () => {
    if (!artist || isToggling || isLoading) return;
    setIsToggling(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Pass the artist's known upcoming show so subscribing schedules a
      // reminder for it (and unsubscribing cancels it).
      const upcomingShows = nextShow
        ? [
            {
              showId: nextShow.id,
              showTitle: nextShow.title,
              artistName: artist.name,
              startDateUtc: nextShow.startDateUtc,
            },
          ]
        : [];
      await toggleArtistSubscription(
        artist.id,
        artist.name ?? '',
        archiveArtistSlug ?? artist.id,
        upcomingShows
      );
    } catch (e) {
      console.error('Failed to toggle subscription:', e);
    } finally {
      setIsToggling(false);
    }
  }, [artist, isToggling, isLoading, toggleArtistSubscription, archiveArtistSlug, nextShow]);

  if (!artist) {
    return <PageScaffold left={<HeaderLeftNav />}>{null}</PageScaffold>;
  }

  const plain = stripFormatting(artist.description?.content);
  const tags = artist.tags ?? [];

  // Extract genres from tags
  const genres = tags
    .filter((tag) => tag.startsWith('GENRE_'))
    .map((tag) => tag.replace('GENRE_', '').replace(/_/g, ' '));

  const artistImageUrl =
    artist.logo?.['1024x1024'] ||
    artist.logo?.['512x512'] ||
    artist.logo?.['256x256'] ||
    artist.logo?.default;
  const imageSource = artistImageUrl && !imageFailed ? { uri: artistImageUrl } : fallbackImage;

  return (
    <PageScaffold left={<HeaderLeftNav />} right={<SpinningLogo />} transparentBg>
      <ShowArtworkBackground source={imageSource} onError={() => setImageFailed(true)} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Eyebrow>host</Eyebrow>

        <Text style={[t.pagehead, { color: colors.green, marginTop: 8 }]}>
          {artist.name}
        </Text>

        {nextShow && (
          <Pressable
            onPress={() => router.push(`/show/${encodeURIComponent(nextShow.id)}`)}
          >
            <Text style={[t.meta, { color: colors.text, marginTop: 10 }]}>
              {`Next show: ${formatNextShowDate(nextShow.startDateUtc)}`}
            </Text>
          </Pressable>
        )}

        {genres.length > 0 && (
          <Text style={[t.meta, { color: colors.text, marginTop: 10 }]}>
            {genres.slice(0, 4).join('  ·  ')}
          </Text>
        )}

        <NotifyControl
          active={isSubscribed}
          onToggle={onToggleNotify}
          caption="for next show"
        />

        {plain ? (
          <Text style={[t.bio, { color: colors.text, marginTop: 26 }]}>
            {plain}
          </Text>
        ) : null}

        <View style={{ marginTop: 34, marginBottom: 12 }}>
          <Eyebrow>past shows</Eyebrow>
        </View>

        {archivedShows.map((show) => (
          <Pressable
            key={show.slug}
            onPress={() => router.push(`/archive/${encodeURIComponent(show.slug)}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              marginBottom: 30,
            }}
          >
            <View style={{ flex: 1 }}>
              <FormattedShowTitle
                title={show.title}
                color={colors.green}
                size={22}
                style={t.rowTitle}
              />
              <Text style={[t.rowSub, { color: colors.text, marginTop: 4 }]}>
                {new Date(show.start).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <Chevron direction="right" size={20} />
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}
