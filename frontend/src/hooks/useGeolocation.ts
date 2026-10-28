import { useState, useEffect, useCallback, useRef } from 'react';

export type TrackingStatus = 'LIVE' | 'LAST_KNOWN' | 'STALE' | 'UNAVAILABLE' | 'PERMISSION_DENIED' | 'OFF';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string | null;
  status: TrackingStatus;
  errorMessage: string | null;
  isBackgroundRestricted: boolean;
}

export function useGeolocation(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    speed: null,
    heading: null,
    timestamp: null,
    status: 'OFF',
    errorMessage: null,
    isBackgroundRestricted: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const staleTimerRef = useRef<any>(null);

  // Check for stale position (if no update for > 45s)
  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    staleTimerRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.status === 'LIVE') {
          return { ...prev, status: 'STALE' };
        }
        return prev;
      });
    }, 45000);
  }, []);

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({
        ...prev,
        status: 'UNAVAILABLE',
        errorMessage: 'Geolocation API is not supported by your browser',
      }));
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options?.enableHighAccuracy ?? true,
      timeout: options?.timeout ?? 15000,
      maximumAge: options?.maximumAge ?? 5000,
    };

    const successHandler = (position: GeolocationPosition) => {
      resetStaleTimer();
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : null, // convert m/s to km/h
        heading: position.coords.heading ?? null,
        timestamp: new Date(position.timestamp).toISOString(),
        status: 'LIVE',
        errorMessage: null,
        isBackgroundRestricted: document.visibilityState === 'hidden',
      });
    };

    const errorHandler = (error: GeolocationPositionError) => {
      let status: TrackingStatus = 'UNAVAILABLE';
      let message = error.message;

      if (error.code === error.PERMISSION_DENIED) {
        status = 'PERMISSION_DENIED';
        message = 'Location permission was denied. Enable GPS in browser settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        status = 'LAST_KNOWN';
        message = 'GPS signal lost or unavailable.';
      } else if (error.code === error.TIMEOUT) {
        status = 'STALE';
        message = 'GPS position acquisition timed out.';
      }

      setState((prev) => ({
        ...prev,
        status,
        errorMessage: message,
      }));
    };

    try {
      const id = navigator.geolocation.watchPosition(successHandler, errorHandler, geoOptions);
      watchIdRef.current = id;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: 'UNAVAILABLE',
        errorMessage: err.message,
      }));
    }
  }, [options, resetStaleTimer]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    setState((prev) => ({
      ...prev,
      status: 'OFF',
      errorMessage: null,
    }));
  }, []);

  // Monitor visibility state changes (handling mobile PWA background limitations)
  useEffect(() => {
    const handleVisibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      setState((prev) => ({
        ...prev,
        isBackgroundRestricted: isHidden,
      }));
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    isTracking: watchIdRef.current !== null,
  };
}
