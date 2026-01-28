// utils/notificationStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArtistSubscription,
  ArtistSubscriptionsMap,
  ShowReminder,
  ShowRemindersMap,
} from '../types/notifications';

const SHOW_REMINDERS_KEY = 'eist_show_reminders';
const ARTIST_SUBSCRIPTIONS_KEY = 'eist_artist_subscriptions';

// Show Reminders

export async function getShowReminders(): Promise<ShowRemindersMap> {
  try {
    const data = await AsyncStorage.getItem(SHOW_REMINDERS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to get show reminders:', error);
    return {};
  }
}

export async function setShowReminder(reminder: ShowReminder): Promise<void> {
  try {
    const reminders = await getShowReminders();
    reminders[reminder.showId] = reminder;
    await AsyncStorage.setItem(SHOW_REMINDERS_KEY, JSON.stringify(reminders));
  } catch (error) {
    console.error('Failed to set show reminder:', error);
  }
}

export async function removeShowReminder(showId: string): Promise<void> {
  try {
    const reminders = await getShowReminders();
    delete reminders[showId];
    await AsyncStorage.setItem(SHOW_REMINDERS_KEY, JSON.stringify(reminders));
  } catch (error) {
    console.error('Failed to remove show reminder:', error);
  }
}

export async function getShowReminder(
  showId: string
): Promise<ShowReminder | null> {
  try {
    const reminders = await getShowReminders();
    return reminders[showId] || null;
  } catch (error) {
    console.error('Failed to get show reminder:', error);
    return null;
  }
}

// Artist Subscriptions

export async function getArtistSubscriptions(): Promise<ArtistSubscriptionsMap> {
  try {
    const data = await AsyncStorage.getItem(ARTIST_SUBSCRIPTIONS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to get artist subscriptions:', error);
    return {};
  }
}

export async function setArtistSubscription(
  subscription: ArtistSubscription
): Promise<void> {
  try {
    const subscriptions = await getArtistSubscriptions();
    subscriptions[subscription.artistId] = subscription;
    await AsyncStorage.setItem(
      ARTIST_SUBSCRIPTIONS_KEY,
      JSON.stringify(subscriptions)
    );
  } catch (error) {
    console.error('Failed to set artist subscription:', error);
  }
}

export async function removeArtistSubscription(
  artistId: string
): Promise<void> {
  try {
    const subscriptions = await getArtistSubscriptions();
    delete subscriptions[artistId];
    await AsyncStorage.setItem(
      ARTIST_SUBSCRIPTIONS_KEY,
      JSON.stringify(subscriptions)
    );
  } catch (error) {
    console.error('Failed to remove artist subscription:', error);
  }
}

export async function getArtistSubscription(
  artistId: string
): Promise<ArtistSubscription | null> {
  try {
    const subscriptions = await getArtistSubscriptions();
    return subscriptions[artistId] || null;
  } catch (error) {
    console.error('Failed to get artist subscription:', error);
    return null;
  }
}

export async function isArtistSubscribed(artistId: string): Promise<boolean> {
  const subscription = await getArtistSubscription(artistId);
  return subscription?.isActive ?? false;
}

// Cleanup expired reminders (shows that have already started)
export async function cleanupExpiredReminders(): Promise<void> {
  try {
    const reminders = await getShowReminders();
    const now = new Date();
    let hasChanges = false;

    for (const showId of Object.keys(reminders)) {
      const reminder = reminders[showId];
      const startDate = new Date(reminder.startDateUtc);
      if (startDate <= now) {
        delete reminders[showId];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await AsyncStorage.setItem(SHOW_REMINDERS_KEY, JSON.stringify(reminders));
    }
  } catch (error) {
    console.error('Failed to cleanup expired reminders:', error);
  }
}
