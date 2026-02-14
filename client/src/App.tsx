import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminAgents from "./pages/admin/Agents";
import AdminReferrals from "./pages/admin/Referrals";
import AdminPayments from "./pages/admin/Payments";
import AdminDoctors from "./pages/admin/Doctors";
import AgentCabinet from "./pages/AgentCabinet";
import KnowledgeBase from "./pages/KnowledgeBase";
import Clinics from "./pages/Clinics";
import AgentSessions from "./pages/AgentSessions";
import AgentDashboard from "./pages/AgentDashboard";
import AgentProfile from "./pages/AgentProfile";
import AgentPayments from "./pages/AgentPayments";
import AgentReferrals from "./pages/AgentReferrals";
import Login from "./pages/Login";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/agents"} component={AdminAgents} />
      <Route path={"/admin/referrals"} component={AdminReferrals} />
      <Route path={"/admin/payments"} component={AdminPayments} />
      <Route path={"/admin/doctors"} component={AdminDoctors} />
      <Route path={"/agent/cabinet"} component={AgentCabinet} />
      <Route path={"/agent/sessions"} component={AgentSessions} />
      <Route path={"/login"} component={Login} />
      <Route path={"/dashboard"} component={AgentDashboard} />
      <Route path={"/dashboard/profile"} component={AgentProfile} />
      <Route path={"/dashboard/payments"} component={AgentPayments} />
      <Route path={"/dashboard/referrals"} component={AgentReferrals} />
      <Route path={"/knowledge-base"} component={KnowledgeBase} />
      <Route path={"/clinics"} component={Clinics} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
