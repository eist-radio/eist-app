// types/notifications.ts

export type ShowReminder = {
  showId: string;
  showTitle: string;
  artistName?: string;
  startDateUtc: string;
  notificationId: string;
  createdAt: string;
};

export type ArtistSubscription = {
  artistId: string;
  artistName: string;
  artistSlug: string;
  isActive: boolean;
  createdAt: string;
};

export type ShowRemindersMap = Record<string, ShowReminder>;
export type ArtistSubscriptionsMap = Record<string, ArtistSubscription>;

export type NotificationPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied';
