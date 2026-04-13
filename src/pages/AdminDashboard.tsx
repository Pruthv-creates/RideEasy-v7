import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Users, Car } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AdminDashboard = () => {
    const { user, role, signOut, loading } = useAuth();
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalDrivers, setTotalDrivers] = useState(0);
    const [totalRides, setTotalRides] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate("/");
            } else if (role !== 'admin') {
                navigate("/home");
                toast.error("Access denied. Admins only.");
            } else {
                fetchStats();
            }
        }
    }, [user, role, loading, navigate]);

    const fetchStats = async () => {
        const { count: userCount } = await supabase.from("profiles").select("*", { count: 'exact', head: true }).eq('role', 'rider');
        const { count: driverCount } = await supabase.from("profiles").select("*", { count: 'exact', head: true }).eq('role', 'driver');
        const { count: rideCount } = await supabase.from("rides").select("*", { count: 'exact', head: true });

        setTotalUsers(userCount || 0);
        setTotalDrivers(driverCount || 0);
        setTotalRides(rideCount || 0);
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="font-semibold text-lg">Admin Dashboard</h1>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="w-5 h-5" />
                </Button>
            </div>

            <div className="p-4 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 flex flex-col items-center justify-center space-y-2">
                        <Users className="w-8 h-8 text-blue-500" />
                        <span className="text-2xl font-bold">{totalUsers}</span>
                        <span className="text-xs text-muted-foreground">Riders</span>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center space-y-2">
                        <Car className="w-8 h-8 text-green-500" />
                        <span className="text-2xl font-bold">{totalDrivers}</span>
                        <span className="text-xs text-muted-foreground">Drivers</span>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center space-y-2 col-span-2">
                        <span className="text-4xl font-bold text-primary">{totalRides}</span>
                        <span className="text-sm text-muted-foreground">Total Rides</span>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
