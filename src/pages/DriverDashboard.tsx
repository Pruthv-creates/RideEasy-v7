import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { 
    MapPin, 
    Navigation, 
    User, 
    LogOut, 
    DollarSign, 
    TrendingUp, 
    Calendar, 
    Clock, 
    CheckCircle, 
    Navigation2, 
    Star, 
    Zap, 
    Target,
    Activity,
    BrainCircuit,
    ChevronRight,
    ArrowUpRight,
    Wallet,
    ArrowDownLeft,
    ShieldCheck,
    Loader2,
    MessageCircle,
    Smartphone,
    Camera,
    Image as ImageIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChatInterface } from "@/components/ChatInterface";
import { isValidTransition } from "@/utils/rideLogic";
import { getReliableLocation } from "@/utils/geolocation";
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell,
    AreaChart,
    Area
} from 'recharts';

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
    rider_id: string;
    driver_id?: string;
    created_at: string;
    payment_status?: string;
    otp_code?: string;
}

const EARNINGS_DATA = [
    { day: 'Mon', amount: 450 },
    { day: 'Tue', amount: 890 },
    { day: 'Wed', amount: 320 },
    { day: 'Thu', amount: 1250 },
    { day: 'Fri', amount: 1680 },
    { day: 'Sat', amount: 2450 },
    { day: 'Sun', amount: 2100 },
];

const REVENUE_DATA = [
    { name: 'Base Fare', value: 70, color: '#facc15' },
    { name: 'Incentives', value: 20, color: '#22c55e' },
    { name: 'Tips', value: 10, color: '#3b82f6' },
];

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
    const [isOnline, setIsOnline] = useState(false);
    const [activeTab, setActiveTab] = useState('duty');
    const [rideHistory, setRideHistory] = useState<Ride[]>([]);
    const [activeRide, setActiveRide] = useState<Ride | null>(null);
    const [dailyEarnings, setDailyEarnings] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalRides, setTotalRides] = useState(0);
    const [weeklyEarningsData, setWeeklyEarningsData] = useState<{day: string, amount: number}[]>([]);
    const [acceptanceRate, setAcceptanceRate] = useState(0);
    const [driverRating, setDriverRating] = useState(0);
    const [activeSubscription, setActiveSubscription] = useState<any>(null);
    const [isCheckingSub, setIsCheckingSub] = useState(true);
    const [profile, setProfile] = useState({ 
        full_name: '', 
        vehicle_number: '', 
        daily_goal: 3000,
        upi_id: '',
        bank_name: '',
        bank_account_number: '',
        bank_ifsc_code: '',
        avatar_url: ''
    });
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [newGoal, setNewGoal] = useState('');
    const [otpInput, setOtpInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [customerInfo, setCustomerInfo] = useState<{full_name: string, avatar_url?: string} | null>(null);
    const [isUploadingPfp, setIsUploadingPfp] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank'>('upi');
    const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const simulationRef = useRef<NodeJS.Timeout | null>(null);
    
    // Mock Driver Performance
    const onlineTime = "5h 24m";
    const goalProgress = useMemo(() => Math.min((dailyEarnings / profile.daily_goal) * 100, 100), [dailyEarnings, profile.daily_goal]);

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

    useEffect(() => {
        if (!user || role !== 'driver' || isSimulating) return;

        const updateLocation = async () => {
            try {
                const loc = await getReliableLocation();
                const { lat, lng } = loc;
                
                await supabase.from('driver_locations').upsert({
                    user_id: user.id,
                    lat: lat,
                    lng: lng,
                    is_online: isOnline,
                    is_busy: !!activeRide,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                
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

        const intervalId = setInterval(updateLocation, 3000);
        updateLocation();

        return () => {
            clearInterval(intervalId);
        };
    }, [user, role, activeRide, isOnline, isSimulating]);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!user) return;
            
            // 1. Fetch Subscription
            const { data: sub } = await supabase
                .from('driver_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .gt('end_date', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            setActiveSubscription(sub);
            setIsCheckingSub(false);

            // 2. Fetch Profile
            const { data: prof } = await supabase
                .from('profiles')
                .select('full_name, vehicle_number, daily_goal, upi_id, bank_name, bank_account_number, bank_ifsc_code, avatar_url')
                .eq('id', user.id)
                .single();
            
            if (prof) {
                setProfile({
                    full_name: prof.full_name || '',
                    vehicle_number: prof.vehicle_number || '',
                    daily_goal: prof.daily_goal || 3000,
                    upi_id: prof.upi_id || '',
                    bank_name: prof.bank_name || '',
                    bank_account_number: prof.bank_account_number || '',
                    bank_ifsc_code: prof.bank_ifsc_code || '',
                    avatar_url: prof.avatar_url || ''
                });
            }

            // 3. Fetch Online Status
            const { data: loc } = await supabase.from('driver_locations').select('is_online').eq('user_id', user.id).single();
            if (loc) {
                // If sub is expired but they were online, force offline
                if (!sub && loc.is_online) {
                    await supabase.from('driver_locations').update({ is_online: false }).eq('user_id', user.id);
                    setIsOnline(false);
                } else {
                    setIsOnline(loc.is_online);
                }
            }
        };
        fetchUserData();
    }, [user]);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setIsUpdatingProfile(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: profile.full_name,
                    vehicle_number: profile.vehicle_number,
                    daily_goal: profile.daily_goal,
                    upi_id: profile.upi_id,
                    bank_name: profile.bank_name,
                    bank_account_number: profile.bank_account_number,
                    bank_ifsc_code: profile.bank_ifsc_code,
                    avatar_url: profile.avatar_url
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Profile updated successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to update profile");
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleUpdateGoal = async () => {
        if (!user) return;
        const goalValue = parseInt(newGoal);
        if (isNaN(goalValue) || goalValue <= 0) {
            toast.error("Please enter a valid goal amount");
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ daily_goal: goalValue })
                .eq('id', user.id);

            if (error) throw error;
            setProfile(prev => ({ ...prev, daily_goal: goalValue }));
            setIsEditingGoal(false);
            toast.success("Daily goal updated!");
        } catch (err: any) {
            toast.error(err.message || "Failed to update goal");
        }
    };

    const handleToggleOnline = async (checked: boolean) => {
        if (checked && !activeSubscription) {
            toast.error("Subscription required to go online", {
                description: "Purchase a pass in the Stats/Passes section."
            });
            setActiveTab('passes');
            return;
        }

        setIsOnline(checked);
        if (!user) return;
        
        try {
            await supabase.from('driver_locations').update({ is_online: checked }).eq('user_id', user.id);
            toast.success(checked ? "You are now ONLINE" : "You are now OFFLINE");
        } catch (error) {
            toast.error("Failed to update status");
            setIsOnline(!checked);
        }
    };

    const handlePfpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error("Please upload an image file");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size should be less than 5MB");
            return;
        }

        setIsUploadingPfp(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Update Profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
            toast.success("Profile picture updated!");
        } catch (err: any) {
            toast.error(err.message || "Failed to upload image");
            console.error(err);
        } finally {
            setIsUploadingPfp(false);
        }
    };

    const handlePurchasePass = async (plan: string, days: number, price: number) => {
        if (!user) return;
        
        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: price * 100, // Amount in paise
            currency: "INR",
            name: "RideEasy",
            description: `${plan} Subscription`,
            image: "https://your-logo-url.com", // Add your logo URL
            handler: async (response: any) => {
                if (response.razorpay_payment_id) {
                    try {
                        const endDate = new Date();
                        endDate.setDate(endDate.getDate() + days);

                        const { error } = await supabase.from('driver_subscriptions').insert({
                            user_id: user.id,
                            plan_name: plan,
                            price: price,
                            status: 'active',
                            end_date: endDate.toISOString(),
                            payment_id: response.razorpay_payment_id
                        });

                        if (error) throw error;

                        toast.success(`${plan} Activated!`);
                        
                        // Refresh sub
                        const { data } = await supabase
                            .from('driver_subscriptions')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('status', 'active')
                            .gt('end_date', new Date().toISOString())
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        setActiveSubscription(data);
                    } catch (err) {
                        toast.error("Failed to activate pass");
                    }
                }
            },
            prefill: {
                name: profile.full_name,
                email: user.email,
            },
            theme: {
                color: "#FFD300",
            },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
    };

    useEffect(() => {
        if (isOnline) {
            console.log('🟢 [Driver] Driver is ONLINE — fetching available rides');
            fetchAvailableRides();
        } else {
            console.log('🔴 [Driver] Driver is OFFLINE — clearing available rides');
            setAvailableRides([]);
        }
        fetchHistory();

        console.log('📡 [Driver] Subscribing to public:rides for new ride requests');
        const channel = supabase.channel('public:rides')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, (payload) => {
                console.log(`📡 [Driver] rides table change detected — event: ${payload.eventType}, status: ${(payload.new as any)?.status ?? 'unknown'}`);
                if (isOnline) fetchAvailableRides();
                fetchHistory();
            })
            .subscribe((status) => {
                console.log(`📡 [Driver] Realtime subscription status: ${status}`);
                if (status === 'CHANNEL_ERROR') {
                    console.error('🔴 [Driver] Realtime subscription FAILED — driver will not see new ride requests automatically');
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [user, isOnline]);

    const fetchAvailableRides = async () => {
        const { data, error } = await supabase.from("rides").select("*").eq("status", "requested").order("created_at", { ascending: false });
        if (error) {
            console.error('🔴 [Driver] fetchAvailableRides FAILED (RLS may block this):', error.message);
            return;
        }
        console.log(`🚖 [Driver] Available rides: ${data?.length ?? 0} ride(s) with status=requested`);
        setAvailableRides(data || []);
    };

    const fetchHistory = async () => {
        if (!user) return;
        const { data, error } = await supabase.from("rides").select("*").eq("driver_id", user.id).order("created_at", { ascending: false });
        if (error) {
            console.error('🔴 [Driver] fetchHistory FAILED:', error.message);
            return;
        }

        const rides = data || [];
        const activeFound = rides.find(r => ['accepted', 'arrived', 'in_progress'].includes(r.status));
        console.log(`📋 [Driver] fetchHistory: ${rides.length} total rides | active: ${activeFound ? `${activeFound.id} (${activeFound.status})` : 'none'}`);
        setRideHistory(rides);
        setActiveRide(activeFound || null);

        const completedRides = rides.filter(r => r.status === 'completed');
        const todayStr = new Date().toDateString();
        const todayRides = completedRides.filter(r => new Date(r.created_at).toDateString() === todayStr);
        
        setDailyEarnings(todayRides.reduce((sum, r) => sum + Number(r.fare_amount), 0));
        setTotalRevenue(completedRides.reduce((sum, r) => sum + Number(r.fare_amount), 0));
        setTotalRides(completedRides.length);

        // Calculate Weekly Data for Chart
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return { fullDate: d.toDateString(), day: days[d.getDay()], amount: 0 };
        }).reverse();

        last7Days.forEach(dayObj => {
            const dayTotal = completedRides
                .filter(r => new Date(r.created_at).toDateString() === dayObj.fullDate)
                .reduce((sum, r) => sum + Number(r.fare_amount), 0);
            dayObj.amount = dayTotal;
        });
        setWeeklyEarningsData(last7Days.map(d => ({ day: d.day, amount: d.amount })));
        setAcceptanceRate(rides.length > 0 ? Math.round((completedRides.length / rides.length) * 100) : 0);

        // Fetch Rating
        const { data: ratings } = await supabase.from('ratings').select('rating').eq('reviewee_id', user.id);
        if (ratings && ratings.length > 0) {
            const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
            setDriverRating(Number(avg.toFixed(2)));
        } else {
            setDriverRating(0);
        }

        const currentActive = rides.find(r => ['accepted', 'arrived', 'in_progress'].includes(r.status));
        if (currentActive && currentActive.rider_id) {
            const { data: cust } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', currentActive.rider_id).single();
            if (cust) setCustomerInfo(cust);
        } else {
            setCustomerInfo(null);
            setShowChat(false);
        }
    };

    const handleWithdraw = async () => {
        if (!user) return;
        const amount = parseFloat(withdrawAmount);
        
        if (isNaN(amount) || amount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        if (amount > totalRevenue) {
            toast.error("Insufficient balance");
            return;
        }

        // Validate payout details based on method
        if (payoutMethod === 'upi' && !profile.upi_id) {
            toast.error("Please enter your UPI ID in Profile settings");
            setActiveTab('profile');
            setIsWithdrawModalOpen(false);
            return;
        }

        if (payoutMethod === 'bank' && (!profile.bank_account_number || !profile.bank_ifsc_code)) {
            toast.error("Please enter your Bank Details in Profile settings");
            setActiveTab('profile');
            setIsWithdrawModalOpen(false);
            return;
        }

        setIsProcessingWithdraw(true);
        try {
            const details = payoutMethod === 'upi' 
                ? { upi_id: profile.upi_id }
                : { 
                    bank_name: profile.bank_name, 
                    account_number: profile.bank_account_number, 
                    ifsc: profile.bank_ifsc_code 
                  };

            const { error } = await supabase
                .from('payouts')
                .insert({
                    driver_id: user.id,
                    amount,
                    method: payoutMethod,
                    details,
                    status: 'pending'
                });

            if (error) throw error;

            toast.success("Withdrawal request submitted!", {
                description: `₹${amount} will be credited to your ${payoutMethod.toUpperCase()} shortly.`
            });
            setIsWithdrawModalOpen(false);
            setWithdrawAmount('');
        } catch (err: any) {
            toast.error(err.message || "Withdrawal failed");
        } finally {
            setIsProcessingWithdraw(false);
        }
    };

    const handleUpdateRideStatus = async (rideId: string, status: string) => {
        if (!user) return;
        const currentStatus = (activeRide?.id === rideId ? activeRide.status : 'requested');
        console.log(`🔄 [Driver] Attempting status update: ${currentStatus} → ${status} for ride: ${rideId}`);

        if (!isValidTransition(currentStatus as any, status as any)) {
            console.warn(`⛔ [Driver] Invalid transition: ${currentStatus} → ${status} — blocked by rideLogic.isValidTransition`);
            return;
        }

        try {
            const updateData: any = { status };
            if (status === 'accepted') updateData.driver_id = user.id;

            const { error: updateError } = await supabase.from('rides').update(updateData).eq('id', rideId);
            if (updateError) {
                console.error(`🔴 [Driver] Supabase UPDATE failed for ride ${rideId}:`, updateError.message, updateError.code);
                toast.error("Failed to update status");
                return;
            }
            console.log(`✅ [Driver] DB updated — ride ${rideId} is now: ${status}`);

            if (status === 'accepted') {
                const { error: locError } = await supabase.from('driver_locations').update({ is_busy: true }).eq('user_id', user.id);
                if (locError) console.warn('⚠️ [Driver] Failed to set is_busy=true on driver_locations:', locError.message);
                console.log(`🚕 [Driver] Marked driver as busy. Rider should see update within 4s via polling.`);
                toast.success("Ride accepted!");
            } else if (status === 'completed' || status === 'cancelled') {
                const { error: locError } = await supabase.from('driver_locations').update({ is_busy: false }).eq('user_id', user.id);
                if (locError) console.warn('⚠️ [Driver] Failed to set is_busy=false on driver_locations:', locError.message);
                toast.success(`Ride ${status}`);
            }

            fetchAvailableRides();
            fetchHistory();
        } catch (err) {
            console.error('🔴 [Driver] handleUpdateRideStatus threw unexpectedly:', err);
            toast.error("Failed to update status");
        }
    };

    const handleSimulateDrive = async () => {
        if (!activeRide || !user) return;

        // Stop any ongoing simulation
        if (isSimulating) {
            if (simulationRef.current) clearInterval(simulationRef.current);
            setIsSimulating(false);
            toast.info('Simulation stopped');
            return;
        }

        // Figure out destination based on ride status
        const goingToPickup = activeRide.status === 'accepted' || activeRide.status === 'arrived';
        const destLat = goingToPickup ? activeRide.pickup_lat : activeRide.dropoff_lat;
        const destLng = goingToPickup ? activeRide.pickup_lng : activeRide.dropoff_lng;

        // Get driver's current location as simulation start
        const { data: locData } = await supabase
            .from('driver_locations')
            .select('lat, lng')
            .eq('user_id', user.id)
            .single();

        const startLat = locData?.lat ?? 19.076;
        const startLng = locData?.lng ?? 72.877;

        toast.info(`🚗 Fetching simulation route...`);
        try {
            const res = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`
            );
            const data = await res.json();
            if (!data.routes?.[0]) {
                toast.error('Could not get route from OSRM');
                return;
            }

            const coords: [number, number][] = data.routes[0].geometry.coordinates; // [lng, lat][]
            let idx = 0;
            const STEP = 8; // skip 8 coords per tick for realistic speed

            setIsSimulating(true);
            toast.success(`▶ Simulation started — ${coords.length} route points`);

            simulationRef.current = setInterval(async () => {
                if (idx >= coords.length) {
                    clearInterval(simulationRef.current!);
                    setIsSimulating(false);
                    toast.success('✅ Simulation complete — driver reached destination');
                    return;
                }
                const [lng, lat] = coords[idx];
                await supabase.from('driver_locations').upsert({
                    user_id: user.id,
                    lat, lng,
                    is_online: true,
                    is_busy: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                idx += STEP;
            }, 1500);

        } catch (e) {
            toast.error('Simulation failed — check network');
            console.error('🔴 [Simulation] OSRM request failed:', e);
        }
    };

    const handleLogout = async () => {
        if (user) await supabase.from('driver_locations').update({ is_online: false }).eq('user_id', user.id);
        await signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Premium Header */}
            <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary overflow-hidden">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-5 h-5 font-black" />
                        )}
                    </div>
                    <div>
                        <h1 className="font-black text-lg tracking-tight uppercase truncate max-w-[120px]">
                            {profile.full_name || 'Driver Hub'}
                        </h1>
                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground leading-none">
                            {profile.vehicle_number || 'No Vehicle Info'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
                        <Label htmlFor="duty-mode" className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </Label>
                        <Switch 
                            id="duty-mode" 
                            checked={isOnline} 
                            onCheckedChange={handleToggleOnline}
                            className="data-[state=checked]:bg-green-500 scale-90"
                        />
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full hover:bg-destructive/10 hover:text-destructive h-10 w-10">
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="p-4 space-y-6 max-w-4xl mx-auto">
                {/* Performance Row (Non-Sticky for better visibility) */}
                <div className="grid grid-cols-2 gap-3 mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-white p-4 rounded-[32px] border border-slate-100 flex items-center space-x-3 shadow-sm">
                        <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-600">
                            <DollarSign className="w-5 h-5 font-black" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Earned Today</p>
                            <p className="text-xl font-black text-slate-800 leading-none">₹{dailyEarnings}</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-[32px] border border-slate-100 flex items-center space-x-3 shadow-sm">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600">
                            <CheckCircle className="w-5 h-5 font-black" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Total Trips</p>
                            <p className="text-xl font-black text-slate-800 leading-none">{totalRides}</p>
                        </div>
                    </div>
                </div>

                {/* 1. ACTIVE RIDE (Always Visible Priority) */}
                {activeRide && (
                    <Card className="p-0 overflow-hidden border-2 border-primary shadow-2xl animate-in zoom-in-95 duration-500 mb-6">
                        <div className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground">
                            <div className="flex items-center space-x-2">
                                <Zap className="w-4 h-4 fill-current animate-pulse" />
                                <span className="font-black text-sm uppercase tracking-widest">Ongoing Trip</span>
                            </div>
                            <span className="font-black text-lg">₹{activeRide.fare_amount}</span>
                        </div>
                        <div className="p-5 space-y-4 bg-white">
                            <div className="relative space-y-4 pl-6 border-l-2 border-dashed border-slate-200 ml-1">
                                <div className="relative">
                                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-md"></div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase leading-tight">Start</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{activeRide.pickup_address}</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-destructive border-4 border-white shadow-md"></div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase leading-tight">End</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{activeRide.dropoff_address}</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Button 
                                    variant="outline"
                                    className="w-full h-14 font-black rounded-2xl border-2 hover:bg-slate-50 relative overflow-hidden group" 
                                    onClick={handleSimulateDrive}
                                >
                                    <Zap className={`w-5 h-5 mr-2 ${isSimulating ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
                                    {isSimulating ? 'STOP SIMULATION' : 'SIMULATE DRIVE (TEST)'}
                                    {isSimulating && <div className="absolute bottom-0 left-0 h-1 bg-orange-500 animate-pulse w-full"></div>}
                                </Button>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button 
                                        variant="outline"
                                        className="h-14 font-black rounded-2xl border-2 hover:bg-slate-50" 
                                        onClick={() => {
                                            const dest = activeRide.status === 'accepted' ? activeRide.pickup_address : activeRide.dropoff_address;
                                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, '_blank')
                                        }}
                                    >
                                        <Navigation className="w-5 h-5 mr-2" />
                                        NAVIGATE
                                    </Button>

                                    <Button 
                                        variant="outline"
                                        className={`h-14 font-black rounded-2xl border-2 transition-all ${showChat ? 'bg-primary border-primary text-black' : 'hover:bg-slate-50'}`} 
                                        onClick={() => setShowChat(!showChat)}
                                    >
                                        <MessageCircle className="w-5 h-5 mr-2" />
                                        CHAT
                                    </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {activeRide.status === 'accepted' ? (
                                        <Button className="h-16 bg-indigo-600 hover:bg-indigo-700 font-black text-lg rounded-2xl shadow-lg shadow-indigo-200" onClick={() => handleUpdateRideStatus(activeRide.id, 'arrived')}>
                                            I HAVE ARRIVED
                                        </Button>
                                    ) : activeRide.status === 'arrived' ? (
                                        <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100 space-y-4 animate-in slide-in-from-top-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <ShieldCheck className="w-4 h-4 text-orange-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security Verification</span>
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded-lg border">OTP REQUIRED</span>
                                            </div>
                                            
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    maxLength={4}
                                                    placeholder="Enter Code"
                                                    value={otpInput}
                                                    onChange={(e) => setOtpInput(e.target.value)}
                                                    className="w-full h-16 bg-white border-2 border-slate-200 rounded-2xl font-black text-center text-2xl tracking-[0.8em] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:tracking-normal placeholder:text-sm placeholder:font-bold placeholder:text-slate-300"
                                                />
                                            </div>

                                            <Button 
                                                disabled={otpInput !== activeRide.otp_code}
                                                className="w-full h-14 bg-orange-500 hover:bg-orange-600 font-black rounded-2xl shadow-lg shadow-orange-200 disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98]" 
                                                onClick={() => {
                                                    handleUpdateRideStatus(activeRide.id, 'in_progress');
                                                    setOtpInput(''); // reset
                                                }}
                                            >
                                                START TRIP
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button className="h-16 bg-green-600 hover:bg-green-700 font-black text-lg rounded-2xl shadow-lg shadow-green-200" onClick={() => handleUpdateRideStatus(activeRide.id, 'completed')}>
                                            COMPLETE TRIP
                                        </Button>
                                    )}
                                </div>

                                {(activeRide.status === 'accepted' || activeRide.status === 'arrived') && (
                                    <Button 
                                        variant="ghost" 
                                        className="w-full h-12 text-destructive hover:bg-destructive/10 hover:text-destructive font-black rounded-2xl uppercase tracking-widest text-[10px] mt-2"
                                        onClick={() => {
                                            if (window.confirm("Are you sure you want to cancel this ride? This will notify the customer.")) {
                                                handleUpdateRideStatus(activeRide.id, 'cancelled');
                                            }
                                        }}
                                    >
                                        Cancel Ride
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>

                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* TAB 1: DUTY (SIMPLE VIEW) */}
                    <TabsContent value="duty" className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                        {/* Live Requests Section */}
                        <div className="space-y-4">
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mt-2 flex items-center">
                                New Ride Requests
                            </h3>
                            
                            {!activeSubscription && (
                                <Card className="p-8 border-none shadow-lg bg-orange-50 text-center space-y-4 rounded-[40px] border border-orange-100">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                                        <ShieldCheck className="w-8 h-8 text-orange-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-black text-slate-800">Subscription Required</h4>
                                        <p className="text-xs text-slate-500 px-6">You need an active pass to receive ride requests. We take 0% commission!</p>
                                    </div>
                                    <Button onClick={() => setActiveTab('passes')} className="w-full h-14 bg-orange-500 hover:bg-orange-600 font-black rounded-2xl shadow-lg shadow-orange-100">
                                        VIEW PASSES
                                    </Button>
                                </Card>
                            )}

                            {activeSubscription && availableRides.length === 0 ? (
                                <div className="text-center py-20 text-muted-foreground bg-white rounded-[40px] border-2 border-dashed border-slate-100 px-10">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <Navigation className="w-8 h-8 opacity-20 text-slate-400" />
                                    </div>
                                    <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Waiting for you...</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">Keep the app open to receive bookings</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {availableRides.map((ride) => (
                                        <Card key={ride.id} className="p-5 overflow-hidden border-none shadow-lg bg-white rounded-[32px] hover:scale-[1.02] transition-transform">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-2 px-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] tracking-widest flex items-center">
                                                    SURGE PRICE
                                                </div>
                                                <span className="font-black text-3xl text-slate-800 tracking-tighter">₹{ride.fare_amount}</span>
                                            </div>

                                            <div className="space-y-3 relative pl-4 border-l-2 border-slate-50 mb-6">
                                                <div>
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">Pick up</p>
                                                    <p className="font-black text-sm text-slate-700 truncate">{ride.pickup_address}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">Drop to</p>
                                                    <p className="font-black text-sm text-slate-700 truncate">{ride.dropoff_address}</p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleUpdateRideStatus(ride.id, 'accepted')}
                                                disabled={!!activeRide}
                                                className="w-full h-16 bg-slate-900 hover:bg-primary text-white font-black text-sm uppercase tracking-widest rounded-[24px] shadow-xl shadow-slate-200"
                                            >
                                                {activeRide ? "FINISH CURRENT TRIP" : "BOOK RIDE"}
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* TAB 2: ANALYTICS (ADVANCED VIEW) */}
                    <TabsContent value="analytics" className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        {/* Weekly Earnings Chart */}
                        <Card className="p-6 border-none shadow-sm bg-white rounded-[32px]">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="font-black text-slate-800">Weekly Performance</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Earnings trend</p>
                                </div>
                                 <div className="text-right">
                                    <p className="text-xl font-black text-indigo-600">₹{weeklyEarningsData.reduce((s, d) => s + d.amount, 0)}</p>
                                    <p className="text-[10px] font-bold text-green-600 uppercase">This Week</p>
                                </div>
                            </div>
                            <div className="h-[200px] w">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={weeklyEarningsData}>
                                        <defs>
                                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                                            itemStyle={{fontWeight: 800, color: '#4f46e5'}}
                                        />
                                        <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorEarnings)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Daily Goal card */}
                            <Card className="p-6 border-none shadow-sm bg-white rounded-[32px] bg-gradient-to-br from-white to-slate-50">
                                <div className="flex items-center space-x-2 mb-4">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                        <Target className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-black text-slate-800">Income Goal</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-black text-indigo-600">₹{dailyEarnings}</span>
                                        <div className="text-right">
                                            {isEditingGoal ? (
                                                <div className="flex items-center space-x-2">
                                                    <input 
                                                        type="number" 
                                                        value={newGoal}
                                                        onChange={(e) => setNewGoal(e.target.value)}
                                                        className="w-20 h-8 border rounded px-2 text-xs font-bold font-mono"
                                                        placeholder="Goal"
                                                        autoFocus
                                                    />
                                                    <Button size="icon" className="h-6 w-6 rounded-full" onClick={handleUpdateGoal}>
                                                        <ShieldCheck className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => setIsEditingGoal(false)}>
                                                        <LogOut className="w-3 h-3 rotate-180" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="group flex items-center space-x-2 cursor-pointer" onClick={() => {
                                                    setNewGoal(profile.daily_goal.toString());
                                                    setIsEditingGoal(true);
                                                }}>
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Daily Target: ₹{profile.daily_goal}</span>
                                                    <Badge variant="outline" className="p-0 border-none opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <TrendingUp className="w-3 h-3 text-indigo-500" />
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Progress value={goalProgress} className="h-4 bg-indigo-50 rounded-full" />
                                    <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest transition-all">
                                        {dailyEarnings >= profile.daily_goal 
                                            ? <span className="text-green-600">+₹{dailyEarnings - profile.daily_goal} more than goal! 🚀</span>
                                            : `₹${profile.daily_goal - dailyEarnings} more for target!`
                                        }
                                    </p>
                                </div>
                            </Card>

                            {/* Revenue Mix */}
                            <Card className="p-6 border-none shadow-sm bg-white rounded-[32px]">
                                <h3 className="font-black text-slate-800 mb-4">Earnings Mix</h3>
                                <div className="h-[120px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={REVENUE_DATA} 
                                                innerRadius={40} 
                                                outerRadius={60} 
                                                paddingAngle={8} 
                                                dataKey="value"
                                            >
                                                {REVENUE_DATA.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    {REVENUE_DATA.map((d, i) => (
                                        <div key={i} className="text-center">
                                            <div className="w-1.5 h-1.5 rounded-full mx-auto mb-1" style={{ backgroundColor: d.color }}></div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase truncate">{d.name}</p>
                                            <p className="text-[10px] font-black text-slate-800">{d.value}%</p>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* AI Coach / Smart Advisor */}
                        <Card className="p-6 border-none shadow-xl bg-slate-900 rounded-[32px] overflow-hidden relative group">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-[80px]"></div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-indigo-400">
                                    <BrainCircuit className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-sm uppercase tracking-widest">Smart Advisor</h3>
                                    <p className="text-[9px] font-bold text-indigo-400">DEMAND PREDICTION</p>
                                </div>
                                <Badge className="ml-auto bg-indigo-500 text-[9px] font-black h-5">LIVE</Badge>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed mb-6 font-medium">
                                We suggest moving towards <span className="text-white font-black underline decoration-indigo-500 underline-offset-4">BKC Area</span>. 
                                Ride bookings are expected to double in the next 15 minutes.
                            </p>
                            <Button className="w-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-black tracking-[0.2em] border-none rounded-2xl h-12">
                                SEE MAP
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </Card>
                        
                        {/* Performance Details */}
                        <div className="grid grid-cols-3 gap-4 pb-6">
                            <div className="bg-white p-5 rounded-[32px] shadow-sm text-center">
                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Star Rating</p>
                                <div className="flex items-center justify-center space-x-1">
                                    <span className="text-lg font-black text-slate-800">{driverRating}</span>
                                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-[32px] shadow-sm text-center">
                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Time Online</p>
                                <p className="text-lg font-black text-slate-800 truncate">{onlineTime}</p>
                            </div>
                            <div className="bg-white p-5 rounded-[32px] shadow-sm text-center">
                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Jobs Taken</p>
                                <p className="text-lg font-black text-slate-800">{acceptanceRate}%</p>
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB: WALLET (NEW) */}
                    <TabsContent value="wallet" className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                        {/* Balance Card */}
                        <Card className="p-8 border-none shadow-2xl bg-indigo-600 text-white rounded-[40px] overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                            <div className="relative z-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Current Balance</p>
                                    <div className="bg-white/20 p-2 rounded-xl">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                </div>
                                <h2 className="text-5xl font-black tracking-tighter">₹{totalRevenue}</h2>
                                <div className="pt-4 flex gap-3">
                                    <Button 
                                        className="flex-1 bg-white text-indigo-600 hover:bg-slate-50 font-black h-14 rounded-2xl shadow-xl"
                                        onClick={() => {
                                            if (totalRevenue <= 0) {
                                                toast.error("You have no earnings to withdraw");
                                                return;
                                            }
                                            setIsWithdrawModalOpen(true);
                                        }}
                                    >
                                        WITHDRAW
                                    </Button>
                                    <Button variant="outline" className="w-14 h-14 bg-white/10 border-white/20 text-white rounded-2xl hover:bg-white/20">
                                        <ArrowUpRight className="w-5 h-5 text-white" />
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Recent Payouts */}
                        <div className="space-y-4">
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Recent Transactions</h3>
                            <Card className="p-0 overflow-hidden border-none shadow-sm bg-white">
                                <div className="divide-y divide-slate-50">
                                    {rideHistory.filter(r => r.status === 'completed').slice(0, 5).map((txn) => (
                                        <div key={txn.id} className="p-5 flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                                                    <ArrowDownLeft className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-700">Trip Earnings</p>
                                                    <p className="text-[10px] font-bold text-slate-400">
                                                        {new Date(txn.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })} • {new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="font-black text-green-600">+₹{txn.fare_amount}</p>
                                        </div>
                                    ))}
                                    {rideHistory.filter(r => r.status === 'completed').length === 0 && (
                                        <div className="p-10 text-center space-y-2">
                                            <Wallet className="w-8 h-8 text-slate-200 mx-auto" />
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Transactions Yet</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB: PASSES (NEW) */}
                    <TabsContent value="passes" className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="space-y-4">
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 px-2">Choose Your Work Plan</h3>
                            
                            <div className="grid gap-4">
                                {[
                                    { name: 'Daily Pass', price: 49, days: 1, color: 'bg-slate-100 text-slate-400' },
                                    { name: 'Weekly Pro', price: 299, days: 7, color: 'bg-indigo-50 text-indigo-600', popular: true },
                                    { name: 'Monthly Elite', price: 999, days: 30, color: 'bg-yellow-50 text-yellow-600' }
                                ].map((plan) => (
                                    <Card key={plan.name} className={`p-6 border-none shadow-sm bg-white rounded-[32px] relative overflow-hidden group hover:shadow-xl transition-all ${plan.popular ? 'ring-2 ring-indigo-500' : ''}`}>
                                        {plan.popular && (
                                            <div className="absolute top-0 right-10 bg-indigo-500 text-white text-[8px] font-black px-3 py-1 rounded-b-xl tracking-widest uppercase">Best Value</div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h4 className="font-black text-slate-800 text-lg">{plan.name}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validity: {plan.days} Days</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-slate-800">₹{plan.price}</p>
                                                <p className="text-[10px] font-bold text-indigo-500 uppercase">0% Commission</p>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={() => handlePurchasePass(plan.name, plan.days, plan.price)}
                                            disabled={activeSubscription?.plan_name === plan.name}
                                            className={`w-full mt-6 h-14 font-black rounded-2xl ${activeSubscription?.plan_name === plan.name ? 'bg-slate-100 text-slate-400' : 'btn-taxi text-black hover:scale-100 shadow-none'}`}
                                        >
                                            {activeSubscription?.plan_name === plan.name ? 'CURRENT PLAN' : 'ACTIVATE NOW'}
                                        </Button>
                                    </Card>
                                ))}
                            </div>

                            <Card className="p-6 bg-slate-900 text-white rounded-[32px] border-none">
                                <div className="flex items-center space-x-3 mb-3">
                                    <ShieldCheck className="w-5 h-5 text-green-400" />
                                    <h4 className="font-black uppercase text-xs tracking-widest">Why Subscriptions?</h4>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                    Unlike other apps, we never take a percentage of your fare. 
                                    Whatever you earn stays 100% in your pocket. 
                                    Just pay a small daily or monthly fee to use our platform and earn unlimited!
                                </p>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB: PROFILE (NEW) */}
                    <TabsContent value="profile" className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="space-y-4">
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 px-2">My Profile</h3>
                            
                            <Card className="p-8 border-none shadow-xl bg-white rounded-[40px] space-y-6">
                                <div className="space-y-4">
                                    {/* Profile Picture Upload Section */}
                                    <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 mb-4 transition-all hover:bg-slate-100 group">
                                        <div className="relative w-24 h-24 rounded-[32px] overflow-hidden shadow-xl mb-3 ring-4 ring-white group-hover:scale-105 transition-transform">
                                            {profile.avatar_url ? (
                                                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-400">
                                                    <User className="w-10 h-10" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2 w-full px-6">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center block">Update Profile Picture</Label>
                                            <div className="relative flex justify-center">
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={handlePfpUpload}
                                                    className="hidden"
                                                    id="pfp-upload"
                                                />
                                                <Label 
                                                    htmlFor="pfp-upload"
                                                    className="btn-taxi h-10 px-6 flex items-center justify-center cursor-pointer text-[10px] font-black uppercase tracking-widest text-black hover:scale-105 transition-all shadow-none"
                                                >
                                                    {isUploadingPfp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Select File"}
                                                </Label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</Label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={profile.full_name}
                                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                                placeholder="Enter your name"
                                                className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            />
                                            <User className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vehicle Plate Number</Label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={profile.vehicle_number}
                                                onChange={(e) => setProfile({ ...profile, vehicle_number: e.target.value })}
                                                placeholder="e.g. MH-01-AB-1234"
                                                className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold uppercase focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:lowercase"
                                            />
                                            <Navigation2 className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                        </div>
                                    </div>

                                    {/* Payout Details Section */}
                                    <div className="pt-4 border-t border-slate-50">
                                        <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-4">Payout Settings</h4>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1">UPI ID (Most Recommended)</Label>
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        value={profile.upi_id}
                                                        onChange={(e) => setProfile({ ...profile, upi_id: e.target.value })}
                                                        placeholder="username@bank"
                                                        className="w-full h-14 bg-indigo-50/50 border-none rounded-2xl px-6 font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                                    />
                                                    <Zap className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Name</Label>
                                                    <input 
                                                        type="text" 
                                                        value={profile.bank_name}
                                                        onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })}
                                                        placeholder="HDFC Bank"
                                                        className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">IFSC Code</Label>
                                                    <input 
                                                        type="text" 
                                                        value={profile.bank_ifsc_code}
                                                        style={{ textTransform: 'uppercase' }}
                                                        onChange={(e) => setProfile({ ...profile, bank_ifsc_code: e.target.value.toUpperCase() })}
                                                        placeholder="HDFC0001234"
                                                        className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Account Number</Label>
                                                <input 
                                                    type="text" 
                                                    value={profile.bank_account_number}
                                                    onChange={(e) => setProfile({ ...profile, bank_account_number: e.target.value })}
                                                    placeholder="Enter your account number"
                                                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                    onClick={handleUpdateProfile}
                                    disabled={isUpdatingProfile}
                                    className="w-full h-14 btn-taxi font-black text-black rounded-2xl shadow-lg transition-all active:scale-95 hover:scale-100"
                                >
                                    {isUpdatingProfile ? <Loader2 className="animate-spin" /> : "SAVE CHANGES"}
                                </Button>
                            </Card>

                            <Card className="p-6 bg-slate-50 border-none rounded-[32px] flex items-center space-x-4">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-800">Support</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">24/7 Driver Helpline</p>
                                </div>
                                <ChevronRight className="ml-auto w-5 h-5 text-slate-300" />
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB 3: HISTORY */}
                    <TabsContent value="history" className="animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-white rounded-[40px] overflow-hidden shadow-sm border border-slate-50">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                                <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Trip Ledger</h3>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {rideHistory.length === 0 ? (
                                    <div className="p-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Empty</div>
                                ) : (
                                    rideHistory.map((ride) => (
                                        <div key={ride.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center space-x-5">
                                                <div className={`w-12 h-12 rounded-[20px] flex items-center justify-center ${ride.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                                                    {ride.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-slate-800">₹{ride.fare_amount}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{ride.status} • {new Date(ride.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-500 uppercase max-w-[120px] truncate mb-1">{ride.dropoff_address.split(',')[0]}</p>
                                                {ride.payment_status === 'paid' && (
                                                    <Badge className="bg-green-500 h-5 text-[9px] font-black tracking-widest px-2">SETTLED</Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            
            {/* Quick Actions Bottom Bar (Mobile Only) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-2 md:hidden grid grid-cols-5 gap-1 z-[60] h-20 shadow-[0_-10px_30px_-5px_rgb(0,0,0,0.05)] rounded-t-[32px]">
                <Button 
                    variant="ghost" 
                    onClick={() => setActiveTab('duty')}
                    className={`flex flex-col h-full rounded-2xl space-y-1 transition-all ${activeTab === 'duty' ? 'bg-slate-50' : 'opacity-40'}`}
                >
                    <Zap className={`w-4 h-4 ${activeTab === 'duty' ? 'text-primary' : 'text-slate-400'}`} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Duty</span>
                </Button>
                <Button 
                    variant="ghost" 
                    onClick={() => setActiveTab('wallet')}
                    className={`flex flex-col h-full rounded-2xl space-y-1 transition-all ${activeTab === 'wallet' ? 'bg-slate-50' : 'opacity-40'}`}
                >
                    <DollarSign className={`w-4 h-4 ${activeTab === 'wallet' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Wallet</span>
                </Button>
                <Button 
                    variant="ghost" 
                    onClick={() => setActiveTab('analytics')}
                    className={`flex flex-col h-full rounded-2xl space-y-1 transition-all ${activeTab === 'analytics' ? 'bg-slate-50' : 'opacity-40'}`}
                >
                    <Activity className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-orange-500' : 'text-slate-400'}`} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Score</span>
                </Button>
                <Button 
                    variant="ghost" 
                    onClick={() => setActiveTab('passes')}
                    className={`flex flex-col h-full rounded-2xl space-y-1 transition-all ${activeTab === 'passes' ? 'bg-slate-50' : 'opacity-40'}`}
                >
                    <ShieldCheck className={`w-4 h-4 ${activeTab === 'passes' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Passes</span>
                </Button>
                <Button 
                    variant="ghost" 
                    onClick={() => setActiveTab('profile')}
                    className={`flex flex-col h-full rounded-2xl space-y-1 transition-all ${activeTab === 'profile' ? 'bg-slate-50' : 'opacity-40'}`}
                >
                    <User className={`w-4 h-4 ${activeTab === 'profile' ? 'text-slate-800' : 'text-slate-400'}`} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Profile</span>
                </Button>
            </div>

            {showChat && activeRide && (
                <ChatInterface 
                    rideId={activeRide.id} 
                    receiverName={customerInfo?.full_name || "Customer"} 
                    receiverAvatar={customerInfo?.avatar_url}
                    onClose={() => setShowChat(false)} 
                />
            )}

            {/* WITHDRAW MODAL */}
            <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
                <DialogContent className="sm:max-w-md rounded-[40px] border-none p-8 gap-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <Wallet className="w-6 h-6 text-indigo-600" />
                            Withdraw Funds
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Available Balance</p>
                                <p className="text-2xl font-black text-slate-800">₹{totalRevenue}</p>
                            </div>
                            <Badge className="bg-green-500 text-white font-black">WITHDRAWABLE</Badge>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enter Amount</Label>
                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
                                <input 
                                    type="number"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full h-16 bg-white border-2 border-slate-100 rounded-3xl pl-12 pr-6 font-black text-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transfer Method</Label>
                            <RadioGroup value={payoutMethod} onValueChange={(v: any) => setPayoutMethod(v)} className="grid grid-cols-2 gap-3">
                                <label className={`flex flex-col items-center justify-center p-4 rounded-[28px] border-2 transition-all cursor-pointer ${payoutMethod === 'upi' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                                    <RadioGroupItem value="upi" className="sr-only" />
                                    <Zap className={`w-5 h-5 mb-2 ${payoutMethod === 'upi' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${payoutMethod === 'upi' ? 'text-indigo-600' : 'text-slate-400'}`}>UPI Transfer</span>
                                </label>
                                <label className={`flex flex-col items-center justify-center p-4 rounded-[28px] border-2 transition-all cursor-pointer ${payoutMethod === 'bank' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                                    <RadioGroupItem value="bank" className="sr-only" />
                                    <CheckCircle className={`w-5 h-5 mb-2 ${payoutMethod === 'bank' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${payoutMethod === 'bank' ? 'text-indigo-600' : 'text-slate-400'}`}>Bank Transfer</span>
                                </label>
                            </RadioGroup>
                        </div>

                        {payoutMethod === 'upi' ? (
                            <div className="flex items-center space-x-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                <div className="p-2 bg-white rounded-xl shadow-sm">
                                    <Smartphone className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">UPI ID</p>
                                    <p className="text-xs font-black text-indigo-900">{profile.upi_id || "NOT SET - GO TO PROFILE"}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                <div className="p-2 bg-white rounded-xl shadow-sm">
                                    <CheckCircle className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Bank Info</p>
                                    <p className="text-xs font-black text-indigo-900 truncate">
                                        {profile.bank_account_number ? `${profile.bank_name} • ${profile.bank_account_number}` : "NOT SET - GO TO PROFILE"}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="sm:justify-start gap-4">
                        <Button 
                            onClick={handleWithdraw}
                            disabled={isProcessingWithdraw || !withdrawAmount}
                            className="w-full h-16 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm uppercase tracking-widest rounded-3xl shadow-xl active:scale-95 transition-all"
                        >
                            {isProcessingWithdraw ? <Loader2 className="animate-spin" /> : "REQUEST WITHDRAWAL"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DriverDashboard;
