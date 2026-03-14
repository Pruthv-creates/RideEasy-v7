import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Car, Smartphone, Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"customer" | "driver">("customer");
  const [useOtp, setUseOtp] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSendOtp = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: !isLogin,
        }
      });
      if (error) throw error;
      setShowOtpInput(true);
      toast.success("OTP sent to your email!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      // Use 'email' type for standard 6-digit OTP codes
      const { data: { user }, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email', 
      });

      if (error) throw error;
      if (!user) throw new Error("Verification failed - No user found");

      if (!isLogin) {
        // Create profile for New User
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email,
            full_name: fullName,
            phone_number: phone,
            role,
          });
        if (profileError) console.error("Profile error:", profileError);
      }

      toast.success("Authenticated successfully!");
      navigate("/home");
    } catch (error: any) {
      toast.error(error.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (useOtp) {
      if (showOtpInput) handleVerifyOtp();
      else handleSendOtp();
      return;
    }
    
    setLoading(true);
    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/home");
      } else {
        // SIGNUP
        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
        if (!user) throw new Error("No user created");

        // Insert into profiles
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email,
            full_name: fullName,
            phone_number: phone,
            role,
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          toast.error("Account created but profile setup failed.");
        } else {
          toast.success("Account created successfully!");
          navigate("/home");
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8 animate-scale-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-primary to-primary-hover rounded-2xl mb-4 shadow-[var(--shadow-button)]">
            <Car className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">RideEasy</h1>
          <p className="text-muted-foreground">Your reliable ride partner</p>
        </div>

        <Card className="card-taxi animate-slide-up p-6">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold">
                {isLogin ? "Welcome Back" : "Get Started"}
              </h2>
              <p className="text-muted-foreground">
                {isLogin ? "Sign in to continue" : "Create your account"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullname">Full Name</Label>
                    <Input
                      id="fullname"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-12 rounded-xl border-2 focus:border-primary"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-2 focus:border-primary"
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-12 rounded-xl border-2 focus:border-primary"
                  />
                </div>
              )}

              <div className="flex items-center justify-between py-2">
                <p className="text-sm text-muted-foreground mr-2">Use OTP instead?</p>
                <button 
                  type="button"
                  onClick={() => { setUseOtp(!useOtp); setShowOtpInput(false); }}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  {useOtp ? "Use Password" : "Login with OTP"}
                </button>
              </div>

              {!useOtp ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl border-2 focus:border-primary"
                  />
                </div>
              ) : showOtpInput && (
                <div className="space-y-2 animate-scale-in">
                  <Label htmlFor="otp">Enter 6-digit OTP</Label>
                  <Input
                    id="otp"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    required
                    className="h-12 rounded-xl border-2 border-primary bg-primary/5 text-center text-2xl tracking-[10px] font-black"
                  />
                  <p className="text-[10px] text-center text-muted-foreground uppercase font-bold">Check your email for the code</p>
                </div>
              )}

              {!isLogin && (
                <div className="space-y-3 pt-2">
                  <Label>I want to join as a:</Label>
                  <RadioGroup defaultValue="customer" onValueChange={(v) => setRole(v as "customer" | "driver")} className="flex space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="customer" id="r-customer" />
                      <Label htmlFor="r-customer">Customer</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="driver" id="r-driver" />
                      <Label htmlFor="r-driver">Driver</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <Button
                type="submit"
                className="btn-taxi w-full h-12 text-lg mt-4"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : useOtp ? (
                  showOtpInput ? "Verify OTP" : "Send OTP"
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                type="button"
                className="text-primary font-medium hover:underline transition-[var(--transition-smooth)]"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"
                }
              </button>
            </div>
          </div>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 animate-fade-in">
          <div className="text-center">
            <div className="w-12 h-12 bg-taxi-yellow-light rounded-xl flex items-center justify-center mx-auto mb-2">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Easy Booking</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-taxi-yellow-light rounded-xl flex items-center justify-center mx-auto mb-2">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Safe & Secure</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-taxi-yellow-light rounded-xl flex items-center justify-center mx-auto mb-2">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">24/7 Service</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;