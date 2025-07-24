import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
  isWifi: boolean;
  isCellular: boolean;
}

export function useNetworkConnectivity() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true, // Assume connected initially
    isInternetReachable: true,
    type: null,
    isWifi: false,
    isCellular: false,
  });

  const previousNetworkState = useRef<NetworkState | null>(null);

  useEffect(() => {
    // Get initial network state
    const getInitialState = async () => {
      try {
        const state = await NetInfo.fetch();
        const newState = mapNetInfoToNetworkState(state);
        setNetworkState(newState);
        previousNetworkState.current = newState;
      } catch (error) {
        console.error('Failed to get initial network state:', error);
      }
    };

    getInitialState();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const newState = mapNetInfoToNetworkState(state);
      
      // Check if there's a meaningful network change
      const hasNetworkChanged = hasSignificantNetworkChange(
        previousNetworkState.current,
        newState
      );

      if (hasNetworkChanged) {
        console.log('Network connectivity changed:', {
          from: previousNetworkState.current,
          to: newState,
        });
        
        previousNetworkState.current = newState;
        setNetworkState(newState);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return networkState;
}

function mapNetInfoToNetworkState(state: NetInfoState): NetworkState {
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
    isWifi: state.type === 'wifi',
    isCellular: state.type === 'cellular',
  };
}

function hasSignificantNetworkChange(
  previous: NetworkState | null,
  current: NetworkState
): boolean {
  if (!previous) return true;

  // Check if connection status changed
  if (previous.isConnected !== current.isConnected) return true;

  // Check if internet reachability changed
  if (previous.isInternetReachable !== current.isInternetReachable) return true;

  // Check if network type changed (e.g., wifi to cellular)
  if (previous.type !== current.type) return true;

  return false;
} 