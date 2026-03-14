import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Navigation,
  Home as HomeIcon,
  Briefcase,
  Clock,
  Heart,
  Menu,
  User,
  LogOut,
  Car,
  History,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getReliableLocation } from "@/utils/geolocation";
import MapLibreMap from "@/components/MapLibreMap";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";

const Home = () => {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [activeInput, setActiveInput] = useState<"pickup" | "destination">("pickup");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  const [pickupCoords, setPickupCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number, lng: number } | null>(null);

  const navigate = useNavigate();
  const { user, role, signOut, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    } else if (!loading && role === 'driver') {
      navigate("/driver-dashboard");
    }
  }, [user, role, loading, navigate]);

  // Initial user location with reliable utility
  useEffect(() => {
    let mounted = true;
    if (!pickup) {
        toast.info("Detecting your location...", { id: "loc-load" });
        getReliableLocation().then(async (loc) => {
            if (!mounted) return;
            setPickupCoords({ lat: loc.lat, lng: loc.lng });
            
            if (loc.source === 'gps') {
                toast.success("Location found via GPS", { id: "loc-load" });
            } else if (loc.source === 'ip') {
                toast.info("Showing nearest city (IP based)", { id: "loc-load" });
            }

            // Reverse geocode
            try {
               const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}`, {
                   headers: {
                       'Accept-Language': 'en-US,en;q=0.9',
                       'User-Agent': 'RideEasy/1.0'
                   }
               });
               const data = await res.json();
               if (data.display_name && mounted) {
                   setPickup(data.display_name.split(',').slice(0, 3).join(','));
               }
            } catch (e) {
                console.error("Geocoding failed, using coordinates:", e);
                if (mounted) setPickup("Current Location");
            }
        }).catch(() => {
            if (mounted) toast.error("Could not detect location. Using default center.", { id: "loc-load" });
        });
    }
    return () => { mounted = false; };
  }, []);

  // REAL-TIME DRIVERS FETCH & LISTEN
  useEffect(() => {
    fetchOnlineDrivers();

    const channel = supabase
      .channel('driver-locations')
      .on('postgres_changes', {
         event: '*',
         schema: 'public',
         table: 'driver_locations',
         filter: 'is_online=eq.true'
      }, () => {
         fetchOnlineDrivers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOnlineDrivers = async () => {
    const { data, error } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('is_online', true)
      .eq('is_busy', false);

    if (data) {
      setNearbyDrivers(data.map(d => ({
        id: d.user_id,
        lat: Number(d.lat),
        lng: Number(d.lng),
        angle: 0
      })));
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleSearchInput = async (query: string, field: "pickup" | "destination") => {
    if (field === "pickup") {
      setPickup(query);
      setActiveInput("pickup");
    } else {
      setDestination(query);
      setActiveInput("destination");
    }

    if (query.length > 2) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        setSuggestions(data);
      } catch (e) {
        console.error(e);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (place: any) => {
    const address = place.display_name.split(',').slice(0, 3).join(',');
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);

    if (activeInput === "pickup") {
      setPickup(address);
      setPickupCoords({ lat, lng });
    } else {
      setDestination(address);
      setDestinationCoords({ lat, lng });
    }
    setSuggestions([]);
  };

  const handleMapLocationSelect = (address: string, lat?: number, lng?: number) => {
    if (activeInput === "pickup") {
      setPickup(address);
      if (lat && lng) setPickupCoords({ lat, lng });
      setActiveInput("destination");
    } else {
      setDestination(address);
      if (lat && lng) setDestinationCoords({ lat, lng });
    }
  };

  const handleBookRide = () => {
    if (!pickupCoords || !destinationCoords) {
        toast.error("Please select both pickup and destination locations");
        return;
    }
    navigate("/book-ride", {
      state: {
        pickup,
        destination,
        pickupCoords,
        destinationCoords
      }
    });
  };

  const quickActions = [
    { icon: HomeIcon, label: "Home", address: "Saved", onClick: () => handleSearchInput("Home", "destination") },
    { icon: Briefcase, label: "Work", address: "Saved", onClick: () => handleSearchInput("Work", "destination") },
    { icon: Clock, label: "History", address: "Recent", onClick: () => navigate("/trip-history") },
    { icon: Heart, label: "Loved", address: "Favs", onClick: () => {} }
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-xl">
                        <Menu className="w-5 h-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] p-0">
                    <SheetHeader className="p-6 bg-primary text-primary-foreground">
                        <div className="flex items-center space-x-3 text-left">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <SheetTitle className="text-primary-foreground font-black text-lg truncate w-[180px]">{user?.email}</SheetTitle>
                                <p className="text-xs font-bold uppercase tracking-widest opacity-80">{role}</p>
                            </div>
                        </div>
                    </SheetHeader>
                    <div className="p-4 space-y-2 mt-4">
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-14 rounded-2xl text-lg font-bold"
                            onClick={() => navigate("/home")}
                        >
                            <HomeIcon className="w-5 h-5 mr-4 text-primary" />
                            Home
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-14 rounded-2xl text-lg font-bold"
                            onClick={() => navigate("/trip-history")}
                        >
                            <History className="w-5 h-5 mr-4 text-primary" />
                            Your Trips
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-14 rounded-2xl text-lg font-bold bg-primary/5 border-2 border-primary/20"
                            onClick={() => navigate("/subscriptions")}
                        >
                            <Zap className="w-5 h-5 mr-4 text-primary fill-primary" />
                            Subscription Tiers
                        </Button>
                        <div className="pt-6 mt-6 border-t font-black px-4 uppercase text-[10px] tracking-widest text-muted-foreground">
                            Settings & Support
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-14 rounded-2xl text-lg font-bold text-destructive hover:text-destructive hover:bg-destructive/5"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-5 h-5 mr-4" />
                            Logout
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
            <div>
              <p className="text-sm text-muted-foreground leading-none mb-1">Welcome</p>
              <p className="font-bold text-sm truncate max-w-[150px]">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-bold text-[10px]">
              {role?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Map Section */}
        <Card className="card-taxi overflow-hidden animate-fade-in border-0 p-0 shadow-lg relative h-[300px]">
          <MapLibreMap 
            height="100%"
            center={pickupCoords ? [pickupCoords.lng, pickupCoords.lat] : [72.8777, 19.0760]}
            drivers={nearbyDrivers}
            pickup={pickupCoords ? [pickupCoords.lng, pickupCoords.lat] : undefined}
            destination={destinationCoords ? [destinationCoords.lng, destinationCoords.lat] : undefined}
            onLocateMe={async () => {
                try {
                    toast.info("Finding your location...");
                    const loc = await getReliableLocation();
                    setPickupCoords({ lat: loc.lat, lng: loc.lng });
                    
                    // Reverse geocode
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}`, {
                        headers: { 'Accept-Language': 'en-US', 'User-Agent': 'RideEasy/1.0' }
                    });
                    const data = await res.json();
                    if (data.display_name) {
                        setPickup(data.display_name.split(',').slice(0, 3).join(','));
                        toast.success("Location updated!");
                    }
                } catch (e) {
                    toast.error("Could not get location. Please enable GPS.");
                }
            }}
            onMapClick={(lng, lat) => {
              if (activeInput === "pickup") {
                setPickupCoords({ lat, lng });
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                  headers: { 'Accept-Language': 'en-US', 'User-Agent': 'RideEasy/1.0' }
                })
                  .then(r => r.ok ? r.json() : ({}))
                  .then((data: any) => {
                    if (data.display_name) setPickup(data.display_name.split(',').slice(0, 3).join(','));
                    else setPickup(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                  })
                  .catch(() => setPickup(`${lat.toFixed(4)}, ${lng.toFixed(4)}`));
              } else {
                setDestinationCoords({ lat, lng });
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                  headers: { 'Accept-Language': 'en-US', 'User-Agent': 'RideEasy/1.0' }
                })
                  .then(r => r.ok ? r.json() : ({}))
                  .then((data: any) => {
                    if (data.display_name) setDestination(data.display_name.split(',').slice(0, 3).join(','));
                    else setDestination(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                  })
                  .catch(() => setDestination(`${lat.toFixed(4)}, ${lng.toFixed(4)}`));
              }
            }}
          />
        </Card>

        {/* Search Section */}
        <Card className="card-taxi animate-slide-up relative overflow-visible z-10 border-0 shadow-xl bg-card">
          <div className="space-y-4">
            <h3 className="font-bold text-lg flex items-center">
               <Navigation className="w-4 h-4 mr-2 text-primary" />
               Where to?
            </h3>

            <div className="space-y-3 relative">
              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[1000] bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border mt-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-1">
                    {suggestions.map((place, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted rounded-lg transition-colors flex items-center space-x-3 border-b border-border/10 last:border-0"
                        onClick={() => handleSuggestionClick(place)}
                      >
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate font-medium">{place.display_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                  <div className={`w-3 h-3 rounded-full ${activeInput === 'pickup' ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/30'}`}></div>
                </div>
                <Input
                  placeholder="Pickup location"
                  value={pickup}
                  onChange={(e) => handleSearchInput(e.target.value, "pickup")}
                  onFocus={() => setActiveInput("pickup")}
                  className={`pl-11 h-14 rounded-xl border-2 transition-all duration-300 bg-muted/20 ${activeInput === 'pickup' ? 'border-primary bg-background' : 'border-transparent'}`}
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                  <MapPin className={`w-4 h-4 ${activeInput === 'destination' ? 'text-destructive animate-bounce' : 'text-muted-foreground/30'}`} />
                </div>
                <Input
                  placeholder="Search destination"
                  value={destination}
                  onChange={(e) => handleSearchInput(e.target.value, "destination")}
                  onFocus={() => setActiveInput("destination")}
                  className={`pl-11 h-14 rounded-xl border-2 transition-all duration-300 bg-muted/20 ${activeInput === 'destination' ? 'border-primary bg-background' : 'border-transparent'}`}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="animate-fade-in">
          <h3 className="font-bold text-sm mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <Card
                key={index}
                className="card-taxi-interactive hover:bg-muted/50 transition-colors p-4"
                onClick={action.onClick}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <action.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-xs truncate">{action.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate uppercase font-black tracking-widest">{action.address}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Request Button */}
        <div className="animate-scale-in pt-2">
          <Button
            onClick={handleBookRide}
            className="btn-taxi w-full h-16 text-lg font-black shadow-xl shadow-primary/20 group"
          >
            REQUEST RIDE NOW
            <Car className="ml-2 w-5 h-5 group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;