import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'AMBULANCE' | 'PICKUP' | 'HOSPITAL';
  details?: string;
  heading?: number;
}

interface EmergencyMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routePolyline?: [number, number][];
  className?: string;
}

// Custom SVGs rendered directly as Leaflet DivIcons to avoid broken asset URL issues
const createAmbulanceIcon = (callSign: string) => {
  return L.divIcon({
    className: 'custom-ambulance-marker',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%);">
        <div style="background:#06b6d4; color:#060a14; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; font-family:monospace; border:1px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.6); white-space:nowrap; margin-bottom:2px;">
          ${callSign}
        </div>
        <div style="width:34px; height:34px; background:#0f172a; border:2px solid #22d3ee; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 15px #06b6d4;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const createPickupIcon = () => {
  return L.divIcon({
    className: 'custom-pickup-marker',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%);">
        <div style="width:36px; height:36px; background:#7f1d1d; border:2px solid #f87171; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 20px #ef4444; animation: pulse 1s infinite;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M2 12h20"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const createHospitalIcon = (name: string) => {
  return L.divIcon({
    className: 'custom-hospital-marker',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%);">
        <div style="background:#047857; color:#ecfdf5; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; border:1px solid #10b981; box-shadow:0 2px 6px rgba(0,0,0,0.6); white-space:nowrap; margin-bottom:2px;">
          ${name}
        </div>
        <div style="width:32px; height:32px; background:#064e3b; border:2px solid #34d399; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px #10b981;">
          <span style="color:#ffffff; font-weight:900; font-size:16px;">H</span>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export const EmergencyMap: React.FC<EmergencyMapProps> = ({
  center = [13.0827, 80.2707], // Default coordinates (Chennai central emergency hub)
  zoom = 13,
  markers = [],
  routePolyline = [],
  className = 'w-full h-full min-h-[380px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(center, zoom);

      // OpenStreetMap Tile Layer (cached via PWA service worker)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | AmbulanceOps Dispatch',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Clear existing markers
    markersLayer.clearLayers();

    const boundsPoints: [number, number][] = [];

    // Add Markers
    markers.forEach((m) => {
      let icon = createPickupIcon();
      if (m.type === 'AMBULANCE') {
        icon = createAmbulanceIcon(m.title);
      } else if (m.type === 'HOSPITAL') {
        icon = createHospitalIcon(m.title);
      }

      const marker = L.marker([m.lat, m.lng], { icon });

      if (m.details) {
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #f8fafc;">
            <strong style="font-size:13px; color: #38bdf8;">${m.title}</strong>
            <p style="margin: 4px 0 0 0; font-size:11px; color:#cbd5e1;">${m.details}</p>
          </div>
        `);
      }

      marker.addTo(markersLayer);
      boundsPoints.push([m.lat, m.lng]);
    });

    // Handle Route Polyline
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routePolyline && routePolyline.length > 1) {
      routeLayerRef.current = L.polyline(routePolyline, {
        color: '#22d3ee',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      routePolyline.forEach((pt) => boundsPoints.push(pt));
    }

    // Auto-fit bounds if we have multiple points
    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50], maxZoom: 15 });
    } else if (boundsPoints.length === 1) {
      map.panTo(boundsPoints[0]);
    }
  }, [markers, routePolyline]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-navy-700/80 shadow-2xl ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />
    </div>
  );
};
