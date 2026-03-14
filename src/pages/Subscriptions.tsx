import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Zap, Star, Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const Subscriptions = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [currentPlan, setCurrentPlan] = useState<any>(null);

    const plans = [
        {
            id: "free",
            name: "RideEasy Free",
            price: "₹0",
            duration: "Lifetime",
            features: ["Standard Booking", "24/7 Support", "Ride History"],
            color: "bg-muted",
            discount: 0
        },
        {
            id: "silver",
            name: "RideEasy Silver",
            price: "₹199",
            duration: "Per Month",
            features: ["10% Discount on all rides", "Priority Booking", "No Peak Hour Surcharge"],
            color: "bg-slate-200 text-slate-700",
            icon: Zap,
            discount: 10
        },
        {
            id: "gold",
            name: "RideEasy Gold",
            price: "₹499",
            duration: "Per Month",
            features: ["20% Discount on all rides", "VIP Dedicated Support", "Ride Protection Insurance"],
            color: "bg-yellow-100 text-yellow-700",
            icon: Star,
            discount: 20
        },
        {
            id: "platinum",
            name: "RideEasy Platinum",
            price: "₹999",
            duration: "Per Year",
            features: ["25% Discount on all rides", "Free Airport Transfers (2/mo)", "Premium Luxury Fleet Access"],
            color: "bg-primary/10 text-primary",
            icon: Shield,
            discount: 25
        }
    ];

    useEffect(() => {
        if (user) {
            fetchSubscription();
        }
    }, [user]);

    const fetchSubscription = async () => {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user?.id)
            .eq('status', 'active')
            .single();
        
        if (data) setCurrentPlan(data);
    };

    const handleSubscribe = async (planId: string) => {
        if (!user) {
            toast.error("Please login to subscribe");
            return;
        }

        setLoading(true);
        try {
            // In a real app, this would trigger Razorpay
            // Here we simulate successful payment and update DB
            
            // 1. Deactivate old subscription if any
            await supabase
                .from('subscriptions')
                .update({ status: 'expired' })
                .eq('user_id', user.id);

            // 2. Create new subscription
            const { error } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    plan_type: planId,
                    status: 'active',
                    start_date: new Date().toISOString(),
                });

            if (error) throw error;

            toast.success(`Successfully subscribed to ${planId.toUpperCase()}!`);
            fetchSubscription();
            
        } catch (error: any) {
            toast.error(error.message || "Subscription failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="bg-card border-b border-border/50 px-4 py-4 sticky top-0 z-50">
                <div className="flex items-center space-x-4 max-w-2xl mx-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/home")}
                        className="rounded-xl"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-black tracking-tight uppercase">Subscription Tiers</h1>
                </div>
            </div>

            <div className="p-4 space-y-6 max-w-2xl mx-auto">
                <Card className="p-6 bg-primary text-primary-foreground border-0 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Your Active Plan</p>
                        <h2 className="text-3xl font-black uppercase tracking-tight">
                            {currentPlan ? `RideEasy ${currentPlan.plan_type}` : "Standard User"}
                        </h2>
                        {currentPlan && (
                             <p className="text-sm mt-4 font-medium opacity-90">
                             Enjoying your premium benefits!
                         </p>
                        )}
                    </div>
                    <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </Card>

                <div className="grid gap-4">
                    {plans.map((plan) => (
                        <Card key={plan.id} className={`p-5 transition-all duration-300 border-2 ${currentPlan?.plan_type === plan.id ? 'border-primary shadow-lg ring-1 ring-primary' : 'border-border/50 hover:border-primary/50'}`}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                        <h3 className="font-black text-xl tracking-tight uppercase">{plan.name}</h3>
                                        {currentPlan?.plan_type === plan.id && (
                                            <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-black">Active</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-baseline space-x-1">
                                        <span className="text-2xl font-black">{plan.price}</span>
                                        <span className="text-xs text-muted-foreground font-bold uppercase">{plan.duration}</span>
                                    </div>
                                </div>
                                {plan.icon && <div className={`p-2 rounded-xl ${plan.color}`}><plan.icon className="w-6 h-6" /></div>}
                            </div>

                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-start space-x-3 text-sm font-medium">
                                        <div className="mt-1 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                            <Check className="w-3 h-3 text-primary" />
                                        </div>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Button 
                                className={`w-full h-12 text-sm font-black uppercase tracking-widest ${currentPlan?.plan_type === plan.id ? 'bg-muted text-muted-foreground cursor-default hover:bg-muted' : 'btn-taxi'}`}
                                disabled={loading || currentPlan?.plan_type === plan.id}
                                onClick={() => handleSubscribe(plan.id)}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : currentPlan?.plan_type === plan.id ? "Already Active" : "Upgrade Plan"}
                            </Button>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Subscriptions;
