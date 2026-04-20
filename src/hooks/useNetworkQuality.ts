import { useState, useEffect } from 'react';

export interface NetworkQuality {
  downlink: number; // Mbps
  rtt: number; // ms
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  isSafe: boolean;
}

export function useNetworkQuality() {
  const [quality, setQuality] = useState<NetworkQuality>({
    downlink: 10,
    rtt: 50,
    effectiveType: '4g',
    isSafe: true
  });

  useEffect(() => {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    const updateQuality = () => {
      if (connection) {
        const { downlink, rtt, effectiveType } = connection;
        // Relaxed Logic: Safe if RTT < 600ms (was 300) and downlink > 0.5Mbps (was 1)
        const isSafe = rtt < 600 && downlink > 0.5;
        setQuality({ downlink, rtt, effectiveType, isSafe });
      }
    };

    if (connection) {
      connection.addEventListener('change', updateQuality);
      updateQuality();
    }

    return () => {
      if (connection) {
        connection.removeEventListener('change', updateQuality);
      }
    };
  }, []);

  return quality;
}
