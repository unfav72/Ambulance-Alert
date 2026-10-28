// Geodetic calculations and GPS telemetry sanity validation

const EARTH_RADIUS_METERS = 6371000;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates Great-Circle distance using Haversine formula
 * Returns distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Computes compass bearing in degrees (0 - 360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  let brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Validates coordinate boundary [-90..90] and [-180..180]
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (typeof latitude !== 'number' || isNaN(latitude)) return false;
  if (typeof longitude !== 'number' || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

/**
 * Computes speed in km/h between two observations
 */
export function calculateCalculatedSpeed(
  lat1: number,
  lon1: number,
  time1: Date,
  lat2: number,
  lon2: number,
  time2: Date
): number {
  const distanceMeters = calculateHaversineDistance(lat1, lon1, lat2, lon2);
  const deltaSeconds = Math.abs((time2.getTime() - time1.getTime()) / 1000);

  if (deltaSeconds <= 0) return 0;
  const metersPerSecond = distanceMeters / deltaSeconds;
  return Math.round((metersPerSecond * 3.6) * 100) / 100; // km/h
}

/**
 * Verifies if movement velocity is physically plausible for emergency vehicle
 * Maximum plausible speed for terrestrial emergency response vehicle: 180 km/h (50 m/s)
 */
export function isSpeedPlausible(speedKmH: number, maxKmH = 180): boolean {
  return speedKmH >= 0 && speedKmH <= maxKmH;
}
