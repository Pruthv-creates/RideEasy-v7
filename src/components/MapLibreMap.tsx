import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navigation } from 'lucide-react';

interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  is_busy?: boolean;
}

interface MapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  drivers?: DriverLocation[];
  route?: [number, number][]; // Active segment [[lng, lat]]
  fullRoute?: [number, number][]; // Total trip [[lng, lat]]
  pickup?: [number, number];
  destination?: [number, number];
  height?: string;
  onMapClick?: (lng: number, lat: number) => void;
  onLocateMe?: () => void;
}

const MapLibreMap: React.FC<MapProps> = ({
  center = [72.8777, 19.0760],
  zoom = 14,
  drivers = [],
  route,
  fullRoute,
  pickup,
  destination,
  height = "400px",
  onMapClick,
  onLocateMe
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const driverMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: center,
      zoom: zoom,
    });

    map.current.on('load', () => {
      map.current?.resize();
    });

    // Fallback resize
    setTimeout(() => {
        map.current?.resize();
    }, 500);

    map.current.on('click', (e) => {
      if (onMapClick) onMapClick(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update center
  useEffect(() => {
    if (map.current) {
      map.current.setCenter(center);
      map.current.resize();
    }
  }, [center]);

  // Update drivers
  useEffect(() => {
    if (!map.current) return;

    // Remove drivers that are gone
    const currentIds = new Set(drivers.map(d => d.id));
    driverMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        driverMarkers.current.delete(id);
      }
    });

    // Add or update drivers
    drivers.forEach(driver => {
      const existing = driverMarkers.current.get(driver.id);
      if (existing) {
        existing.setLngLat([driver.lng, driver.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        // Premium Nav Arrow Marker (Matches Screenshot)
        el.innerHTML = `
            <div class="flex items-center justify-center w-10 h-10 bg-white rounded-full border-4 border-black shadow-2xl ring-4 ring-white/20 transition-all duration-300">
                <svg viewBox="0 0 24 24" class="w-5 h-5 fill-black transform -rotate-45">
                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                </svg>
            </div>
        `;
        el.style.transition = 'all 0.5s ease-out';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([driver.lng, driver.lat])
          .addTo(map.current!);
        driverMarkers.current.set(driver.id, marker);
      }
    });
  }, [drivers]);

  // Update Route
  useEffect(() => {
    if (!map.current) return;

    const drawRoute = () => {
      if (!map.current) return;
      if (!map.current.isStyleLoaded()) {
        map.current.once('style.load', drawRoute);
        return;
      }

      // 1. FULL ROUTE (SHADOW)
      if (fullRoute) {
        const sourceId = 'full-route-source';
        const layerId = 'full-route-layer';
        const geojson: any = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: fullRoute }};
        
        const source = map.current.getSource(sourceId);
        if (source && 'setData' in source) {
            (source as any).setData(geojson);
        } else {
            map.current.addSource(sourceId, { type: 'geojson', data: geojson });
            map.current.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#cbd5e1', 'line-width': 10, 'line-opacity': 0.4 }
            });
        }
      }

      // 2. ACTIVE ROUTE (BLACK)
      if (route) {
        const sourceId = 'active-route-source';
        const layerId = 'active-route-layer';
        const geojson: any = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route }};

        const source = map.current.getSource(sourceId);
        if (source && 'setData' in source) {
            (source as any).setData(geojson);
        } else {
            map.current.addSource(sourceId, { type: 'geojson', data: geojson });
            map.current.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#000000', 'line-width': 8, 'line-opacity': 1.0 }
            });
        }
      }
    };

    drawRoute();
  }, [route, fullRoute]);

  // Pickup and Destination Markers
  useEffect(() => {
    if (!map.current) return;
    
    // Clear existing special markers
    markers.current.forEach(m => m.remove());
    markers.current = [];

    if (pickup) {
        const el = document.createElement('div');
        el.className = 'pickup-marker';
        // Target Marker: Black circle with white square (Matches Screenshot)
        el.innerHTML = `
            <div class="flex items-center justify-center w-10 h-10 bg-black rounded-full border-4 border-white shadow-2xl">
                <div class="w-3 h-3 bg-white rounded-sm"></div>
            </div>
        `;
        const m = new maplibregl.Marker({ element: el }).setLngLat(pickup).addTo(map.current);
        markers.current.push(m);
    }

    if (destination) {
        const el = document.createElement('div');
        el.className = 'destination-marker';
        // Destination Marker: White circle with black border and black square (Matches Screenshot)
        el.innerHTML = `
            <div class="flex items-center justify-center w-10 h-10 bg-white rounded-full border-4 border-black shadow-2xl">
                <div class="w-3 h-3 bg-black rounded-sm"></div>
            </div>
        `;
        const m = new maplibregl.Marker({ element: el }).setLngLat(destination).addTo(map.current);
        markers.current.push(m);
    }
  }, [pickup, destination]);

  return (
    <div className="relative w-full h-full overflow-hidden">
        <div ref={mapContainer} style={{ width: '100%', height }} />
        
        {onLocateMe && (
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onLocateMe();
                }}
                className="absolute bottom-6 right-6 w-12 h-12 bg-white rounded-2xl shadow-2xl flex items-center justify-center border border-border/50 hover:bg-muted transition-all duration-300 z-50 group"
            >
                <Navigation className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            </button>
        )}
    </div>
  );
};

export default MapLibreMap;
