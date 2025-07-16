import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Custom hook to detect timezone changes
 * Returns the current timezone and automatically updates when it changes
 */
export function useTimezoneChange() {
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const timezoneRef = useRef(timezone);

  useEffect(() => {
    const checkTimezone = () => {
      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (currentTimezone !== timezoneRef.current) {
        console.log('Timezone changed from', timezoneRef.current, 'to', currentTimezone);
        timezoneRef.current = currentTimezone;
        setTimezone(currentTimezone);
      }
    };

    // Check timezone when app becomes active (most common scenario for timezone changes)
    // This covers the vast majority of timezone change scenarios:
    // - User changes timezone in system settings
    // - User travels to different timezone
    // - User returns to app after timezone change
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