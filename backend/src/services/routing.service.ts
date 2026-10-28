import { env } from '../config/env.js';
import { calculateHaversineDistance } from '../utils/geo.js';
import { logger } from '../utils/logger.js';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][]; // [lat, lng] array for Leaflet
  provider: 'OSRM' | 'HAVERSINE_FALLBACK';
  isFallback: boolean;
  statusMessage: string;
}

export interface RoutingProviderStatus {
  provider: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  lastChecked: string;
  endpoint: string;
  lastError?: string;
}

class RoutingService {
  private lastStatus: RoutingProviderStatus = {
    provider: 'OSRM',
    status: 'ONLINE',
    lastChecked: new Date().toISOString(),
    endpoint: env.OSRM_ROUTING_URL,
  };

  public getStatus(): RoutingProviderStatus {
    return { ...this.lastStatus };
  }

  /**
   * Computes route and travel time between origin and destination coordinates.
   * If routing provider fails or times out, falls back to geodesic Haversine calculation
   * with explicit fallback indicator (never fabricating fake ETA).
   */
  public async getRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteResult> {
    const url = `${env.OSRM_ROUTING_URL}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EmergencyAmbulanceCoordinationSystem/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`OSRM routing failed: ${data.message || data.code || 'No route found'}`);
      }

      const primaryRoute = data.routes[0];
      const distanceMeters = Math.round(primaryRoute.distance);
      const durationSeconds = Math.round(primaryRoute.duration);

      // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
      const geometry: [number, number][] = primaryRoute.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
      );

      this.lastStatus = {
        provider: 'OSRM',
        status: 'ONLINE',
        lastChecked: new Date().toISOString(),
        endpoint: env.OSRM_ROUTING_URL,
      };

      return {
        distanceMeters,
        durationSeconds,
        geometry,
        provider: 'OSRM',
        isFallback: false,
        statusMessage: 'Live turn-by-turn route and ETA calculated via OSRM',
      };
    } catch (err: any) {
      logger.warn('Routing provider unreachable or failed. Falling back to geodesic estimation', {
        error: err.message,
        origin: [originLat, originLng],
        destination: [destLat, destLng],
      });

      this.lastStatus = {
        provider: 'OSRM',
        status: 'DEGRADED',
        lastChecked: new Date().toISOString(),
        endpoint: env.OSRM_ROUTING_URL,
        lastError: err.message,
      };

      // Fallback: Compute Haversine distance
      const distanceMeters = calculateHaversineDistance(originLat, originLng, destLat, destLng);
      // Emergency response estimated speed: 40 km/h = 11.11 m/s (factoring in urban traffic & blue-light clearance)
      const estimatedMetersPerSecond = 11.11;
      const durationSeconds = Math.round(distanceMeters / estimatedMetersPerSecond);

      // Direct line geometry [origin -> destination]
      const geometry: [number, number][] = [
        [originLat, originLng],
        [destLat, destLng],
      ];

      return {
        distanceMeters,
        durationSeconds,
        geometry,
        provider: 'HAVERSINE_FALLBACK',
        isFallback: true,
        statusMessage: `Route provider offline (${err.message}). ETA estimated via direct geodesic vector at 40 km/h emergency speed.`,
      };
    }
  }
}

export const routingService = new RoutingService();
