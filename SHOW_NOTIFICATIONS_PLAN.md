# Show Notification Feature Plan

## Overview
Add local push notifications for show reminders with two entry points:
1. **Per-show bell button** on schedule page - notify for individual upcoming shows
2. **Artist subscribe button** on artist page - notify for all shows by that artist

## Library Choice
**`expo-notifications`** - Native Expo integration, supports local scheduled notifications, works when app is killed/backgrounded, no additional native linking required.

## Architecture

### New Files to Create

| File | Purpose |
|------|---------|
| `types/notifications.ts` | TypeScript interfaces for notification data |
| `context/NotificationContext.tsx` | Global state for reminders & subscriptions |
| `hooks/useNotifications.ts` | Main hook wrapping the context |
| `utils/notificationScheduler.ts` | Scheduling/canceling notification logic |
| `utils/notificationStorage.ts` | AsyncStorage persistence layer |
| `components/ReminderButton.tsx` | Bell icon toggle for individual shows |
| `components/ArtistNotifyButton.tsx` | Subscribe button for artist pages |

### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `expo-notifications` dependency |
| `app.config.ts` | Add notification permissions + plugin config |
| `app/_layout.tsx` | Wrap app with `NotificationProvider` |
| `app/(tabs)/schedule.tsx` | Add bell icon to each show row |
| `app/(tabs)/artist/[slug].tsx` | Add subscribe button to hero section |
| `app/(tabs)/show/[slug].tsx` | Add reminder bell near share button |

## Data Persistence (AsyncStorage)

```typescript
// Key: 'eist_show_reminders'
// Value: Map of showId -> reminder details
{
  "show-123": {
    showId: string,
    showTitle: string,
    artistName: string,
    startDateUtc: string,      // ISO date
    notificationId: string,    // expo-notifications ID for cancellation
  }
}

// Key: 'eist_artist_subscriptions'
// Value: Map of artistId -> subscription
{
  "artist-456": {
    artistId: string,
    artistName: string,
    artistSlug: string,
    isActive: boolean,
  }
}
```

## Platform Configuration

### iOS (`app.config.ts`)
```typescript
ios: {
  infoPlist: {
    UIBackgroundModes: ["audio", "remote-notification"],
  }
}
```

### Android (`app.config.ts`)
```typescript
android: {
  permissions: [
    // existing permissions...
    "android.permission.POST_NOTIFICATIONS",      // Required Android 13+
    "android.permission.SCHEDULE_EXACT_ALARM",    // Precise timing
    "android.permission.RECEIVE_BOOT_COMPLETED",  // Restore after reboot
  ]
},
plugins: [
  ["expo-notifications", {
    icon: "./assets/images/notification-icon.png",
    color: "#AFFC41"
  }]
]
```

### Web
Hide notification UI on web (`Platform.OS === 'web'`) - expo-notifications doesn't support web.

## Core Logic

### Scheduling a Show Reminder
```typescript
async function scheduleShowReminder(show: RawScheduleItem, artistName?: string) {
  const showStart = new Date(show.startDateUtc);
  const reminderTime = new Date(showStart.getTime() - 5 * 60 * 1000); // 5 min before

  if (reminderTime <= new Date()) {
    // Show already started or too close - don't schedule
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Show Starting Soon',
      body: `${show.title}${artistName ? ` with ${artistName}` : ''} starts in 5 minutes`,
      data: { showId: show.id, type: 'show_reminder' },
      sound: true,
    },
    trigger: { date: reminderTime },
  });

  return notificationId;
}
```

### Artist Subscription Sync
When user subscribes to an artist, or when schedule refreshes:
1. Get all upcoming shows with that `artistId` in `artistIds[]`
2. Schedule notifications for any not already scheduled
3. Cancel notifications for shows no longer in schedule

## UI Components

### ReminderButton (Schedule & Show pages)
- Bell outline icon (not set) / Bell filled icon (set)
- Tap to toggle reminder on/off
- Haptic feedback on toggle
- Disabled state for shows that already started

### ArtistNotifyButton (Artist page)
- Styled button below social links
- Text: "Notify me" (off) / "Notifications on" (on)
- Bell icon with button
- Toggles subscription for all shows by that artist

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Permission denied | Show alert with link to device settings |
| Show already started | Disable bell, show "Show started" tooltip |
| Duplicate notifications | Check existing before scheduling; one notification per show |
| Schedule data updates | Re-sync on schedule fetch; cancel stale, add new |
| App killed | expo-notifications persists to OS scheduler |
| Timezone change | Notifications scheduled in UTC; display in local time |
| Artist + individual reminder | Individual takes precedence; no duplicates |

## Implementation Sequence

1. **Foundation**: Install expo-notifications, update app.config.ts, create types
2. **Context & Storage**: NotificationContext, AsyncStorage persistence utils
3. **Schedule Page**: Add ReminderButton to show rows
4. **Artist Page**: Add ArtistNotifyButton, implement subscription sync
5. **Show Detail Page**: Add reminder button
6. **Polish**: Permission prompts, error handling, cleanup on app launch

## Verification

1. **iOS Testing**:
   - Build with `eas build --platform ios --profile development`
   - Test permission prompt appears on first bell tap
   - Set reminder, background app, verify notification fires
   - Test artist subscription schedules multiple shows

2. **Android Testing**:
   - Build with `eas build --platform android --profile development`
   - Test notification permission (Android 13+)
   - Verify notification icon appears correctly
   - Test notification after device reboot

3. **Functional Tests**:
   - Toggle reminder on/off, verify AsyncStorage updates
   - Subscribe to artist, verify all upcoming shows get notifications
   - Change timezone, verify notification still fires at correct time
   - Pull to refresh schedule, verify new shows get notifications for subscribed artists
