import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** Current timezone, updated when it changes. */
export function useTimezoneChange() {
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const timezoneRef = useRef(timezone);

  useEffect(() => {
    const checkTimezone = () => {
      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (currentTimezone !== timezoneRef.current) {
        timezoneRef.current = currentTimezone;
        setTimezone(currentTimezone);
      }
    };

    // Re-check when the app becomes active (settings change or travel).
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkTimezone();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return timezone;
} 