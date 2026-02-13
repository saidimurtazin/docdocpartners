import { Link, useLocation } from "wouter";
import { Home, Users, Wallet, User as UserIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

export default function DashboardSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    { path: "/dashboard", label: "Главная", icon: Home },
    { path: "/dashboard/referrals", label: "Рекомендации", icon: Users },
    { path: "/dashboard/payments", label: "Выплаты", icon: Wallet },
    { path: "/dashboard/profile", label: "Профиль", icon: UserIcon },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png" 
              alt="DocDocPartner Logo" 
              className="w-10 h-10 rounded-lg"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm">DocDoc</span>
              <span className="font-bold text-sm">Partner</span>
            </div>
          </div>
        </Link>
      </div>

      {/* User Info */}
      <div className="p-6 border-b border-border">
        <div className="text-sm text-muted-foreground">Агент</div>
        <div className="font-semibold mt-1">{user?.name || "Загрузка..."}</div>
        <div className="text-xs text-muted-foreground mt-1">{user?.email}</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
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
      <div className="p-4 border-t border-border">
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
  );
}
