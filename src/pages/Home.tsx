import { useState } from "react";
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
  User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Map from "@/components/Map";

const Home = () => {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const navigate = useNavigate();

  const quickActions = [
    { icon: HomeIcon, label: "Home", address: "123 Main Street" },
    { icon: Briefcase, label: "Work", address: "Business Center" },
    { icon: Clock, label: "Recent", address: "Mall Plaza" },
    { icon: Heart, label: "Favorites", address: "Airport" }
  ];

  const handleBookRide = () => {
    navigate("/book-ride");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Good morning</p>
              <p className="font-semibold">John Doe</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl">
            <User className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Map Section */}
        <Card className="card-taxi overflow-hidden animate-fade-in">
          <div className="relative h-48">
            <Map />
            <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-card/90 backdrop-blur-sm rounded-xl px-3 py-2 pointer-events-none">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Current Location</span>
            </div>
          </div>
        </Card>

        {/* Search Section */}
        <Card className="card-taxi animate-slide-up">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Where to?</h3>
            
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
                <Input
                  placeholder="Pickup location"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="pl-8 h-12 rounded-xl border-2 focus:border-primary"
                />
              </div>
              
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <MapPin className="w-4 h-4 text-destructive" />
                </div>
                <Input
                  placeholder="Where to?"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="pl-8 h-12 rounded-xl border-2 focus:border-primary"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="animate-fade-in">
          <h3 className="font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <Card 
                key={index} 
                className="card-taxi-interactive"
                onClick={() => setDestination(action.address)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-taxi-yellow-light rounded-xl flex items-center justify-center">
                    <action.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-sm text-muted-foreground">{action.address}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Book Ride Button */}
        <div className="animate-scale-in">
          <Button 
            onClick={handleBookRide}
            className="btn-taxi w-full h-14 text-lg font-semibold"
          >
            Book Your Ride
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;