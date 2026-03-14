import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CreditCard, Lock, Smartphone, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { initializeRazorpayPayment } from "@/utils/razorpay";

const Payment = () => {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi">("card");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the unpaid ride amount
    const fetchUnpaidRide = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('customer_id', user.id)
        .eq('payment_status', 'pending')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setAmount(data.fare_amount || 0);
        setCurrentRideId(data.id);
      }
    };

    fetchUnpaidRide();
  }, [user]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRideId || amount <= 0) {
      toast.error("No active ride found to pay for.");
      return;
    }

    setLoading(true);

    try {
      await initializeRazorpayPayment({
        amount: amount,
        name: "RideEasy Payments",
        description: `Payment for Ride #${currentRideId.slice(0, 8)}`,
        userEmail: user?.email,
        userName: user?.user_metadata?.full_name || "Valued Customer",
        onSuccess: async (response) => {
          const transactionId = response.razorpay_payment_id;
          
          try {
            // UPDATE DATABASE - Only Mark as Paid, DON'T force completion
            const { error } = await supabase
              .from('rides')
              .update({
                payment_status: 'paid'
              })
              .eq('id', currentRideId);

            if (error) throw error;

            toast.success(`Payment Successful! Transaction ID: ${transactionId}`);
            // Redirect to Ride Details for Live Tracking
            navigate(`/ride-details?id=${currentRideId}&track=true`);
          } catch (dbError) {
            console.error(dbError);
            toast.error("Payment was successful but failed to update status. Please contact support.");
          } finally {
            setLoading(false);
          }
        },
        onFailure: (error) => {
          console.error("Razorpay Error:", error);
          toast.error("Payment failed or cancelled. Please try again.");
          setLoading(false);
        }
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Could not initialize payment. Please try again.");
      setLoading(false);
    }
  };

  if (amount === 0 && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Pending Payments</h2>
          <p className="text-muted-foreground mb-4">You have no rides pending payment.</p>
          <Button onClick={() => navigate('/home')} className="btn-taxi">Return Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/ride-details?id=" + currentRideId)}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Payment</h1>
            <p className="text-sm text-muted-foreground">Secure Checkout</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        {/* Amount Card */}
        <Card className="card-taxi overflow-hidden relative">
          <div className="absolute top-0 right-0 p-2">
            <div className="bg-primary/20 text-primary-foreground px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Test Mode</div>
          </div>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-1 uppercase text-xs font-semibold tracking-widest">Total to Pay</p>
            <h2 className="text-5xl font-bold text-primary">₹{amount}</h2>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="card-taxi p-4 space-y-4 animate-slide-up">
           <div className="flex items-center space-x-4 p-2 bg-muted/30 rounded-lg">
              <div className="bg-primary/10 p-2 rounded-full">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Safe & Secure</p>
                <p className="text-xs text-muted-foreground">Powered by Razorpay</p>
              </div>
           </div>

           <div className="space-y-3 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Name</span>
                <span className="font-medium">RideEasy Booking</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Booking ID</span>
                <span className="font-mono text-xs">{currentRideId?.slice(0, 12)}...</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex justify-between font-semibold">
                <span>Grand Total</span>
                <span>₹{amount}</span>
              </div>
           </div>
        </Card>

        {/* Action Button */}
        <div className="space-y-4">
          <Button
            onClick={handlePayment}
            className="btn-taxi w-full h-14 text-lg font-semibold shadow-lg shadow-primary/20"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="animate-spin w-5 h-5" />
                <span>Processing...</span>
              </div>
            ) : (
              `Pay Now with Razorpay`
            )}
          </Button>
          
          <div className="flex items-center justify-center space-x-4 opacity-50">
            <CreditCard className="w-5 h-5" />
            <Smartphone className="w-5 h-5" />
            <span className="text-xs font-medium">Cards, UPI, Netbanking & more</span>
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-xl flex items-start space-x-3 text-xs text-muted-foreground border border-border/50">
          <Lock className="w-4 h-4 mt-0.5 text-primary" />
          <p>
            Your payment information is processed by Razorpay. We do not store any of your sensitive financial details on our servers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Payment;