import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  Clock,
  Star,
  Car,
  Truck,
  Zap,
  Loader2
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const BookRide = () => {
  const [selectedCar, setSelectedCar] = useState("mini");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Get data from navigation state or defaults
  const state = location.state as {
    pickup?: string;
    destination?: string;
    pickupCoords?: { lat: number; lng: number };
    destinationCoords?: { lat: number; lng: number };
  } || {};

  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [subscription, setSubscription] = useState<any>(null);

  const pickupAddress = state.pickup || "Main Street, Downtown";
  const dropoffAddress = state.destination || "Airport Terminal 1";

  // Fetch subscription
  useEffect(() => {
    if (user) {
        supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single()
            .then(({ data }) => setSubscription(data));
    }
  }, [user]);

  useEffect(() => {
    if (state.pickupCoords && state.destinationCoords) {
      calculateRoute();
    }
  }, [state.pickupCoords, state.destinationCoords]);

  const calculateRoute = async () => {
    try {
      const { pickupCoords, destinationCoords } = state;
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${pickupCoords?.lng},${pickupCoords?.lat};${destinationCoords?.lng},${destinationCoords?.lat}?overview=false`);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        setDistance(data.routes[0].distance / 1000); // meters to km
        setDuration(data.routes[0].duration / 60); // seconds to mins
      }
    } catch (e) {
      console.error(e);
      setDistance(12.5); // Fallback
    }
  };

  const getDiscountFactor = () => {
    if (!subscription) return 1;
    switch (subscription.plan_type) {
      case 'silver': return 0.9; // 10% off
      case 'gold': return 0.8;   // 20% off
      case 'platinum': return 0.75; // 25% off
      default: return 1;
    }
  };

  const discountFactor = getDiscountFactor();

  const carTypes = [
    {
      id: "mini",
      name: "RideEasy Mini",
      description: "Affordable rides for 1-2 people",
      price: Math.round((distance * 15 + 30) * discountFactor),
      originalPrice: Math.round(distance * 15 + 30),
      eta: "3 min",
      capacity: 2,
      icon: Car,
      features: ["AC", "Economy"]
    },
    {
      id: "sedan",
      name: "RideEasy Sedan",
      description: "Comfortable rides for 3-4 people",
      price: Math.round((distance * 22 + 50) * discountFactor),
      originalPrice: Math.round(distance * 22 + 50),
      eta: "5 min",
      capacity: 4,
      icon: Car,
      features: ["AC", "Comfort", "Premium"]
    },
    {
      id: "suv",
      name: "RideEasy SUV",
      description: "Spacious rides for groups",
      price: Math.round((distance * 35 + 80) * discountFactor),
      originalPrice: Math.round(distance * 35 + 80),
      eta: "7 min",
      capacity: 6,
      icon: Truck,
      features: ["AC", "Luxury", "Extra Space"]
    }
  ];

  const handleContinue = async () => {
    if (!user) {
      toast.error("You must be logged in to book a ride.");
      navigate("/");
      return;
    }

    setLoading(true);
    const selectedCarDetails = carTypes.find(c => c.id === selectedCar);

    try {
      const { data, error } = await supabase
        .from("rides")
        .insert({
          customer_id: user.id,
          pickup_address: pickupAddress,
          dropoff_address: dropoffAddress,
          pickup_lat: state.pickupCoords?.lat,
          pickup_lng: state.pickupCoords?.lng,
          dropoff_lat: state.destinationCoords?.lat,
          dropoff_lng: state.destinationCoords?.lng,
          fare_amount: selectedCarDetails?.price || 0,
          status: "requested",
          otp_code: Math.floor(1000 + Math.random() * 9000).toString()
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Ride requested successfully!");
      navigate("/ride-details?id=" + data.id);

    } catch (err: any) {
      console.error("Booking error:", err);
      toast.error(err.message || "Failed to book ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/home")}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Choose Your Ride</h1>
            <p className="text-sm text-muted-foreground">Select your preferred vehicle</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {!subscription && (
          <Card 
            className="p-4 bg-gradient-to-r from-primary to-primary-hover text-primary-foreground border-0 shadow-lg cursor-pointer animate-pulse-subtle"
            onClick={() => navigate("/subscriptions")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">Level Up Your Rides</p>
                  <p className="text-xs opacity-90">Get up to 25% OFF every ride with Premium.</p>
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </div>
          </Card>
        )}

        {/* Trip Info */}
        <Card className="card-taxi animate-fade-in">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <span className="font-medium">Pickup: {pickupAddress}</span>
              </div>
              <Badge variant="secondary" className="bg-taxi-yellow-light text-primary">
                <Clock className="w-3 h-3 mr-1" />
                Now
              </Badge>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-destructive rounded-full"></div>
              <span className="font-medium">Drop: {dropoffAddress}</span>
            </div>
            <div className="text-sm text-muted-foreground pt-2 border-t">
              Distance: {distance.toFixed(1)} km • Estimated time: {Math.round(duration)} min
            </div>
          </div>
        </Card>

        {/* Car Selection */}
        <div className="space-y-4 animate-slide-up">
          <h3 className="font-semibold text-lg">Available Vehicles</h3>

          {carTypes.map((car, index) => (
            <Card
              key={car.id}
              className={`card-taxi-interactive transition-all duration-300 ${selectedCar === car.id
                ? 'border-primary border-2 shadow-[var(--shadow-elevated)]'
                : ''
                }`}
              onClick={() => setSelectedCar(car.id)}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${selectedCar === car.id
                  ? 'bg-gradient-to-r from-primary to-primary-hover'
                  : 'bg-taxi-yellow-light'
                  }`}>
                  <car.icon className={`w-8 h-8 ${selectedCar === car.id ? 'text-primary-foreground' : 'text-primary'
                    }`} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold">{car.name}</h4>
                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {discountFactor < 1 && (
                          <span className="text-sm text-muted-foreground line-through">₹{car.originalPrice}</span>
                        )}
                        <p className="font-bold text-lg text-primary">₹{car.price}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{car.eta} away</p>
                      {discountFactor < 1 && subscription && (
                        <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20 uppercase font-bold mt-1">
                          {subscription.plan_type} SAVINGS
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">{car.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{car.capacity}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-current text-primary" />
                        <span>4.8</span>
                      </div>
                    </div>

                    <div className="flex space-x-1">
                      {car.features.map((feature, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs bg-muted"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Continue Button */}
        <div className="animate-scale-in pt-4">
          <Button
            onClick={handleContinue}
            className="btn-taxi w-full h-14 text-lg font-semibold"
            disabled={!selectedCar || loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : `Continue with ${carTypes.find(c => c.id === selectedCar)?.name}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookRide;