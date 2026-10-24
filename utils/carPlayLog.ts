// utils/carPlayLog.ts
// Breadcrumbs for CarPlay debugging, written to the native log file in EistCarPlayBridge (CarPlay builds only).
// Read them on the carplay-log screen (eistapp://carplay-log).
import { NativeModules, Platform } from 'react-native';

const bridge = Platform.OS === 'ios' ? NativeModules.EistCarPlayBridge : undefined;

export const isCarPlayLogAvailable = (): boolean => !!bridge?.appendLog;

export const carPlayLog = (message: string): void => {
  if (!bridge?.appendLog) return;
  console.log('[EistCarPlay]', message);
  bridge.appendLog(message);
};

export const readCarPlayLog = async (): Promise<string> =>
  bridge?.readLog ? bridge.readLog() : '';

export const clearCarPlayLog = (): void => {
  bridge?.clearLog?.();
};
