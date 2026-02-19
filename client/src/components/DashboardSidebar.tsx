import { Link, useLocation } from "wouter";
import { Home, Users, Wallet, User as UserIcon, LogOut, Building2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";

export default function DashboardSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: "/dashboard", label: "Главная", icon: Home },
    { path: "/dashboard/referrals", label: "Рекомендации", icon: Users },
    { path: "/dashboard/payments", label: "Выплаты", icon: Wallet },
    { path: "/dashboard/clinics", label: "Клиники", icon: Building2 },
    { path: "/dashboard/profile", label: "Профиль", icon: UserIcon },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <span className="font-semibold text-sm">DocPartner</span>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 lg:z-auto
        w-64 border-r border-border bg-card min-h-screen flex flex-col
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png"
                alt="DocPartner Logo"
                className="w-10 h-10 rounded-lg"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-sm">DocDoc</span>
                <span className="font-bold text-sm">Partner</span>
              </div>
            </div>
          </Link>
          <Button
            variant="ghost" size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Агент</div>
          <div className="font-semibold mt-1 text-sm">{user?.name || "Загрузка..."}</div>
          <div className="text-xs text-muted-foreground mt-1">{user?.email}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;

              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`w-full justify-start gap-3 ${
                      isActive
                        ? "bg-[oklch(0.35_0.08_250)] text-white hover:bg-[oklch(0.35_0.08_250)]/90"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => logout()}
          >
            <LogOut className="w-5 h-5" />
            Выйти
          </Button>
        </div>
      </aside>
    </>
  );
}
