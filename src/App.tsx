import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { NamePrompt } from "@/components/NamePrompt";
import Index from "./pages/Index";
import NewScrum from "./pages/NewScrum";
import JoinScrum from "./pages/JoinScrum";
import Gallop from "./pages/Gallop";
import Slip from "./pages/Slip";
import Spindle from "./pages/Spindle";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { hasHandle, loading } = useAuth();
  if (loading) return null;
  if (!hasHandle) return <NamePrompt />;
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/scrum/new" element={<NewScrum />} />
      <Route path="/scrum/join" element={<JoinScrum />} />
      <Route path="/scrum/:id/gallop" element={<Gallop />} />
      <Route path="/scrum/:id/slip" element={<Slip />} />
      <Route path="/spindle" element={<Spindle />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
