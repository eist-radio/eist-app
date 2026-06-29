import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { colors, type } from '../../theme/tokens';
import { useNotifications } from '../../hooks/useNotifications';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';
import { fetchNextShowForArtist, formatNextShowDate } from '../../utils/nextShow';
import { PageScaffold } from '../ui/PageScaffold';
import { Pills } from '../ui/Pills';
import { Eyebrow } from '../ui/Eyebrow';
import { FormattedShowTitle } from '../FormattedShowTitle';
import { formatClockTime } from '../../utils/formatTime';

function formatReminderDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${datePart}, ${formatClockTime(d)}`;
}

function ClearButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.clear}
    >
      <Ionicons name="close" size={22} color={colors.green} />
    </Pressable>
  );
}

function SubscriptionRow({
  artistId,
  artistName,
  onClear,
}: {
  artistId: string;
  artistName: string;
  onClear: () => void;
}) {
  const timezone = useTimezoneChange();
  const { data: nextShow } = useQuery({
    queryKey: ['artist-next-show', artistId, timezone],
    queryFn: () => fetchNextShowForArtist(artistId, timezone),
    enabled: !!artistId,
    staleTime: 5 * 60 * 1000,
  });

  const subtitle = nextShow
    ? `Next show: ${formatNextShowDate(nextShow.startDateUtc)}`
    : 'Notified for upcoming shows';

  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={[type.rowTitle, { color: colors.green }]}>{artistName}</Text>
        <Text style={[type.rowSub, { color: colors.text, marginTop: 4 }]}>{subtitle}</Text>
      </View>
      <ClearButton onPress={onClear} label={`Unsubscribe from ${artistName}`} />
    </View>
  );
}

export default function NotificationsScreen({ pageIndex }: { pageIndex: number; isActive: boolean }) {
  const { reminders, subscriptions, toggleShowReminder, toggleArtistSubscription } = useNotifications();
  const [busy, setBusy] = useState(false);

  const reminderList = useMemo(
    () =>
      Object.values(reminders).sort(
        (a, b) => new Date(a.startDateUtc).getTime() - new Date(b.startDateUtc).getTime()
      ),
    [reminders]
  );

  const subscriptionList = useMemo(
    () => Object.values(subscriptions).filter((sub) => sub.isActive),
    [subscriptions]
  );

  const isEmpty = reminderList.length === 0 && subscriptionList.length === 0;

  const clearReminder = useCallback(
    async (showId: string) => {
      const reminder = reminders[showId];
      if (!reminder || busy) return;
      setBusy(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await toggleShowReminder({
          showId: reminder.showId,
          showTitle: reminder.showTitle,
          artistName: reminder.artistName,
          startDateUtc: reminder.startDateUtc,
        });
      } catch (e) {
        console.error('Failed to clear reminder:', e);
      } finally {
        setBusy(false);
      }
    },
    [reminders, busy, toggleShowReminder]
  );

  const clearSubscription = useCallback(
    async (artistId: string) => {
      const sub = subscriptions[artistId];
      if (!sub || busy) return;
      setBusy(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await toggleArtistSubscription(sub.artistId, sub.artistName, sub.artistSlug);
      } catch (e) {
        console.error('Failed to clear subscription:', e);
      } finally {
        setBusy(false);
      }
    },
    [subscriptions, busy, toggleArtistSubscription]
  );

  return (
    <PageScaffold left={<Pills active={pageIndex} />}>
      <Eyebrow>notifications</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Reminders</Text>

      {isEmpty ? (
        <Text style={[type.bio, { color: colors.textDim, marginTop: 28 }]}>
          {Platform.OS === 'web'
            ? 'Notifications are available in the mobile app.'
            : "You have no active reminders set up. Tap the bell beside a show or artist to get notified before they go live."}
        </Text>
      ) : (
        <ScrollView
          style={{ marginTop: 24 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {reminderList.length > 0 && (
            <Text style={[type.eyebrow, { color: colors.textDim, marginBottom: 16 }]}>Show reminders</Text>
          )}
          {reminderList.map((r) => (
            <View key={r.showId} style={s.row}>
              <View style={{ flex: 1 }}>
                <FormattedShowTitle title={r.showTitle} color={colors.green} size={22} style={type.rowTitle} />
                <Text style={[type.rowSub, { color: colors.text, marginTop: 4 }]}>
                  {[r.artistName, formatReminderDate(r.startDateUtc)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <ClearButton onPress={() => clearReminder(r.showId)} label={`Clear reminder for ${r.showTitle}`} />
            </View>
          ))}

          {subscriptionList.length > 0 && (
            <Text
              style={[
                type.eyebrow,
                { color: colors.textDim, marginBottom: 16, marginTop: reminderList.length > 0 ? 12 : 0 },
              ]}
            >
              Subscribed artists
            </Text>
          )}
          {subscriptionList.map((sub) => (
            <SubscriptionRow
              key={sub.artistId}
              artistId={sub.artistId}
              artistName={sub.artistName}
              onClear={() => clearSubscription(sub.artistId)}
            />
          ))}
        </ScrollView>
      )}
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  clear: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
