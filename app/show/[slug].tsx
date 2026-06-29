// app/show/[slug].tsx

import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { FormattedShowTitle } from '../../components/FormattedShowTitle';
import { HeaderLeftNav } from '../../components/ui/HeaderLeftNav';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { NotifyControl } from '../../components/ui/NotifyControl';
import { PageScaffold } from '../../components/ui/PageScaffold';
import { SpinningLogo } from '../../components/ui/SpinningLogo';
import { apiKey } from '../../config';
import { useNotifications } from '../../hooks/useNotifications';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';
import { colors, font, type as t } from '../../theme/tokens';
import { stripFormatting } from '../../utils/stripFormatting';

const STATION_ID = 'eist-radio';

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
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  const startIso = `${today.toISOString().split('T')[0]}T00:00:00Z`;
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
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startTime = startDate
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
    .replace(/ (AM|PM)$/, '');

  const endTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  return `${startTime} - ${endTime}`;
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

  // All hooks must run before any early return (rules of hooks)
  const { data: event } = useQuery({
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

  // Loading / not-found guard
  if (!event) {
    return <PageScaffold left={<HeaderLeftNav />}>{null}</PageScaffold>;
  }

  const plain = stripFormatting(event.description?.content || []);
  const timeString = formatShowTime(event.startDateUtc, event.endDateUtc, currentTimezone);
  const dateString = formatShowDate(event.startDateUtc, currentTimezone);

  return (
    <PageScaffold left={<HeaderLeftNav />} right={<SpinningLogo />}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Eyebrow>coming up</Eyebrow>

        <FormattedShowTitle
          title={event.title}
          color={colors.green}
          size={40}
          style={{
            fontFamily: font.headingBold,
            fontWeight: '700',
            letterSpacing: -0.8,
            lineHeight: 42,
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
                  fontSize: 18,
                  color: colors.green,
                }}
              >
                {hosts[0].name}
              </Text>
            </Pressable>
          ) : null}
          <Text style={[t.meta, { color: colors.bone }]}>
            {hosts[0]?.name
              ? `· ${dateString}, ${timeString}`
              : `${dateString}, ${timeString}`}
          </Text>
        </View>

        <NotifyControl
          active={isSet}
          onToggle={onToggleNotify}
          caption="for this show"
        />

        {plain ? (
          <Text style={[t.bio, { color: colors.bone, marginTop: 26 }]}>
            {plain}
          </Text>
        ) : null}
      </ScrollView>
    </PageScaffold>
  );
}
