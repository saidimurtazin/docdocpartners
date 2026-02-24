import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPWABanner } from "@/components/InstallPWABanner";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import Home from "./pages/Home";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminAgents from "./pages/admin/Agents";
import AdminReferrals from "./pages/admin/Referrals";
import AdminPayments from "./pages/admin/Payments";
import AdminDoctors from "./pages/admin/Doctors";
import AdminClinics from "./pages/admin/Clinics";
import AdminClinicReports from "./pages/admin/ClinicReports";
import AdminSettings from "./pages/admin/Settings";
import AdminStaff from "./pages/admin/Staff";
import AdminTasks from "./pages/admin/Tasks";
import AdminNotifications from "./pages/admin/Notifications";
import AgentClinics from "./pages/AgentClinics";
import AdminLogin from "./pages/AdminLogin";
import AgentCabinet from "./pages/AgentCabinet";
import KnowledgeBase from "./pages/KnowledgeBase";
import Clinics from "./pages/Clinics";
import AgentSessions from "./pages/AgentSessions";
import AgentDashboard from "./pages/AgentDashboard";
import AgentProfile from "./pages/AgentProfile";
import AgentPayments from "./pages/AgentPayments";
import AgentReferrals from "./pages/AgentReferrals";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Documents from "./pages/Documents";
import ClinicDashboard from "./pages/clinic/Dashboard";
import ClinicReferrals from "./pages/clinic/Referrals";
import ClinicUpload from "./pages/clinic/Upload";

const STAFF_ROLES = ["admin", "support", "accountant"];

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

/** Route guard: requires staff auth (admin/support/accountant) */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || !STAFF_ROLES.includes(user.role)) return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

/** Route guard: requires clinic auth */
function RequireClinic({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "clinic") return <Redirect to="/login" />;
  return <>{children}</>;
}

/** Route guard: requires agent auth */
function RequireAgent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector("main")?.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      {/* Admin panel routes (/admin/*) — protected by RequireAdmin */}
      <Route path={"/admin/login"} component={AdminLogin} />
      <Route path={"/admin"}>{() => <RequireAdmin><AdminDashboard /></RequireAdmin>}</Route>
      <Route path={"/admin/agents"}>{() => <RequireAdmin><AdminAgents /></RequireAdmin>}</Route>
      <Route path={"/admin/referrals"}>{() => <RequireAdmin><AdminReferrals /></RequireAdmin>}</Route>
      <Route path={"/admin/payments"}>{() => <RequireAdmin><AdminPayments /></RequireAdmin>}</Route>
      <Route path={"/admin/doctors"}>{() => <RequireAdmin><AdminDoctors /></RequireAdmin>}</Route>
      <Route path={"/admin/clinics"}>{() => <RequireAdmin><AdminClinics /></RequireAdmin>}</Route>
      <Route path={"/admin/clinic-reports"}>{() => <RequireAdmin><AdminClinicReports /></RequireAdmin>}</Route>
      <Route path={"/admin/settings"}>{() => <RequireAdmin><AdminSettings /></RequireAdmin>}</Route>
      <Route path={"/admin/staff"}>{() => <RequireAdmin><AdminStaff /></RequireAdmin>}</Route>
      <Route path={"/admin/tasks"}>{() => <RequireAdmin><AdminTasks /></RequireAdmin>}</Route>
      <Route path={"/admin/notifications"}>{() => <RequireAdmin><AdminNotifications /></RequireAdmin>}</Route>

      {/* Clinic dashboard routes — protected by RequireClinic */}
      <Route path={"/clinic"}>{() => <RequireClinic><ClinicDashboard /></RequireClinic>}</Route>
      <Route path={"/clinic/referrals"}>{() => <RequireClinic><ClinicReferrals /></RequireClinic>}</Route>
      <Route path={"/clinic/upload"}>{() => <RequireClinic><ClinicUpload /></RequireClinic>}</Route>

      {/* Public routes */}
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/knowledge-base"} component={KnowledgeBase} />
      <Route path={"/clinics"} component={Clinics} />
      <Route path={"/documents"} component={Documents} />

      {/* Agent dashboard routes — protected by RequireAgent */}
      <Route path={"/dashboard"}>{() => <RequireAgent><AgentDashboard /></RequireAgent>}</Route>
      <Route path={"/dashboard/profile"}>{() => <RequireAgent><AgentProfile /></RequireAgent>}</Route>
      <Route path={"/dashboard/payments"}>{() => <RequireAgent><AgentPayments /></RequireAgent>}</Route>
      <Route path={"/dashboard/referrals"}>{() => <RequireAgent><AgentReferrals /></RequireAgent>}</Route>
      <Route path={"/dashboard/clinics"}>{() => <RequireAgent><AgentClinics /></RequireAgent>}</Route>
      <Route path={"/agent/sessions"}>{() => <RequireAgent><AgentSessions /></RequireAgent>}</Route>

      {/* Telegram WebApp — agent cabinet (uses its own session) */}
      <Route path={"/agent/cabinet"} component={AgentCabinet} />

      <Route path={"/404"} component={NotFound} />
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
          <ScrollToTop />
          <Router />
          <InstallPWABanner />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
