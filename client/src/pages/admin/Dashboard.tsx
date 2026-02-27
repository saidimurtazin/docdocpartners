import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, FileText, Wallet, TrendingUp, Calendar, Building2, Award, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Check if user is admin
  const { data: adminCheck, isLoading: checkingAdmin, error: adminError } = trpc.admin.checkAdmin.useQuery(
    undefined,
    {
      retry: false,
      enabled: !authLoading, // Only run when auth is loaded
    }
  );

  // Get statistics
  const { data: stats, isLoading: loadingStats, error: statsError } = trpc.admin.statistics.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    retry: 1,
  });

  // Get all referrals for charts
  const { data: allReferrals, isLoading: loadingReferrals, error: referralsError } = trpc.admin.referrals.list.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    retry: 1,
  });

  // Get all agents for top performers
  const { data: allAgents, isLoading: loadingAgents, error: agentsError } = trpc.admin.agents.list.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    retry: 1,
  });

  // Calculate referrals by status
  const referralsByStatus = useMemo(() => {
    if (!allReferrals) return [];
    
    const statusCounts: Record<string, number> = {
      new: 0, in_progress: 0, contacted: 0, scheduled: 0,
      visited: 0, duplicate: 0, no_answer: 0, cancelled: 0,
    };

    allReferrals.forEach((ref: any) => {
      statusCounts[ref.status] = (statusCounts[ref.status] || 0) + 1;
    });

    return [
      { status: "🆕 Новая", count: statusCounts.new, color: "bg-yellow-500" },
      { status: "⚙️ В работе", count: statusCounts.in_progress, color: "bg-blue-400" },
      { status: "📞 Связались", count: statusCounts.contacted, color: "bg-blue-500" },
      { status: "📅 Записан", count: statusCounts.scheduled, color: "bg-purple-500" },
      { status: "✅ Приём", count: statusCounts.visited, color: "bg-emerald-500" },
      { status: "🔁 Дубликат", count: statusCounts.duplicate, color: "bg-gray-400" },
      { status: "📵 Нет ответа", count: statusCounts.no_answer, color: "bg-orange-500" },
      { status: "❌ Отменена", count: statusCounts.cancelled, color: "bg-red-500" },
    ];
  }, [allReferrals]);

  // Calculate referrals by clinic
  const referralsByClinic = useMemo(() => {
    if (!allReferrals) return [];
    
    const clinicCounts: Record<string, { count: number; completed: number; revenue: number }> = {};

    allReferrals.forEach((ref: any) => {
      if (!ref.clinic) return;
      
      if (!clinicCounts[ref.clinic]) {
        clinicCounts[ref.clinic] = { count: 0, completed: 0, revenue: 0 };
      }
      
      clinicCounts[ref.clinic].count++;
      if (ref.status === "visited") {
        clinicCounts[ref.clinic].completed++;
        clinicCounts[ref.clinic].revenue += ref.treatmentAmount || 0;
      }
    });

    return Object.entries(clinicCounts)
      .map(([clinic, data]) => ({
        clinic,
        count: data.count,
        completed: data.completed,
        revenue: data.revenue,
        conversion: data.count > 0 ? Math.round((data.completed / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [allReferrals]);

  // Calculate top agents
  const topAgents = useMemo(() => {
    if (!allAgents) return [];
    
    return [...allAgents]
      .sort((a: any, b: any) => (b.totalEarnings || 0) - (a.totalEarnings || 0))
      .slice(0, 5);
  }, [allAgents]);

  // Calculate recent activity (last 30 days)
  const recentActivity = useMemo(() => {
    if (!allReferrals) return [];
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyCounts: Record<string, number> = {};
    
    allReferrals.forEach((ref: any) => {
      const date = new Date(ref.createdAt);
      if (date >= thirtyDaysAgo) {
        const dateKey = date.toISOString().split('T')[0];
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      }
    });

    // Fill in missing dates
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        count: dailyCounts[dateKey] || 0,
      });
    }

    return result;
  }, [allReferrals]);

  const maxActivity = Math.max(...recentActivity.map(d => d.count), 1);

  // Redirect non-admin roles to their first available page
  if (user && user.role === "support") {
    setLocation("/admin/agents");
    return null;
  }
  if (user && user.role === "accountant") {
    setLocation("/admin/payments");
    return null;
  }

  // Redirect if not admin
  if (adminError) {
    setLocation("/");
    return null;
  }

  if (authLoading || checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || !["admin", "support", "accountant"].includes(user.role)) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(amount / 100);
  };

  return (
    <AdminLayoutWrapper>
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-8">
        {/* Error Banner */}
        {(statsError || referralsError || agentsError) && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Ошибка загрузки данных</p>
                <p className="text-sm text-muted-foreground">
                  {statsError?.message || referralsError?.message || agentsError?.message || "Не удалось загрузить данные. Попробуйте обновить страницу."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего агентов</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "..." : stats?.totalAgents || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Активных: {loadingStats ? "..." : stats?.activeAgents || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Рекомендации</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "..." : stats?.totalReferrals || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Завершено: {loadingStats ? "..." : stats?.completedReferrals || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Выплачено</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "..." : formatCurrency(stats?.totalPaymentsAmount || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Ожидает: {loadingStats ? "..." : formatCurrency(stats?.pendingPaymentsAmount || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Конверсия</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats
                  ? "..."
                  : stats && stats.totalReferrals > 0
                  ? `${Math.round((stats.completedReferrals / stats.totalReferrals) * 100)}%`
                  : "0%"}
              </div>
              <p className="text-xs text-muted-foreground">Завершённых рекомендаций</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Referrals by Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Рекомендации по статусам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReferrals ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {referralsByStatus.map((item) => (
                    <div key={item.status} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.status}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} transition-all`}
                          style={{
                            width: `${stats?.totalReferrals ? (item.count / stats.totalReferrals) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referrals by Clinic */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Статистика по клиникам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReferrals ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {referralsByClinic.map((item) => (
                    <div key={item.clinic} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.clinic}</span>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span>{item.count} реком.</span>
                          <span className="text-green-600">{item.conversion}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Выручка: {formatCurrency(item.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Активность за последние 30 дней
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReferrals ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-end justify-between h-48 gap-1">
                    {recentActivity.map((day, index) => (
                      <div
                        key={day.date}
                        className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t relative group"
                        style={{
                          height: `${(day.count / maxActivity) * 100}%`,
                          minHeight: day.count > 0 ? '4px' : '0',
                        }}
                        title={`${day.date}: ${day.count} рекомендаций`}
                      >
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {new Date(day.date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}: {day.count}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                    <span>30 дней назад</span>
                    <span>Сегодня</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Agents */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Топ агентов по заработку
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {topAgents.map((agent: any, index: number) => (
                    <div key={agent.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{agent.fullName}</div>
                          <div className="text-sm text-muted-foreground">
                            {agent.totalReferrals} рекомендаций
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          {formatCurrency(agent.totalEarnings || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {agent.city || 'Не указан город'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {topAgents.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      Нет данных об агентах
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
    </AdminLayoutWrapper>
  );
}
