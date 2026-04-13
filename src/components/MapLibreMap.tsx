import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import taxiPng from '@/assets/taxi.png';

const pickupIcon = new L.DivIcon({
  className: 'custom-leaflet-icon',
  html: `<div style="width: 24px; height: 24px; background-color: black; border-radius: 50%; border: 4px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"><div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destinationIcon = new L.DivIcon({
  className: 'custom-leaflet-icon',
  html: `<div style="width: 24px; height: 24px; background-color: white; border-radius: 50%; border: 4px solid black; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"><div style="width: 8px; height: 8px; background-color: black; border-radius: 50%;"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const driverIcon = new L.DivIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));"><img src="${taxiPng}" style="width: 100%; height: 100%; object-fit: contain;" /></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

const MapEvents = ({ onMapClick }: { onMapClick?: (lng: number, lat: number) => void }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng.lng, e.latlng.lat);
    },
  });
  return null;
};

const FitBounds = ({ pickup, destination }: any) => {
    const map = useMap();
    useEffect(() => {
        if (pickup && destination) {
            const bounds = L.latLngBounds([pickup[1], pickup[0]], [destination[1], destination[0]]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [pickup, destination, map]);
    return null;
};

const CenterUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView([center[1], center[0]]);
    }, [center, map]);
    return null;
}

interface MapProps {
    height?: string;
    center?: [number, number];
    zoom?: number;
    pickup?: [number, number];
    destination?: [number, number];
    route?: [number, number][];
    fullRoute?: [number, number][];
    drivers?: any[];
    onMapClick?: (lng: number, lat: number) => void;
    onLocateMe?: () => void;
}

export const MapLibreMap = ({ height = "100%", center = [72.8777, 19.0760], zoom = 14, pickup, destination, route, fullRoute, drivers, onMapClick, onLocateMe }: MapProps) => {
    
    // Convert from [lng, lat] to Leaflet's [lat, lng]
    const leafCenter: [number, number] = [center[1], center[0]];
    const leafPickup: [number, number] | undefined = pickup ? [pickup[1], pickup[0]] : undefined;
    const leafDest: [number, number] | undefined = destination ? [destination[1], destination[0]] : undefined;

    const leafRoute = route ? route.map(p => [p[1], p[0]] as [number, number]) : [];
    const leafFullRoute = fullRoute ? fullRoute.map(p => [p[1], p[0]] as [number, number]) : [];

    return (
        <div style={{ height, width: '100%', position: 'relative' }}>
            <MapContainer 
                center={leafCenter} 
                zoom={zoom} 
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer url="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                
                {onMapClick && <MapEvents onMapClick={onMapClick} />}
                <CenterUpdater center={center} />
                <FitBounds pickup={leafPickup ? pickup : null} destination={leafDest ? destination : null} />

                {leafFullRoute.length > 0 && (
                    <Polyline positions={leafFullRoute} pathOptions={{ color: '#94a3b8', weight: 4, opacity: 0.5, dashArray: '5, 5' }} />
                )}

                {leafRoute.length > 0 && (
                    <Polyline positions={leafRoute} pathOptions={{ color: '#1e293b', weight: 6, opacity: 1 }} />
                )}

                {leafPickup && <Marker position={leafPickup} icon={pickupIcon} zIndexOffset={100} />}
                {leafDest && <Marker position={leafDest} icon={destinationIcon} zIndexOffset={100} />}

                {drivers && drivers.map(d => (
                    <Marker key={d.id} position={[d.lat, d.lng]} icon={driverIcon} zIndexOffset={50} />
                ))}
            </MapContainer>

            {onLocateMe && (
                <button 
                  onClick={onLocateMe}
                  className="absolute bottom-6 right-6 z-[1000] bg-white p-3 rounded-full shadow-lg border-2 border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <Crosshair className="w-6 h-6 text-slate-700" />
                </button>
            )}
        </div>
    );
};

export default MapLibreMap;
