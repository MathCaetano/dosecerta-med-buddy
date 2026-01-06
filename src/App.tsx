import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { FeedbackProvider } from "./contexts/FeedbackContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Medicamentos from "./pages/Medicamentos";
import AddMedication from "./pages/AddMedication";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <FeedbackProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/medicamentos" element={<Layout><Medicamentos /></Layout>} />
            <Route path="/add-medication" element={<Layout><AddMedication /></Layout>} />
            <Route path="/history" element={<Layout><History /></Layout>} />
            <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </FeedbackProvider>
  </QueryClientProvider>
);

export default App;
