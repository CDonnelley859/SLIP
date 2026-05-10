import { Component, ReactNode } from "react";
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
import Lobby from "./pages/Lobby";
import Slip from "./pages/Slip";
import Spindle from "./pages/Spindle";
import Stats from "./pages/Stats";
import JoinViaLink from "./pages/JoinViaLink";
import HostResults from "./pages/HostResults";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", color: "#1a1410", background: "#f5e8df", minHeight: "100vh" }}>
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>Something went wrong</h1>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.7 }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 24, padding: "10px 20px", border: "2px solid #1a1410", background: "transparent", cursor: "pointer", fontWeight: 700 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppRoutes = () => {
  const { hasHandle, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f5e8df", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Loading…
      </span>
    </div>
  );
  if (!hasHandle) return <NamePrompt />;
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/scrum/new" element={<NewScrum />} />
      <Route path="/scrum/join" element={<JoinScrum />} />
      <Route path="/scrum/:id/lobby" element={<Lobby />} />
      <Route path="/scrum/:id/gallop" element={<Gallop />} />
      <Route path="/scrum/:id/slip" element={<Slip />} />
      <Route path="/scrum/:id/host-results" element={<HostResults />} />
      <Route path="/spindle" element={<Spindle />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/join/:code" element={<JoinViaLink />} />
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
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
