// hooks/useNetworkConnectivity.ts
import { useNetInfo } from '@react-native-community/netinfo';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
  isWifi: boolean;
  isCellular: boolean;
}

// Minimal connectivity hook
export function useNetworkConnectivity(): NetworkState {
  const { isConnected, isInternetReachable, type } = useNetInfo();

  const t = type ?? null;

  return {
    isConnected: Boolean(isConnected),
    isInternetReachable: isInternetReachable ?? null,
    type: t,
    isWifi: t === 'wifi',
    isCellular: t === 'cellular',
  };
}

export default useNetworkConnectivity;
