import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Shield, MapPin, Navigation, ArrowLeft, Zap, Loader2 } from "lucide-react";
import MapLibreMap from "@/components/MapLibreMap";

const TrackRide = () => {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<any>(null);
  const rideRef = useRef<any>(null); // Use ref to avoid stale closures in subscriptions
  const [driverLoc, setDriverLoc] = useState<any>(null);
  const [liveStats, setLiveStats] = useState({ distance: 0, duration: 0 });
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [fullRoutePath, setFullRoutePath] = useState<[number, number][]>([]);

  // Keep rideRef in sync with state
  useEffect(() => {
    rideRef.current = ride;
  }, [ride]);

  useEffect(() => {
    if (!rideId) return;
    fetchRideData();

    const channel = supabase
      .channel(`ride-tracking-${rideId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` }, (payload) => {
        console.log("Ride update:", payload.new.status);
        setRide(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId]);

  useEffect(() => {
    if (ride?.driver_id) {
        subscribeToDriver(ride.driver_id);
    }
  }, [ride?.driver_id]);

  useEffect(() => {
    if (driverLoc && ride) {
        console.log("Driver location ready, fetching first live route...");
        updateLiveETA(driverLoc.lat, driverLoc.lng);
    }
  }, [driverLoc === null]); // Only run when driverLoc first goes from null to something

  const fetchRideData = async () => {
    const { data } = await supabase.from('rides').select('*').eq('id', rideId).single();
    if (data) {
        console.log("Initial ride data fetched:", data.status);
        setRide(data);
        fetchRoute(data);
    }
  };

  const fetchRoute = async (r: any) => {
    try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${r.pickup_lng},${r.pickup_lat};${r.dropoff_lng},${r.dropoff_lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        console.log("OSRM Initial Full Route Response:", data.code);
        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates;
          setRoutePath(coords);
          setFullRoutePath(coords); // Save the full trip line
        }
    } catch (e) {
        console.error("Fetch route failed:", e);
    }
  };

  const subscribeToDriver = (driverId: string) => {
    console.log("Subscribing to driver:", driverId);
    const channel = supabase
      .channel(`driver-track-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `user_id=eq.${driverId}` }, (payload) => {
        const newLoc = payload.new as any;
        if (newLoc && newLoc.lat) {
          setDriverLoc({ lat: newLoc.lat, lng: newLoc.lng });
          updateLiveETA(newLoc.lat, newLoc.lng);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const updateLiveETA = async (lat: number, lng: number) => {
    const currentRide = rideRef.current;
    if (!currentRide) return;

    const isHeComingToMe = (currentRide.status === 'accepted' || currentRide.status === 'arrived');
    const destLat = isHeComingToMe ? currentRide.pickup_lat : currentRide.dropoff_lat;
    const destLng = isHeComingToMe ? currentRide.pickup_lng : currentRide.dropoff_lng;

    if (!destLat || !destLng) return;

    try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${destLng},${destLat}?overview=full&geometries=geojson`);
        const data = await res.json();
        
        if (data.routes?.[0]) {
          const route = data.routes[0];
          console.log(`Live stats updated: ${route.distance}m, ${route.duration}s`);
          setLiveStats({
            distance: route.distance / 1000,
            duration: route.duration / 60
          });
          setRoutePath(route.geometry.coordinates);
        }
    } catch (e) {
        console.error("Update live ETA failed:", e);
    }
  };

  if (!ride) return (
    <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="font-black text-xl uppercase tracking-tighter">Locating Your Trip...</p>
        </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Dynamic Header */}
      <div className="p-4 bg-card border-b flex items-center justify-between z-10 shadow-sm">
         <div className="flex items-center space-x-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
                <h1 className="font-black text-xl tracking-tight uppercase">Live Tracking</h1>
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">{ride.status.replace('_', ' ')}</p>
                </div>
            </div>
         </div>
         <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 px-3 py-1 font-black text-[10px] uppercase tracking-widest">
            <Shield className="w-3 h-3 mr-2 fill-primary/20" />
            Secure Trip
         </Badge>
      </div>

      <div className="flex-1 relative">
        <MapLibreMap
          height="100%"
          drivers={driverLoc ? [{ id: ride.driver_id, ...driverLoc }] : []}
          route={routePath}
          fullRoute={fullRoutePath}
          pickup={[ride.pickup_lng, ride.pickup_lat]}
          destination={[ride.dropoff_lng, ride.dropoff_lat]}
          center={driverLoc ? [driverLoc.lng, driverLoc.lat] : [ride.pickup_lng, ride.pickup_lat]}
          zoom={driverLoc ? 15 : 14}
        />

        {/* Floating Stats Card */}
        <div className="absolute top-4 left-4 right-4 pointer-events-none">
             <Card className="p-6 bg-background/95 backdrop-blur-md shadow-2xl border-0 rounded-[2rem] pointer-events-auto ring-1 ring-black/5 animate-slide-up">
                <div className="grid grid-cols-2 gap-8 relative">
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <p className="text-[10px] uppercase font-black tracking-widest">EST. ARRIVAL</p>
                        </div>
                        <p className="text-3xl font-black text-primary tracking-tighter">
                            {liveStats.duration > 0 ? `${Math.round(liveStats.duration)} MINS` : 'Arriving Now'}
                        </p>
                    </div>
                    
                    <div className="space-y-1 text-right">
                        <div className="flex items-center justify-end space-x-2 text-muted-foreground">
                            <Navigation className="w-3 h-3" />
                            <p className="text-[10px] uppercase font-black tracking-widest">DISTANCE</p>
                        </div>
                        <p className="text-3xl font-black tracking-tighter">
                            {liveStats.distance.toFixed(1)} <span className="text-sm">KM</span>
                        </p>
                    </div>

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-10 bg-border/50 hidden sm:block"></div>
                </div>
             </Card>
        </div>
      </div>

      <div className="p-6 bg-card border-t rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] mt-[-2rem] z-20">
          <div className="space-y-6">
            <div className="space-y-1 px-2">
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Route Details</p>
            </div>
            
            <div className="space-y-4">
                <div className="flex items-start space-x-4 group">
                    <div className="flex flex-col items-center space-y-1 mt-1">
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.6)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        </div>
                        <div className="w-[2px] h-8 bg-gradient-to-b from-primary to-transparent opacity-20"></div>
                    </div>
                    <div className="flex-1 pb-4 border-b border-border/50">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Pickup Location</p>
                        <p className="text-sm font-bold text-foreground truncate">{ride.pickup_address}</p>
                    </div>
                </div>

                <div className="flex items-start space-x-4 group">
                    <div className="flex flex-col items-center mt-1">
                        <div className="w-4 h-4 rounded-full bg-destructive/10 border-2 border-destructive flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-destructive"></div>
                        </div>
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Destination</p>
                        <p className="text-sm font-bold text-foreground truncate">{ride.dropoff_address}</p>
                    </div>
                </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/30 mt-6">
              <div className="flex items-center justify-center space-x-2 text-primary font-black uppercase text-[9px] tracking-[0.3em] opacity-60">
                <Zap className="w-3 h-3 fill-current" />
                <span>Real-Time Tracking Active</span>
                <Zap className="w-3 h-3 fill-current" />
              </div>
          </div>
      </div>
    </div>
  );
};

export default TrackRide;
