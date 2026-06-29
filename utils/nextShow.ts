// utils/nextShow.ts
//
// Shared helpers for resolving an artist's next (non-repeat) upcoming show
// from the RadioCult schedule, plus a friendly date formatter. Used by the
// artist detail page and the Active reminders screen.

import { apiKey } from '../config';

const STATION_ID = 'eist-radio';

const REPEAT_PATTERNS = [
  'éist arís',
  'eist arís',
  'eist aris',
  'replay',
  'repeat',
  'from the archives',
];

export type ScheduleItem = {
  id: string;
  title: string;
  startDateUtc: string;
  endDateUtc: string;
  artistIds?: string[];
};

export async function fetchNextShowForArtist(
  artistId: string,
  timezone: string
): Promise<ScheduleItem | null> {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const startDate = now.toISOString();
  const endDate = weekAhead.toISOString();

  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
    `?startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}` +
    `&timeZone=${encodeURIComponent(timezone)}`;

  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { schedules?: ScheduleItem[] };
    const schedules = json.schedules || [];

    for (const show of schedules) {
      if (show.artistIds?.includes(artistId)) {
        const titleLower = show.title.toLowerCase();
        const isRepeat = REPEAT_PATTERNS.some((pattern) =>
          titleLower.includes(pattern)
        );
        if (!isRepeat) {
          return show;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function formatNextShowDate(isoString: string): string {
  const showTime = new Date(isoString);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
  const showDateStr = showTime.toISOString().split('T')[0];

  const timeStr = showTime
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase()
    .replace(' ', '');

  if (showDateStr === todayStr) {
    return `Today, ${timeStr}`;
  } else if (showDateStr === tomorrowStr) {
    return `Tomorrow, ${timeStr}`;
  } else {
    const dateFormatted = showTime.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `${dateFormatted}, ${timeStr}`;
  }
}
