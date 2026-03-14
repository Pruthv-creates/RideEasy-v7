import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Navigation, User, ArrowLeft, LogOut, DollarSign, TrendingUp, Calendar, Clock, CheckCircle, Navigation2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isValidTransition } from "@/utils/rideLogic";
import { getReliableLocation } from "@/utils/geolocation";

interface Ride {
    id: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_lat: number;
    dropoff_lng: number;
    status: string;
    fare_amount: number;
    customer_id: string;
    driver_id?: string;
    created_at: string;
    payment_status?: string;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const DriverDashboard = () => {
    const { user, role, signOut, loading } = useAuth();
    const [availableRides, setAvailableRides] = useState<Ride[]>([]);
    const [rideHistory, setRideHistory] = useState<Ride[]>([]);
    const [activeRide, setActiveRide] = useState<Ride | null>(null);
    const [stats, setStats] = useState([
        { label: "Today's Earnings", value: "₹0", icon: DollarSign, color: "text-green-600", bg: "bg-green-100" },
        { label: "Total Revenue", value: "₹0", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100" },
        { label: "Total Rides", value: "0", icon: Calendar, color: "text-purple-600", bg: "bg-purple-100" },
    ]);
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate("/");
            } else if (role !== 'driver') {
                navigate("/home");
                toast.error("Access denied. Drivers only.");
            }
        }
    }, [user, role, loading, navigate]);

    // GEOLOCATION TRACKING
    useEffect(() => {
        if (!user || role !== 'driver') return;

        const updateLocation = async () => {
            try {
                const loc = await getReliableLocation();
                const { lat, lng } = loc;
                
                // Upsert location with high frequency
                const { error } = await supabase
                    .from('driver_locations')
                    .upsert({
                        user_id: user.id,
                        lat: lat,
                        lng: lng,
                        is_online: true,
                        is_busy: !!activeRide, // Ensure this is synced
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
                
                if (error) console.error("Location update error:", error);

                // Proximity check for auto-arrival
                if (activeRide && activeRide.status === 'accepted' && activeRide.pickup_lat && activeRide.pickup_lng) {
                    const dist = calculateDistance(lat, lng, activeRide.pickup_lat, activeRide.pickup_lng);
                    if (dist < 0.05) { // 50 meters
                        handleUpdateRideStatus(activeRide.id, 'arrived');
                        toast.success("You've arrived at the pickup location!");
                    }
                }
            } catch (err) {
                console.error("Failed to update driver location:", err);
            }
        };

        const intervalId = setInterval(updateLocation, 3000); // Higher frequency for smooth routes (3s)
        updateLocation(); // Initial call

        // Set offline when leaving
        return () => {
            clearInterval(intervalId);
            supabase.from('driver_locations').update({ is_online: false }).eq('user_id', user.id);
        };
    }, [user, role, activeRide]);

    useEffect(() => {
        fetchAvailableRides();
        fetchHistory();

        const channel = supabase
            .channel('public:rides')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, (payload) => { // Changed event to '*'
                fetchAvailableRides();
                fetchHistory();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchAvailableRides = async () => {
        const { data, error } = await supabase
            .from("rides")
            .select("*")
            .eq("status", "requested")
            .order("created_at", { ascending: false });

        if (error) console.error(error);
        else setAvailableRides(data || []);
    };

    const fetchHistory = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from("rides")
            .select("*")
            .eq("driver_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            return;
        }

        const rides = data || [];
        setRideHistory(rides);
        
        // Find active ride
        const active = rides.find(r => ['accepted', 'arrived', 'in_progress'].includes(r.status));
        setActiveRide(active || null);

        // Calculate real stats
        const todayPrice = rides
            .filter(r => r.status === 'completed' && new Date(r.created_at).toDateString() === new Date().toDateString())
            .reduce((sum, r) => sum + Number(r.fare_amount), 0);
        
        const totalRevenue = rides
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => sum + Number(r.fare_amount), 0);

        setStats([
            { label: "Today's Earnings", value: `₹${todayPrice}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-100" },
            { label: "Total Revenue", value: `₹${totalRevenue}`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100" },
            { label: "Total Rides", value: String(rides.filter(r => r.status === 'completed').length), icon: Calendar, color: "text-purple-600", bg: "bg-purple-100" },
        ]);
    };

    const handleUpdateRideStatus = async (rideId: string, status: string) => {
        if (!user) return;
        
        // Find current status for validation
        const rideToUpdate = activeRide?.id === rideId ? activeRide : availableRides.find(r => r.id === rideId);
        const currentStatus = (rideToUpdate?.status || 'requested') as any;

        if (!isValidTransition(currentStatus, status as any)) {
            console.warn(`Invalid transition from ${currentStatus} to ${status}`);
            return;
        }

        try {
            const updateData: any = { status };
            if (status === 'accepted') updateData.driver_id = user.id;

            const { error } = await supabase
                .from('rides')
                .update(updateData)
                .eq('id', rideId);

            if (error) throw error;

            // Handle is_busy status in driver_locations
            if (status === 'accepted') {
                await supabase.from('driver_locations').update({ is_busy: true }).eq('user_id', user?.id);
                toast.success("Ride accepted! Navigate to pickup.");
            } else if (status === 'arrived') {
                toast.success("Arrival confirmed! Wait for passenger.");
            } else if (status === 'in_progress') {
                toast.success("Trip started! Drive safe.");
            } else if (status === 'completed' || status === 'cancelled') {
                await supabase.from('driver_locations').update({ is_busy: false }).eq('user_id', user?.id);
                toast.success(`Ride ${status === 'completed' ? 'completed' : 'cancelled'}`);
            }

            fetchAvailableRides();
            fetchHistory();
        } catch (err) {
            console.error("Error updating ride:", err);
            toast.error("Failed to update status");
        }
    };

    const handleLogout = async () => {
        if (user) {
            await supabase.from('driver_locations').update({ is_online: false }).eq('user_id', user.id);
        }
        await signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <h1 className="font-semibold text-lg">Driver Panel</h1>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>ONLINE</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="p-4 space-y-6">

                {/* Analytics Section */}
                <div className="grid grid-cols-3 gap-3">
                    {stats.map((stat, i) => (
                        <Card key={i} className="p-3 flex flex-col items-center justify-center text-center space-y-2 shadow-sm">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bg}`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{stat.value}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* ACTIVE RIDE SECTION */}
                {activeRide && (
                    <Card className="p-5 border-2 border-primary bg-primary/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 bg-primary rounded-lg text-primary-foreground">
                                    <Navigation2 className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-lg">Current {activeRide.status.toUpperCase()} Ride</h3>
                            </div>
                            <Badge className="bg-primary animate-pulse">{activeRide.status.toUpperCase()}</Badge>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Pick up at</p>
                                    <p className="text-sm font-medium">{activeRide.pickup_address}</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 text-destructive">
                                <MapPin className="w-4 h-4 mt-1" />
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Drop off at</p>
                                    <p className="text-sm font-medium">{activeRide.dropoff_address}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button 
                                    variant="outline"
                                    className="h-12 border-2" 
                                    onClick={() => {
                                        const dest = activeRide.status === 'accepted' ? activeRide.pickup_address : activeRide.dropoff_address;
                                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, '_blank')
                                    }}
                                >
                                    <Navigation className="w-4 h-4 mr-2" />
                                    Navigate
                                </Button>
                                
                                {activeRide.status === 'accepted' && (
                                    <Button className="h-12 bg-blue-600 hover:bg-blue-700 font-bold" onClick={() => handleUpdateRideStatus(activeRide.id, 'arrived')}>
                                        I Have Arrived
                                    </Button>
                                )}
                                {activeRide.status === 'in_progress' && (
                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <Button 
                                            variant="destructive" 
                                            className="h-12 font-bold opacity-80" 
                                            onClick={() => handleUpdateRideStatus(activeRide.id, 'cancelled')}
                                        >
                                            Cancel Trip
                                        </Button>
                                        <Button className="h-12 bg-green-600 hover:bg-green-700 font-bold shadow-lg shadow-green-600/20" onClick={() => handleUpdateRideStatus(activeRide.id, 'completed')}>
                                            Complete Ride
                                        </Button>
                                    </div>
                                )}
                                {activeRide.status === 'arrived' && (
                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <Button 
                                            variant="secondary" 
                                            className="h-12 font-bold" 
                                            onClick={() => handleUpdateRideStatus(activeRide.id, 'cancelled')}
                                        >
                                            No Show
                                        </Button>
                                        <Button className="h-12 bg-orange-600 hover:bg-orange-700 font-bold" onClick={() => handleUpdateRideStatus(activeRide.id, 'in_progress')}>
                                            Start Trip
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                <Tabs defaultValue="requests" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="requests">Available ({availableRides.length})</TabsTrigger>
                        <TabsTrigger value="history">My History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="requests" className="space-y-4">
                        {availableRides.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                                <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No requests nearby.</p>
                                <p className="text-xs">Stay online to receive rides.</p>
                            </div>
                        ) : (
                            availableRides.map((ride) => (
                                <Card key={ride.id} className="p-4 space-y-4 shadow-md border-l-4 border-l-primary animate-slide-up">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center space-x-2">
                                            <Badge variant="outline" className="text-xs uppercase">
                                                New Request
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-lg text-primary">₹{ride.fare_amount}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative">
                                        {/* Dashed Line */}
                                        <div className="absolute left-[15px] top-[10px] bottom-[10px] w-0.5 border-l-2 border-dashed border-muted-foreground/30 -z-10"></div>

                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center z-10 border-2 border-background">
                                                <User className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-bold">PICKUP</p>
                                                <p className="font-medium text-sm line-clamp-1">{ride.pickup_address}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center z-10 border-2 border-background">
                                                <MapPin className="w-4 h-4 text-red-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-bold">DROP</p>
                                                <p className="font-medium text-sm line-clamp-1">{ride.dropoff_address}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => handleUpdateRideStatus(ride.id, 'accepted')}
                                        disabled={!!activeRide}
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 text-lg shadow-lg shadow-primary/20"
                                    >
                                        {activeRide ? "Complete current ride first" : "Accept Ride"}
                                    </Button>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                        {rideHistory.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No past rides found.</p>
                            </div>
                        ) : (
                            rideHistory.map((ride) => (
                                <Card key={ride.id} className="p-4 space-y-3 shadow-sm border border-border/50">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <Badge variant={ride.status === 'completed' ? 'secondary' : 'outline'}
                                                    className={`${ride.status === 'completed' ? 'bg-green-100 text-green-800' : ''}`}>
                                                    {ride.status}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono">ID: {ride.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-lg">₹{ride.fare_amount}</span>
                                            {ride.payment_status === 'paid' && (
                                                <div className="flex items-center text-xs text-green-600 justify-end">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Paid
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2 mt-2">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            <p className="text-xs line-clamp-1">{ride.pickup_address}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                            <p className="text-xs line-clamp-1">{ride.dropoff_address}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default DriverDashboard;
