// utils/notificationScheduler.ts

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationPermissionStatus } from '../types/notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Minutes before show start to send notification
const REMINDER_MINUTES_BEFORE = 5;

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return 'denied';
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return 'granted';
  }

  const { status } = await Notifications.requestPermissionsAsync();

  if (status === 'granted') {
    return 'granted';
  } else if (status === 'denied') {
    return 'denied';
  }

  return 'undetermined';
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return 'denied';
  }

  const { status } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    return 'granted';
  } else if (status === 'denied') {
    return 'denied';
  }

  return 'undetermined';
}

export type ScheduleShowReminderParams = {
  showId: string;
  showTitle: string;
  artistName?: string;
  startDateUtc: string;
};

export async function scheduleShowReminder(
  params: ScheduleShowReminderParams
): Promise<string | null> {
  const { showId, showTitle, artistName, startDateUtc } = params;

  const showStart = new Date(startDateUtc);
  const reminderTime = new Date(
    showStart.getTime() - REMINDER_MINUTES_BEFORE * 60 * 1000
  );

  // Don't schedule if show already started or reminder time has passed
  if (reminderTime <= new Date()) {
    return null;
  }

  try {
    const body = artistName
      ? `${showTitle} with ${artistName} starts in ${REMINDER_MINUTES_BEFORE} minutes`
      : `${showTitle} starts in ${REMINDER_MINUTES_BEFORE} minutes`;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Show Starting Soon',
        body,
        data: { showId, type: 'show_reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Failed to schedule show reminder:', error);
    return null;
  }
}

export async function cancelShowReminder(
  notificationId: string
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel show reminder:', error);
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to cancel all reminders:', error);
  }
}

export async function getScheduledReminders(): Promise<
  Notifications.NotificationRequest[]
> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to get scheduled reminders:', error);
    return [];
  }
}

// Check if a specific show has a scheduled reminder
export async function hasScheduledReminder(showId: string): Promise<boolean> {
  const scheduled = await getScheduledReminders();
  return scheduled.some(
    (notification) => notification.content.data?.showId === showId
  );
}
