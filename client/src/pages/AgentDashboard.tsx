import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Users, Percent, Activity, Banknote } from "lucide-react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function AgentDashboard() {
  useRequireAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData, isLoading: monthlyLoading } = trpc.dashboard.monthlyEarnings.useQuery();
  const { data: statusData, isLoading: statusLoading } = trpc.dashboard.referralsByStatus.useQuery();
  const { data: referrals, isLoading: referralsLoading } = trpc.dashboard.referrals.useQuery();

  if (statsLoading || monthlyLoading || statusLoading || referralsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка дашборда...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount / 100); // convert from kopecks
  };

  const recentReferrals = referrals?.slice(0, 5) || [];

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    contacted: '#3b82f6',
    scheduled: '#8b5cf6',
    completed: '#10b981',
    cancelled: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Ожидание',
    contacted: 'Контакт',
    scheduled: 'Записан',
    completed: 'Завершено',
    cancelled: 'Отменено',
  };

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
        <div className="container">
          <h1 className="text-4xl font-bold mb-2">Личный кабинет агента</h1>
          <p className="text-primary-foreground/80">Добро пожаловать в вашу панель управления</p>
        </div>
      </div>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Всего заработано
              </CardTitle>
              <Banknote className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(stats?.totalEarnings || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                За все время
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Активные рекомендации
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {stats?.activeReferrals || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                В процессе обработки
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Конверсия
              </CardTitle>
              <Percent className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {stats?.conversionRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Успешных сделок
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                За этот месяц
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(stats?.thisMonthEarnings || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Текущий период
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Earnings Chart */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Заработок по месяцам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `${value.toLocaleString()} ₽`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString()} ₽`, 'Заработок']}
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Referrals by Status Chart */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Рекомендации по статусам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="status" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Количество']}
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Referrals Table */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Последние рекомендации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm">Пациент</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Дата</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Клиника</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Статус</th>
                    <th className="text-right py-3 px-4 font-semibold text-sm">Вознаграждение</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        Пока нет рекомендаций
                      </td>
                    </tr>
                  ) : (
                    recentReferrals.map((referral: any) => (
                      <tr key={referral.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">{referral.patientFullName}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(referral.createdAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="py-3 px-4 text-sm">{referral.clinic || '—'}</td>
                        <td className="py-3 px-4">
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${statusColors[referral.status]}20`,
                              color: statusColors[referral.status],
                            }}
                          >
                            {statusLabels[referral.status]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">
                          {referral.commissionAmount > 0 
                            ? formatCurrency(referral.commissionAmount)
                            : '—'
                          }
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayoutWrapper>
  );
}
