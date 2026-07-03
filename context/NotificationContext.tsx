// context/NotificationContext.tsx

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, Linking, Platform } from 'react-native';
import {
  ArtistSubscription,
  ArtistSubscriptionsMap,
  NotificationPermissionStatus,
  ShowReminder,
  ShowRemindersMap,
} from '../types/notifications';
import {
  cancelShowReminder,
  getNotificationPermissionStatus,
  requestNotificationPermissions,
  scheduleShowReminder,
  ScheduleShowReminderParams,
} from '../utils/notificationScheduler';
import {
  cleanupExpiredReminders,
  getArtistSubscriptions,
  getShowReminders,
  isArtistSubscribed as checkArtistSubscribed,
  removeArtistSubscription,
  removeShowReminder,
  setArtistSubscription,
  setShowReminder,
} from '../utils/notificationStorage';
import { fetchNextShowForArtist } from '../utils/nextShow';

type NotificationContextType = {
  // Permission
  permissionStatus: NotificationPermissionStatus;
  requestPermissions: () => Promise<NotificationPermissionStatus>;

  // Show reminders
  reminders: ShowRemindersMap;
  isShowReminderSet: (showId: string) => boolean;
  toggleShowReminder: (params: ScheduleShowReminderParams) => Promise<boolean>;
  getShowReminder: (showId: string) => ShowReminder | undefined;

  // Artist subscriptions
  subscriptions: ArtistSubscriptionsMap;
  isArtistSubscribed: (artistId: string) => boolean;
  toggleArtistSubscription: (
    artistId: string,
    artistName: string,
    artistSlug: string,
    upcomingShows?: ScheduleShowReminderParams[]
  ) => Promise<boolean>;

  // Sync subscribed artist shows
  syncSubscribedArtistShows: (
    artistId: string,
    upcomingShows: ScheduleShowReminderParams[]
  ) => Promise<void>;

  // Loading state
  isLoading: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>('undetermined');
  const [reminders, setReminders] = useState<ShowRemindersMap>({});
  const [subscriptions, setSubscriptions] = useState<ArtistSubscriptionsMap>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;

      if (Platform.OS === 'web') {
        setIsLoading(false);
        return;
      }

      try {
        // Get permission status
        const status = await getNotificationPermissionStatus();
        setPermissionStatus(status);

        // Load stored data
        const [storedReminders, storedSubscriptions] = await Promise.all([
          getShowReminders(),
          getArtistSubscriptions(),
        ]);

        setReminders(storedReminders);
        setSubscriptions(storedSubscriptions);

        // Cleanup expired reminders
        await cleanupExpiredReminders();
        const cleanedReminders = await getShowReminders();
        setReminders(cleanedReminders);
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const requestPermissions =
    useCallback(async (): Promise<NotificationPermissionStatus> => {
      if (Platform.OS === 'web') {
        return 'denied';
      }

      const status = await requestNotificationPermissions();
      setPermissionStatus(status);

      if (status === 'denied') {
        Alert.alert(
          'Notifications Disabled',
          'To receive show reminders, please enable notifications in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      }

      return status;
    }, []);

  const isShowReminderSet = useCallback(
    (showId: string): boolean => {
      return !!reminders[showId];
    },
    [reminders]
  );

  const getShowReminderValue = useCallback(
    (showId: string): ShowReminder | undefined => {
      return reminders[showId];
    },
    [reminders]
  );

  const toggleShowReminder = useCallback(
    async (params: ScheduleShowReminderParams): Promise<boolean> => {
      if (Platform.OS === 'web') {
        return false;
      }

      const { showId, showTitle, artistName, startDateUtc } = params;
      const existingReminder = reminders[showId];

      if (existingReminder) {
        // Cancel existing reminder
        await cancelShowReminder(existingReminder.notificationId);
        await removeShowReminder(showId);
        setReminders((prev) => {
          const updated = { ...prev };
          delete updated[showId];
          return updated;
        });
        return false;
      }

      // Request permissions if needed
      let currentPermission = permissionStatus;
      if (currentPermission !== 'granted') {
        currentPermission = await requestPermissions();
        if (currentPermission !== 'granted') {
          return false;
        }
      }

      // Schedule new reminder
      const notificationId = await scheduleShowReminder(params);
      if (!notificationId) {
        return false;
      }

      const newReminder: ShowReminder = {
        showId,
        showTitle,
        artistName,
        startDateUtc,
        notificationId,
        createdAt: new Date().toISOString(),
      };

      await setShowReminder(newReminder);
      setReminders((prev) => ({
        ...prev,
        [showId]: newReminder,
      }));

      return true;
    },
    [reminders, permissionStatus, requestPermissions]
  );

  const isArtistSubscribed = useCallback(
    (artistId: string): boolean => {
      return subscriptions[artistId]?.isActive ?? false;
    },
    [subscriptions]
  );

  const toggleArtistSubscription = useCallback(
    async (
      artistId: string,
      artistName: string,
      artistSlug: string,
      upcomingShows: ScheduleShowReminderParams[] = []
    ): Promise<boolean> => {
      if (Platform.OS === 'web') {
        return false;
      }

      const existingSubscription = subscriptions[artistId];

      if (existingSubscription?.isActive) {
        // Unsubscribe: remove the subscription and cancel any reminders that
        // were scheduled for this artist's upcoming shows.
        await removeArtistSubscription(artistId);
        setSubscriptions((prev) => {
          const updated = { ...prev };
          delete updated[artistId];
          return updated;
        });

        for (const show of upcomingShows) {
          const existingReminder = reminders[show.showId];
          if (existingReminder) {
            await cancelShowReminder(existingReminder.notificationId);
            await removeShowReminder(show.showId);
            setReminders((prev) => {
              const updated = { ...prev };
              delete updated[show.showId];
              return updated;
            });
          }
        }
        return false;
      }

      // Request permissions if needed
      let currentPermission = permissionStatus;
      if (currentPermission !== 'granted') {
        currentPermission = await requestPermissions();
        if (currentPermission !== 'granted') {
          return false;
        }
      }

      // Subscribe
      const newSubscription: ArtistSubscription = {
        artistId,
        artistName,
        artistSlug,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      await setArtistSubscription(newSubscription);
      setSubscriptions((prev) => ({
        ...prev,
        [artistId]: newSubscription,
      }));

      // Schedule reminders for the artist's known upcoming shows so that
      // subscribing actually delivers notifications (mirrors the per-show
      // reminder path in toggleShowReminder).
      for (const show of upcomingShows) {
        if (!reminders[show.showId]) {
          const notificationId = await scheduleShowReminder(show);
          if (notificationId) {
            const newReminder: ShowReminder = {
              showId: show.showId,
              showTitle: show.showTitle,
              artistName: show.artistName,
              startDateUtc: show.startDateUtc,
              notificationId,
              createdAt: new Date().toISOString(),
            };
            await setShowReminder(newReminder);
            setReminders((prev) => ({
              ...prev,
              [show.showId]: newReminder,
            }));
          }
        }
      }

      return true;
    },
    [subscriptions, reminders, permissionStatus, requestPermissions]
  );

  const syncSubscribedArtistShows = useCallback(
    async (
      artistId: string,
      upcomingShows: ScheduleShowReminderParams[]
    ): Promise<void> => {
      if (Platform.OS === 'web') return;
      if (!subscriptions[artistId]?.isActive) return;

      // Schedule reminders for any upcoming shows that don't have reminders
      for (const show of upcomingShows) {
        if (!reminders[show.showId]) {
          const notificationId = await scheduleShowReminder(show);
          if (notificationId) {
            const newReminder: ShowReminder = {
              showId: show.showId,
              showTitle: show.showTitle,
              artistName: show.artistName,
              startDateUtc: show.startDateUtc,
              notificationId,
              createdAt: new Date().toISOString(),
            };
            await setShowReminder(newReminder);
            setReminders((prev) => ({
              ...prev,
              [show.showId]: newReminder,
            }));
          }
        }
      }
    },
    [subscriptions, reminders]
  );

  // Launch re-sync: once per app session (after subscriptions/reminders have
  // hydrated from storage and permission is known), roll every active artist
  // subscription forward by fetching that artist's next known show and
  // scheduling a reminder for it if one isn't already set. This covers shows
  // announced after the user subscribed, and re-arms the subscription once a
  // previously reminded show has aired/passed. Relies on the existing
  // `!reminders[showId]` dedupe in syncSubscribedArtistShows.
  const hasSyncedSubscriptions = useRef(false);
  useEffect(() => {
    if (hasSyncedSubscriptions.current) return;
    if (Platform.OS === 'web') return;
    // Wait until hydration from storage has completed (initialize flips this).
    if (isLoading) return;
    if (permissionStatus !== 'granted') return;

    const activeArtistIds = Object.values(subscriptions)
      .filter((sub) => sub.isActive)
      .map((sub) => sub.artistId);
    if (activeArtistIds.length === 0) return;

    // Only run the sync body once we actually have active subscriptions.
    hasSyncedSubscriptions.current = true;

    const resyncSubscriptions = async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      for (const artistId of activeArtistIds) {
        try {
          const nextShow = await fetchNextShowForArtist(artistId, timezone);
          if (!nextShow) continue;

          const sub = subscriptions[artistId];
          await syncSubscribedArtistShows(artistId, [
            {
              showId: nextShow.id,
              showTitle: nextShow.title,
              artistName: sub?.artistName,
              startDateUtc: nextShow.startDateUtc,
            },
          ]);
        } catch (error) {
          console.error(
            `Failed to re-sync reminders for artist ${artistId}:`,
            error
          );
        }
      }
    };

    resyncSubscriptions();
  }, [isLoading, permissionStatus, subscriptions, syncSubscribedArtistShows]);

  return (
    <NotificationContext.Provider
      value={{
        permissionStatus,
        requestPermissions,
        reminders,
        isShowReminderSet,
        toggleShowReminder,
        getShowReminder: getShowReminderValue,
        subscriptions,
        isArtistSubscribed,
        toggleArtistSubscription,
        syncSubscribedArtistShows,
        isLoading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextType => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotificationContext must be used within a NotificationProvider'
    );
  }
  return ctx;
};
