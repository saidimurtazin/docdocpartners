import { Link, useLocation } from "wouter";
import {
  Home, Users, FileText, Wallet, Building2, LogOut, Menu, X,
  BarChart3, Mail, Settings, ClipboardList, UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { ReactNode, useState, useMemo } from "react";

interface AdminLayoutWrapperProps {
  children: ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  support: "Поддержка",
  accountant: "Бухгалтер",
};

export default function AdminLayoutWrapper({ children }: AdminLayoutWrapperProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allMenuItems = [
    { path: "/admin", label: "Дашборд", icon: BarChart3, roles: ["admin", "support", "accountant"] },
    { path: "/admin/agents", label: "Агенты", icon: Users, roles: ["admin", "support"] },
    { path: "/admin/referrals", label: "Рекомендации", icon: FileText, roles: ["admin", "support"] },
    { path: "/admin/payments", label: "Выплаты", icon: Wallet, roles: ["admin", "accountant"] },
    { path: "/admin/clinics", label: "Клиники", icon: Building2, roles: ["admin"] },
    { path: "/admin/clinic-reports", label: "Отчёты клиник", icon: Mail, roles: ["admin", "support"] },
    { path: "/admin/tasks", label: "Задачи", icon: ClipboardList, roles: ["admin", "support"] },
    { path: "/admin/staff", label: "Сотрудники", icon: UserCog, roles: ["admin"] },
    { path: "/admin/settings", label: "Настройки", icon: Settings, roles: ["admin"] },
  ];

  const menuItems = useMemo(() => {
    const role = user?.role;
    if (!role) return [];
    return allMenuItems.filter(item => item.roles.includes(role));
  }, [user?.role]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 lg:z-auto
        w-64 border-r border-border bg-card min-h-screen flex flex-col
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link href="/admin">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png"
                alt="DocPartner Logo"
                className="w-10 h-10 rounded-lg"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-sm">DocDoc</span>
                <span className="font-bold text-sm text-primary">Admin</span>
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
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            {ROLE_LABELS[user?.role ?? ""] || "Сотрудник"}
          </div>
          <div className="font-semibold mt-1 text-sm">{user?.name || "Загрузка..."}</div>
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
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-1">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-3 text-sm">
              <Home className="w-4 h-4" />
              На главную
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm">DocPartner Admin</span>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
