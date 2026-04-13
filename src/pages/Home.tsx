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
  Zap,
  Camera,
  Loader2
} from "lucide-react";
import { Label } from "@/components/ui/label";
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
  const [userFavorites, setUserFavorites] = useState<any[]>([]);
  const [profile, setProfile] = useState({ full_name: '', avatar_url: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const navigate = useNavigate();
  const { user, role, signOut, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/");
      } else if (role === 'driver') {
        navigate("/driver-dashboard");
      } else {
        fetchFavorites();
        fetchProfile();
      }
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

  const fetchFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', user.id);
    if (data) setUserFavorites(data);
  };
  const fetchOnlineDrivers = async () => {
    const { data } = await supabase
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

  // Fetch Route when both coords are present
  useEffect(() => {
    if (pickupCoords && destinationCoords) {
        fetchRoute();
    } else {
        setRoutePath([]);
    }
  }, [pickupCoords, destinationCoords]);

  const fetchRoute = async () => {
    if (!pickupCoords || !destinationCoords) return;
    
    setIsCalculatingRoute(true);
    try {
        console.log("Fetching route from OSRM...", { pickupCoords, destinationCoords });
        const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${pickupCoords.lng},${pickupCoords.lat};${destinationCoords.lng},${destinationCoords.lat}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        
        console.log("OSRM Response:", data);
        
        if (data.routes && data.routes[0]) {
            console.log("Setting route path:", data.routes[0].geometry.coordinates.length, "points");
            setRoutePath(data.routes[0].geometry.coordinates);
        } else {
            console.warn("No routes found in OSRM response");
        }
    } catch (err) {
        console.error("Routing error:", err);
    } finally {
        setIsCalculatingRoute(false);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();
    if (data) setProfile({ full_name: data.full_name || '', avatar_url: data.avatar_url || '' });
  };

  const [isUploadingPfp, setIsUploadingPfp] = useState(false);

  const handlePfpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file");
        return;
    }

    setIsUploadingPfp(true);
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
        toast.success("Profile picture updated!");
    } catch (err: any) {
        toast.error("Failed to upload image");
    } finally {
        setIsUploadingPfp(false);
    }
  };

  const handleUpdateProfile = async (updates: Partial<{full_name: string, avatar_url: string}>) => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      setProfile(prev => ({ ...prev, ...updates }));
      toast.success("Profile updated!");
    } catch (e) {
      toast.error("Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
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

  const handleQuickAction = async (label: string) => {
    const fav = userFavorites.find(f => f.label === label);
    
    if (fav) {
      setDestination(fav.address);
      setDestinationCoords({ lat: Number(fav.lat), lng: Number(fav.lng) });
      toast.success(`${label} location selected`);
    } else {
      // If no fav is set, offer to save current destination as fav
      if (destination && destinationCoords) {
        try {
          const { error } = await supabase
            .from('user_favorites')
            .upsert({
              user_id: user?.id,
              label,
              address: destination,
              lat: destinationCoords.lat,
              lng: destinationCoords.lng,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,label' });

          if (error) throw error;
          toast.success(`${label} location saved!`);
          fetchFavorites();
        } catch (err: any) {
          toast.error("Failed to save favorite");
        }
      } else {
        toast.info(`Search for a destination first to save it as ${label}`);
        setActiveInput("destination");
      }
    }
  };

  const quickActions = [
    { icon: HomeIcon, label: "Home", color: "text-blue-500", onClick: () => handleQuickAction("Home") },
    { icon: Briefcase, label: "Work", color: "text-orange-500", onClick: () => handleQuickAction("Work") },
    { icon: Clock, label: "History", color: "text-slate-500", onClick: () => navigate("/trip-history") },
    { icon: Heart, label: "Loved", color: "text-red-500", onClick: () => handleQuickAction("Loved") }
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
                    <Button variant="ghost" size="icon" className="rounded-xl overflow-hidden p-0 border-2 border-primary/20 bg-white h-10 w-10">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <Menu className="w-5 h-5 text-primary" />
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] p-0">
                    <SheetHeader className="p-6 bg-primary text-primary-foreground">
                        <div className="flex items-center space-x-3 text-left">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-6 h-6" />
                                )}
                            </div>
                            <div>
                                <SheetTitle className="text-primary-foreground font-black text-lg truncate w-[180px]">{profile.full_name || user?.email}</SheetTitle>
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
                        
                        <div className="pt-6 mt-6 border-t px-4">
                            <div className="font-black uppercase text-[10px] tracking-widest text-muted-foreground mb-4">Profile Settings</div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Display Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-50 border-none rounded-xl h-10 px-3 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Your Name"
                                        value={profile.full_name}
                                        onBlur={(e) => handleUpdateProfile({ full_name: e.target.value })}
                                        onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Profile Picture</label>
                                    <div className="flex space-x-2">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handlePfpUpload}
                                            className="hidden"
                                            id="rider-pfp-upload"
                                        />
                                        <Label 
                                            htmlFor="rider-pfp-upload"
                                            className="flex-1 bg-slate-50 border-none rounded-xl h-10 px-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-all"
                                        >
                                            {isUploadingPfp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Choose Photo"}
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Welcome</p>
              <p className="font-black text-sm truncate max-w-[150px] uppercase tracking-tight">{profile.full_name || user?.email?.split('@')[0]}</p>
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
            route={routePath}
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
                  <div className={`w-10 h-10 ${action.color?.replace('text', 'bg')}/10 rounded-xl flex items-center justify-center`}>
                    <action.icon className={`w-5 h-5 ${action.color}`} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-xs truncate">{action.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate uppercase font-black tracking-widest leading-none mt-1">
                      {userFavorites.find(f => f.label === action.label)?.address.split(',')[0] || (action.label === 'History' ? 'Recent' : 'Not Set')}
                    </p>
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