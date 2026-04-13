import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navigation } from 'lucide-react';

import taxiPng from '@/assets/taxi map image.png';

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
  const driverHeadings = useRef<Map<string, number>>(new Map());

  // Calculate heading between two points
  const getHeading = (p1: [number, number], p2: [number, number]) => {
    const dLng = p2[0] - p1[0];
    const dLat = p2[1] - p1[1];
    return (Math.atan2(dLng, dLat) * 180) / Math.PI;
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    console.log('🗺️ [Map] Initializing MapLibre GL map...');
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: center,
      zoom: zoom,
      attributionControl: false
    });

    map.current.addControl(new maplibregl.AttributionControl(), 'bottom-left');

    map.current.on('load', () => {
      console.log('✅ [Map] Map fully loaded — drawing initial routes');
      drawRoute();
      map.current?.resize();
    });

    // NOTE: styledata listener intentionally REMOVED.
    // It fired on every pan/zoom with a stale closure (empty route data),
    // overwriting the drawn route line with empty coordinates.
    // The useEffect([route, fullRoute]) below handles all re-draws correctly.

    map.current.on('error', (e) => {
      console.error('🔴 [Map] MapLibre internal error:', e.error?.message ?? e);
    });

    map.current.on('click', (e) => {
      if (onMapClick) onMapClick(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      console.log('🧹 [Map] Removing map instance');
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update center smoothly
  useEffect(() => {
    if (map.current) {
        map.current.easeTo({
            center: center,
            duration: 1500,
            essential: true
        });
    }
  }, [center]);

  // Update drivers with rotation
  useEffect(() => {
    if (!map.current) return;

    // Remove drivers that are gone
    const currentIds = new Set(drivers.map(d => d.id));
    driverMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        driverMarkers.current.delete(id);
        driverHeadings.current.delete(id);
      }
    });

    // Add or update drivers
    drivers.forEach(driver => {
      const existing = driverMarkers.current.get(driver.id);
      const newPos: [number, number] = [driver.lng, driver.lat];
      
      if (existing) {
        const oldPos = existing.getLngLat();
        const heading = getHeading([oldPos.lng, oldPos.lat], newPos);
        
        // Update rotation if there's movement
        if (Math.abs(oldPos.lng - driver.lng) > 0.00001 || Math.abs(oldPos.lat - driver.lat) > 0.00001) {
            const el = existing.getElement();
            const icon = el.querySelector('.car-icon') as HTMLElement;
            if (icon) {
                icon.style.transform = `rotate(${heading}deg)`;
            }
            driverHeadings.current.set(driver.id, heading);
        }
        
        existing.setLngLat(newPos);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        // Taxi Icon from assets
        el.innerHTML = `
            <div class="relative w-12 h-12 flex items-center justify-center drop-shadow-2xl group">
                <img src="${taxiPng}" class="car-icon w-10 h-10 object-contain transition-all duration-700 ease-in-out" />
            </div>
        `;
        el.style.transition = 'all 1.0s linear'; // Smooth linear interpolation for movement

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(newPos)
          .addTo(map.current!);
        driverMarkers.current.set(driver.id, marker);
      }
    });
  }, [drivers]);

  const drawRoute = () => {
    if (!map.current) { console.warn('⚠️ [Map] drawRoute called but map is null — skipping'); return; }
    if (!map.current.isStyleLoaded()) {
      console.log('⏳ [Map] Style not loaded yet — waiting 200ms to draw route...');
      setTimeout(drawRoute, 200);
      return;
    }

    // 1. FULL ROUTE (THE TOTAL PATH — faint dashed line)
    if (fullRoute && fullRoute.length > 0) {
      console.log(`🗺️ [Map] Drawing full route: ${fullRoute.length} points`);
      const sourceId = 'full-route-source';
      const layerId  = 'full-route-layer';
      const geojson: any = { 
        type: 'FeatureCollection', 
        features: [{
          type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: fullRoute }
        }]
      };
      
      if (map.current.getSource(sourceId)) {
        try {
          (map.current.getSource(sourceId) as any).setData(geojson);
          console.log('✅ [Map] Full route source updated via setData');
        } catch(e) {
          console.error('🔴 [Map] setData on full-route-source threw — probable MapLibre internal crash:', e);
        }
      } else {
        console.log('🏗️ [Map] Creating full-route-source and layer for the first time');
        map.current.addSource(sourceId, { type: 'geojson', data: geojson });
        map.current.addLayer({
          id: layerId, type: 'line', source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#94a3b8', 'line-width': 3, 'line-opacity': 0.4, 'line-dasharray': [2, 3] }
        });
      }
      if (map.current.getLayer(layerId)) map.current.moveLayer(layerId);
    } else {
      console.log('⏭️ [Map] No fullRoute data — skipping full route draw');
    }

    // 2. ACTIVE ROUTE (REMAINING PATH — solid black)
    // lineMetrics intentionally omitted — it causes 'jt is not defined' crash
    // in MapLibre when setData() is called after line-gradient is applied.
    if (route && route.length > 0) {
      console.log(`🗺️ [Map] Drawing active route: ${route.length} points`);
      const sourceId = 'active-route-source';
      const layerId  = 'active-route-layer';
      const casingId = 'active-route-casing';
      const geojson: any = { 
        type: 'FeatureCollection', 
        features: [{
          type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route }
        }]
      };

      if (map.current.getSource(sourceId)) {
        try {
          (map.current.getSource(sourceId) as any).setData(geojson);
          console.log('✅ [Map] Active route source updated via setData');
        } catch(e) {
          console.error('🔴 [Map] setData on active-route-source threw — probable MapLibre internal crash:', e);
        }
      } else {
        console.log('🏗️ [Map] Creating active-route-source, casing and main layer for the first time');
        map.current.addSource(sourceId, { type: 'geojson', data: geojson });
        map.current.addLayer({
          id: casingId, type: 'line', source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 1 }
        });
        map.current.addLayer({
          id: layerId, type: 'line', source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#1e293b', 'line-width': 5, 'line-opacity': 1 }
        });
      }
      if (map.current.getLayer(casingId)) map.current.moveLayer(casingId);
      if (map.current.getLayer(layerId))  map.current.moveLayer(layerId);
    } else {
      console.log('⏭️ [Map] No active route data — skipping active route draw');
    }
  };

  // Re-draw whenever route data changes
  useEffect(() => {
    drawRoute();
  }, [route, fullRoute]);

  const lastBoundsRef = useRef<string>("");

  // Fit Bounds logic
  useEffect(() => {
    if (!map.current) return;

    const isValidCoord = (coord: any): coord is [number, number] => 
      Array.isArray(coord) && 
      coord.length === 2 && 
      typeof coord[0] === 'number' && !isNaN(coord[0]) &&
      typeof coord[1] === 'number' && !isNaN(coord[1]);

    if (isValidCoord(pickup) && isValidCoord(destination)) {
        const boundsKey = `${pickup.join(',')}|${destination.join(',')}`;
        if (lastBoundsRef.current === boundsKey) return;
        lastBoundsRef.current = boundsKey;

        try {
            const bounds = new maplibregl.LngLatBounds();
            bounds.extend(pickup);
            bounds.extend(destination);
            
            map.current.fitBounds(bounds, {
                padding: 80,
                duration: 2000
            });
        } catch (err) {
            console.error("MapLibre fitBounds error:", err);
        }
    }
  }, [pickup, destination]);

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
    <div className="relative w-full overflow-hidden" style={{ height }}>
        <div ref={mapContainer} className="w-full h-full" />
        
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
