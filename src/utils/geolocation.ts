export interface LocationInfo {
  lat: number;
  lng: number;
  accuracy: number | null;
  source: "gps" | "ip" | "default";
}

const DEFAULT_CENTER = { lat: 19.0760, lng: 72.8777 }; // Mumbai

export const getReliableLocation = async (): Promise<LocationInfo> => {
  // Layer 1: Browser GPS (High Accuracy)
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      });
    });
    console.log("📍 Location detected via High-Accuracy GPS");
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: "gps"
    };
  } catch (gpsError) {
    console.warn("High-accuracy GPS failed, trying standard accuracy...");
    // Layer 1.5: Standard Accuracy (Often works better if GPS Signal is weak or on Mac/Safari)
    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 10000
          });
        });
        console.log("📍 Location detected via Standard GPS");
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "gps"
        };
    } catch (stdError) {
        console.warn("Standard GPS failed, trying IP fallback...");
    }
  }

  // Layer 2: IP Geolocation (Chain of multiple fallbacks to avoid 429s)
  const ipProviders = [
    { url: 'https://freeipapi.com/api/json', latRef: 'latitude', lngRef: 'longitude' },
    { url: 'https://ip-api.com/json?fields=status,lat,lon', latRef: 'lat', lngRef: 'lon' },
    { url: 'https://ipapi.co/json/', latRef: 'latitude', lngRef: 'longitude' },
    { url: 'https://ipwho.is/', latRef: 'latitude', lngRef: 'longitude' }
  ];

  for (const provider of ipProviders) {
    try {
      console.log(`Trying IP Provider: ${provider.url}`);
      const res = await fetch(provider.url, { timeout: 3000 } as any);
      if (res.status === 429) {
          console.warn(`${provider.url} rate limited (429), skipping...`);
          continue;
      }
      const data = await res.json();
      const lat = data[provider.latRef];
      const lng = data[provider.lngRef];

      if (lat && lng) {
        console.log("📍 Location detected via IP Fallback:", provider.url);
        return {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          accuracy: null,
          source: "ip"
        };
      }
    } catch (e) {
      console.warn(`Provider ${provider.url} failed:`, e);
    }
  }

  // Layer 3: Default Center (Mumbai)
  console.log("⚠️ Using default fallback location");
  return {
    ...DEFAULT_CENTER,
    accuracy: null,
    source: "default"
  };
};
