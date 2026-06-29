/**
 * Formats a time in 24-hour format, e.g. "16:00".
 */
export function formatClockTime(input: string | Date, timeZone?: string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}
