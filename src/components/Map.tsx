import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

interface MapProps {
  onLocationUpdate?: (coords: { lat: number; lng: number }) => void;
}

const MAPBOX_TOKEN_KEY = 'rideeasy_mapbox_token';

const Map: React.FC<MapProps> = ({ onLocationUpdate }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [token, setToken] = useState(() => localStorage.getItem(MAPBOX_TOKEN_KEY) || '');
  const [tempToken, setTempToken] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);

  const saveToken = () => {
    if (tempToken.trim()) {
      localStorage.setItem(MAPBOX_TOKEN_KEY, tempToken.trim());
      setToken(tempToken.trim());
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !token) return;

    try {
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        zoom: 14,
        center: [-73.9857, 40.7484], // Default to NYC
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );

      // Add marker for current location
      marker.current = new mapboxgl.Marker({ color: '#F5A623' })
        .setLngLat([-73.9857, 40.7484])
        .addTo(map.current);

      map.current.on('load', () => {
        setIsMapReady(true);
      });

      // Try to get user's actual location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            map.current?.flyTo({
              center: [longitude, latitude],
              zoom: 15
            });
            marker.current?.setLngLat([longitude, latitude]);
            onLocationUpdate?.({ lat: latitude, lng: longitude });
          },
          (error) => {
            console.log('Geolocation error:', error.message);
          }
        );
      }

      return () => {
        map.current?.remove();
      };
    } catch (error) {
      console.error('Map initialization error:', error);
      // Invalid token - clear it
      localStorage.removeItem(MAPBOX_TOKEN_KEY);
      setToken('');
    }
  }, [token, onLocationUpdate]);

  if (!token) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/50 p-4 space-y-4">
        <MapPin className="w-12 h-12 text-muted-foreground" />
        <div className="text-center space-y-2">
          <p className="font-medium">Enter your Mapbox Public Token</p>
          <p className="text-sm text-muted-foreground">
            Get a free token at{' '}
            <a 
              href="https://mapbox.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              mapbox.com
            </a>
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Input
            type="text"
            placeholder="pk.eyJ1Ijo..."
            value={tempToken}
            onChange={(e) => setTempToken(e.target.value)}
            className="text-sm"
          />
          <Button onClick={saveToken} className="w-full btn-taxi">
            Save Token
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default Map;
