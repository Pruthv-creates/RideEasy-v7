import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Star,
  Receipt,
  Car,
  Filter
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

const TripHistory = () => {
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey(full_name)
        `)
        .eq('rider_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTrips = data.map(ride => ({
        id: ride.id.slice(0, 8).toUpperCase(), // Short ID
        from: ride.pickup_address,
        to: ride.dropoff_address,
        pickupCoords: { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) },
        destinationCoords: { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng) },
        date: new Date(ride.created_at).toLocaleDateString() + ", " + new Date(ride.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fare: "₹" + ride.fare_amount,
        status: ride.status,
        driver: ride.driver?.full_name || "Assigned Driver",
        rating: 5, // Placeholder as we don't have ratings table yet
        vehicle: "Taxi", // Placeholder
        duration: "25 min" // Placeholder
      }));

      setTrips(formattedTrips);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredTrips = filter === "all"
    ? trips
    : trips.filter(trip => trip.status === filter);

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
            <h1 className="text-xl font-semibold">Trip History</h1>
            <p className="text-sm text-muted-foreground">{filteredTrips.length} trips found</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl">
            <Filter className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Filter Tabs */}
        <div className="flex space-x-2 animate-fade-in">
          {[
            { id: "all", label: "All Trips" },
            { id: "completed", label: "Completed" },
            { id: "cancelled", label: "Cancelled" }
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={filter === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(tab.id)}
              className={`rounded-xl ${filter === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
                }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Trip Cards */}
        <div className="space-y-4">
          {filteredTrips.map((trip, index) => (
            <Card
              key={trip.id}
              className="card-taxi-interactive animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="space-y-4">
                {/* Trip Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-taxi-yellow-light rounded-xl flex items-center justify-center">
                      <Car className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Trip #{trip.id}</p>
                      <p className="text-sm text-muted-foreground">{trip.date}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-lg">{trip.fare}</p>
                    <Badge className={`text-xs border ${getStatusColor(trip.status)}`}>
                      {trip.status}
                    </Badge>
                  </div>
                </div>

                {/* Route */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-sm font-medium">{trip.from}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">{trip.to}</span>
                  </div>
                </div>

                {/* Trip Details */}
                {trip.status === "completed" && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">Driver:</span>
                        <span className="font-medium">{trip.driver}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-current text-primary" />
                        <span className="font-medium">{trip.rating}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <Car className="w-4 h-4" />
                        <span>{trip.vehicle}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>{trip.duration}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="border-t pt-3 flex space-x-3">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl">
                    <Receipt className="w-4 h-4 mr-2" />
                    View Receipt
                  </Button>
                  {trip.status === "completed" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-xl"
                      onClick={() => navigate("/book-ride", {
                        state: {
                          pickup: trip.from,
                          destination: trip.to,
                          pickupCoords: trip.pickupCoords,
                          destinationCoords: trip.destinationCoords
                        }
                      })}
                    >
                      <Car className="w-4 h-4 mr-2" />
                      Book Again
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Book New Ride */}
        <div className="animate-scale-in pt-4">
          <Button
            onClick={() => navigate("/home")}
            className="btn-taxi w-full h-14 text-lg font-semibold"
          >
            Book a New Ride
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TripHistory;