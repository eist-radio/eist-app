// app/show/[slug].tsx

import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { FormattedShowTitle } from '../../components/FormattedShowTitle';
import { ShareCard } from '../../components/share/ShareCard';
import { useShareShow } from '../../hooks/useShareShow';
import { HeaderLeftNav } from '../../components/ui/HeaderLeftNav';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { NotifyControl } from '../../components/ui/NotifyControl';
import { PageScaffold } from '../../components/ui/PageScaffold';
import { SpinningLogo } from '../../components/ui/SpinningLogo';
import { ShowArtworkBackground } from '../../components/ui/ShowArtworkBackground';
import { apiKey } from '../../config';
import { useNotifications } from '../../hooks/useNotifications';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';
import { colors, font, type as t } from '../../theme/tokens';
import { stripFormatting } from '../../utils/stripFormatting';
import { formatClockTime } from '../../utils/formatTime';

const STATION_ID = 'eist-radio';
const fallbackImage = require('../../assets/images/eist_online.png');

type RawScheduleItem = {
  id: string;
  stationId: string;
  title: string;
  startDateUtc: string;
  endDateUtc: string;
  description?: { content?: any[] };
  duration: number;
  timezone: string;
  color?: string;
  artistIds?: string[];
  isRecurring: boolean;
  media:
    | { type: 'mix'; trackId?: string }
    | { type: 'playlist'; playlistId: string }
    | { type: 'live' };
};

type Artist = {
  id: string;
  name?: string;
  logo?: {
    default?: string;
    '256x256'?: string;
    '512x512'?: string;
    '1024x1024'?: string;
  };
};

async function fetchEventById(id: string): Promise<RawScheduleItem> {
  // Start the window one day earlier (yesterday 00:00) so a show that began
  // before today's UTC midnight — including the currently-live and late-night
  // shows — still falls inside the lookup range (matches ScheduleScreen).
  const start = new Date();
  start.setDate(start.getDate() - 1);
  const end = new Date();
  end.setDate(end.getDate() + 7);

  const startIso = `${start.toISOString().split('T')[0]}T00:00:00Z`;
  const endIso = `${end.toISOString().split('T')[0]}T23:59:59Z`;

  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
    `?startDate=${startIso}&endDate=${endIso}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const json = await res.json();
  const match = (json.schedules || []).find((e: RawScheduleItem) => e.id === id);
  if (!match) throw new Error('Show not found');
  return match;
}

async function fetchHostArtist(artistId: string): Promise<Artist> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${artistId}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const json = await res.json();
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

function formatShowTime(start: string, end: string, timezone: string): string {
  return formatClockTime(start, timezone);
}

function formatShowDate(start: string, timezone: string): string {
  const startDate = new Date(start);

  const dayName = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: timezone,
  });

  const monthName = startDate.toLocaleDateString('en-US', {
    month: 'long',
    timeZone: timezone,
  });

  const day = startDate.toLocaleDateString('en-US', {
    day: 'numeric',
    timeZone: timezone,
  });

  // Add ordinal suffix to day
  let dayWithSuffix = day;
  if (day.endsWith('1') && day !== '11') {
    dayWithSuffix = day + 'st';
  } else if (day.endsWith('2') && day !== '12') {
    dayWithSuffix = day + 'nd';
  } else if (day.endsWith('3') && day !== '13') {
    dayWithSuffix = day + 'rd';
  } else {
    dayWithSuffix = day + 'th';
  }

  return `${dayName}, ${monthName} ${dayWithSuffix}`;
}

export default function ShowScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const router = useRouter();
  const currentTimezone = useTimezoneChange();
  const [imageFailed, setImageFailed] = useState(false);

  // All hooks must run before any early return (rules of hooks)
  const { data: event, isError: eventNotFound } = useQuery({
    queryKey: ['show', slug],
    queryFn: () => fetchEventById(slug || ''),
    enabled: !!slug,
  });

  const hostIds = event?.artistIds || [];

  const host1 = useQuery({
    queryKey: ['artist', hostIds[0]],
    queryFn: () => fetchHostArtist(hostIds[0]),
    enabled: Boolean(hostIds[0]),
  });

  const host2 = useQuery({
    queryKey: ['artist', hostIds[1]],
    queryFn: () => fetchHostArtist(hostIds[1]),
    enabled: Boolean(hostIds[1]),
  });

  const host3 = useQuery({
    queryKey: ['artist', hostIds[2]],
    queryFn: () => fetchHostArtist(hostIds[2]),
    enabled: Boolean(hostIds[2]),
  });

  const host4 = useQuery({
    queryKey: ['artist', hostIds[3]],
    queryFn: () => fetchHostArtist(hostIds[3]),
    enabled: Boolean(hostIds[3]),
  });

  const hosts = [host1.data, host2.data, host3.data, host4.data].filter(Boolean);

  // Notify wiring (per-show reminder)
  const { isShowReminderSet, toggleShowReminder, isLoading } = useNotifications();
  const [isToggling, setIsToggling] = useState(false);
  const isSet = event ? isShowReminderSet(event.id) : false;
  const hasStarted = event ? new Date(event.startDateUtc) <= new Date() : false;

  const onToggleNotify = useCallback(async () => {
    if (!event || isToggling || isLoading || hasStarted) return;
    setIsToggling(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await toggleShowReminder({
        showId: event.id,
        showTitle: event.title,
        artistName: hosts[0]?.name,
        startDateUtc: event.startDateUtc,
      });
    } catch (e) {
      console.error('Failed to toggle reminder:', e);
    } finally {
      setIsToggling(false);
    }
  }, [event, isToggling, isLoading, hasStarted, toggleShowReminder, hosts]);

  // Share-card wiring must sit above the early return (rules of hooks). The
  // artwork URL only needs hosts, which resolve independently of the event guard.
  const artistImageUrl =
    hosts[0]?.logo?.['1024x1024'] ||
    hosts[0]?.logo?.['512x512'] ||
    hosts[0]?.logo?.['256x256'] ||
    hosts[0]?.logo?.default;
  const shareCardRef = useRef<View>(null);
  const { share, isSharing } = useShareShow({ cardRef: shareCardRef, artworkUrl: artistImageUrl });

  // Loading / not-found guard
  if (!event) {
    return (
      <PageScaffold left={<HeaderLeftNav />}>
        {eventNotFound ? (
          <Text style={[t.bio, { color: colors.text, marginTop: 26 }]}>
            Show not found.
          </Text>
        ) : null}
      </PageScaffold>
    );
  }

  const plain = stripFormatting(event.description?.content || []);
  const timeString = formatShowTime(event.startDateUtc, event.endDateUtc, currentTimezone);
  const dateString = formatShowDate(event.startDateUtc, currentTimezone);

  // While the first host query is still resolving we don't yet know whether an
  // artist image exists — render no image rather than flashing the fallback.
  const firstHostPending = Boolean(hostIds[0]) && host1.isLoading;
  const imageSource = artistImageUrl && !imageFailed
    ? { uri: artistImageUrl }
    : firstHostPending
      ? null
      : fallbackImage;
  // The share card always needs a concrete image (never the pending null), so it
  // falls straight back to the bundled éist artwork.
  const shareArtwork = artistImageUrl && !imageFailed ? { uri: artistImageUrl } : fallbackImage;

  return (
    <>
    <PageScaffold left={<HeaderLeftNav />} right={<SpinningLogo />} transparentBg liveNow>
      <ShowArtworkBackground source={imageSource} onError={() => setImageFailed(true)} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>coming up</Eyebrow>
          {Platform.OS !== 'web' ? (
            <Pressable
              onPress={share}
              disabled={isSharing}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Share this show"
            >
              {isSharing ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Ionicons name="share-outline" size={26} color={colors.text} />
              )}
            </Pressable>
          ) : null}
        </View>

        <FormattedShowTitle
          title={event.title}
          color={colors.green}
          size={42}
          numberOfLines={4}
          adjustsFontSizeToFit
          style={{
            fontFamily: font.headingBold,
            fontWeight: '700',
            letterSpacing: -0.8,
            lineHeight: 43,
            marginTop: 8,
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
          }}
        >
          {hosts[0]?.name ? (
            <Pressable
              onPress={() =>
                router.push(`/artist/${encodeURIComponent(hosts[0]!.id)}`)
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
                {hosts[0].name}
              </Text>
            </Pressable>
          ) : null}
          <Text style={[t.meta, { color: colors.text }]}>
            {`Next show: ${dateString}, ${timeString}`}
          </Text>
        </View>

        <NotifyControl
          active={isSet}
          onToggle={onToggleNotify}
          caption="for this show"
        />

        {plain ? (
          <Text style={[t.bio, { color: colors.text, marginTop: 26 }]}>
            {plain}
          </Text>
        ) : null}
      </ScrollView>
    </PageScaffold>

    {/* Off-screen 1080×1920 share card: laid out for capture, never visible. */}
    {Platform.OS !== 'web' ? (
      <View pointerEvents="none" style={{ position: 'absolute', top: -20000, left: 0 }}>
        <ShareCard
          ref={shareCardRef}
          title={event.title}
          artistName={hosts[0]?.name}
          dateTime={`${dateString} · ${timeString}`}
          artworkSource={shareArtwork}
        />
      </View>
    ) : null}
    </>
  );
}
