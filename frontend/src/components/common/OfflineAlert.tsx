import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';

export const OfflineAlert: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-red-950/95 border-b border-red-700 text-red-200 px-4 py-2.5 text-xs flex items-center justify-center gap-2 sticky top-0 z-[100] shadow-xl">
      <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
      <span>
        <strong>Offline Connection Warning:</strong> Device is disconnected from network. Submissions or GPS telemetry will <strong>NOT</strong> be received, assigned, or dispatched until network connectivity is re-established. If this is an immediate life crisis, use emergency telephone lines directly.
      </span>
    </div>
  );
};
