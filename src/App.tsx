import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import BookRide from "./pages/BookRide";
import RideDetails from "./pages/RideDetails";
import Payment from "./pages/Payment";
import TripHistory from "./pages/TripHistory";
import NotFound from "./pages/NotFound";
import DriverDashboard from "./pages/DriverDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import TrackRide from "./pages/TrackRide";
import Subscriptions from "./pages/Subscriptions";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/home" element={<Home />} />
            <Route path="/book-ride" element={<BookRide />} />
            <Route path="/ride-details" element={<RideDetails />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/trip-history" element={<TripHistory />} />
            <Route path="/driver-dashboard" element={<DriverDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/track/:rideId" element={<TrackRide />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
