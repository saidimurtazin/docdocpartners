import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Percent, Activity, Banknote, Gift, Plus, MessageSquare, CreditCard, UserPlus, Send, Check, ArrowRight, X, Copy } from "lucide-react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import CreateReferralDialog from "@/components/CreateReferralDialog";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { referralStatusLabels, referralStatusHexColors, formatCurrency } from "@/lib/referral-utils";

export default function AgentDashboard() {
  useRequireAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData, isLoading: monthlyLoading } = trpc.dashboard.monthlyEarnings.useQuery();
  const { data: statusData, isLoading: statusLoading } = trpc.dashboard.referralsByStatus.useQuery();
  const { data: referralsData, isLoading: referralsLoading, refetch: refetchReferrals } = trpc.dashboard.referrals.useQuery(
    { page: 1, pageSize: 5 }
  );

  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    return localStorage.getItem("onboarding_dismissed") === "true";
  });
  const [referralLinkCopied, setReferralLinkCopied] = useState(false);

  if (statsLoading || monthlyLoading || statusLoading || referralsLoading) {
    return (
      <DashboardLayoutWrapper>
        <div className="min-h-screen bg-muted/30">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
            <div className="container">
              <Skeleton className="h-10 w-72 bg-white/20 mb-2" />
              <Skeleton className="h-5 w-96 bg-white/10" />
            </div>
          </div>
          <div className="container py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-5 rounded" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-9 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="border-2">
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-[300px] w-full rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  // Extract items from paginated response (always { items, total })
  const recentReferrals = referralsData?.items || [];

  // Filter out zero-count statuses for the chart
  const chartStatusData = (statusData || []).filter((d: any) => d.count > 0);

  // Onboarding logic
  const firstName = stats?.agentFullName?.split(' ')[1] || stats?.agentFullName?.split(' ')[0] || '';
  const onboardingSteps = [
    {
      id: 'telegram',
      icon: MessageSquare,
      title: 'Подключите Telegram-бот',
      description: 'Получайте уведомления о статусах пациентов и отправляйте рекомендации прямо из Telegram',
      completed: !!stats?.hasTelegram,
      action: () => window.open('https://t.me/docpartnerbot', '_blank'),
      actionLabel: 'Открыть бот',
    },
    {
      id: 'requisites',
      icon: CreditCard,
      title: 'Настройте реквизиты',
      description: 'Укажите ИНН и данные карты для получения выплат за успешные рекомендации',
      completed: !!stats?.hasRequisites,
      action: () => navigate('/dashboard/profile'),
      actionLabel: 'Настроить',
    },
    {
      id: 'first_referral',
      icon: Send,
      title: 'Отправьте первого пациента',
      description: 'Создайте вашу первую рекомендацию и начните зарабатывать до 10% от суммы лечения',
      completed: (stats?.totalReferrals ?? 0) > 0,
      action: () => setDialogOpen(true),
      actionLabel: 'Отправить',
    },
    {
      id: 'invite',
      icon: UserPlus,
      title: 'Пригласите коллегу',
      description: 'Поделитесь реферальной ссылкой и получите 1 000 руб. бонус за каждого нового агента',
      completed: (stats?.referredAgentsCount ?? 0) > 0,
      action: () => {
        if (stats?.referralLink) {
          navigator.clipboard.writeText(stats.referralLink);
          setReferralLinkCopied(true);
          setTimeout(() => setReferralLinkCopied(false), 2000);
        }
      },
      actionLabel: referralLinkCopied ? 'Скопировано!' : 'Скопировать ссылку',
    },
  ];

  const completedSteps = onboardingSteps.filter(s => s.completed).length;
  const allStepsDone = completedSteps === onboardingSteps.length;
  const showOnboarding = !onboardingDismissed && !allStepsDone && (stats?.totalReferrals ?? 0) < 3;

  const handleDismissOnboarding = () => {
    localStorage.setItem("onboarding_dismissed", "true");
    setOnboardingDismissed(true);
  };

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Личный кабинет агента</h1>
              <p className="text-primary-foreground/80">Добро пожаловать в вашу панель управления</p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="gap-2 hidden sm:flex"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-5 h-5" />
              Отправить пациента
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile floating button */}
      <div className="sm:hidden fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Shared Create Referral Dialog */}
      <CreateReferralDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => refetchReferrals()}
      />

      <div className="container py-8">
        {/* Onboarding Welcome */}
        {showOnboarding && (
          <div className="mb-8">
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-orange-50/50 overflow-hidden relative">
              {/* Dismiss button */}
              <button
                onClick={handleDismissOnboarding}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
                title="Пропустить настройку"
              >
                <X className="w-5 h-5" />
              </button>

              <CardContent className="pt-8 pb-8 px-6 md:px-10">
                {/* Welcome heading */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    {firstName ? `${firstName}, добро пожаловать!` : 'Добро пожаловать!'}
                  </h2>
                  <p className="text-muted-foreground text-lg">
                    Выполните несколько шагов, чтобы начать зарабатывать
                  </p>
                </div>

                {/* Progress bar */}
                <div className="max-w-md mx-auto mb-8">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Прогресс настройки</span>
                    <span className="font-semibold text-primary">{completedSteps} из {onboardingSteps.length}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-[#F97316] rounded-full transition-all duration-500"
                      style={{ width: `${(completedSteps / onboardingSteps.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Steps grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                  {onboardingSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`
                        relative rounded-xl border-2 p-5 transition-all
                        ${step.completed
                          ? 'border-green-200 bg-green-50/50'
                          : 'border-border bg-card hover:border-primary/30 hover:shadow-md cursor-pointer'
                        }
                      `}
                      onClick={() => !step.completed && step.action()}
                    >
                      <div className="flex items-start gap-4">
                        {/* Step number / check */}
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                          ${step.completed
                            ? 'bg-green-500 text-white'
                            : 'bg-primary/10 text-primary'
                          }
                        `}>
                          {step.completed
                            ? <Check className="w-5 h-5" />
                            : <step.icon className="w-5 h-5" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold text-sm ${step.completed ? 'text-green-700' : ''}`}>
                              {step.title}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                            {step.description}
                          </p>

                          {!step.completed && (
                            <Button
                              size="sm"
                              variant={index === completedSteps ? "default" : "outline"}
                              className="gap-1.5 text-xs h-8"
                              onClick={(e) => { e.stopPropagation(); step.action(); }}
                            >
                              {step.actionLabel}
                              {step.id === 'invite' ? <Copy className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                            </Button>
                          )}

                          {step.completed && (
                            <span className="text-xs text-green-600 font-medium">Готово</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Skip link */}
                <div className="text-center mt-6">
                  <button
                    onClick={handleDismissOnboarding}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                  >
                    Пропустить настройку
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Regular Dashboard Content (shown when onboarding is dismissed or complete) */}
        {!showOnboarding && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="border-2 hover:border-primary/50 transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Доступно к выводу
                  </CardTitle>
                  <Banknote className="w-5 h-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {formatCurrency(stats?.availableBalance ?? stats?.totalEarnings ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Всего заработано: {formatCurrency(stats?.totalEarnings ?? 0)}
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
                    {stats?.activeReferrals ?? 0}
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
                    {stats?.conversionRate ?? 0}%
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
                    {formatCurrency(stats?.thisMonthEarnings ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Текущий период
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Referral Bonus Card */}
            {stats && (stats.bonusPoints ?? 0) > 0 && (
              <Card className="border-2 border-amber-200 bg-amber-50/50 mb-8">
                <CardContent className="flex items-center gap-4 py-4">
                  <Gift className="w-8 h-8 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-amber-900">
                      Реферальный бонус: {formatCurrency(stats.bonusPoints ?? 0)}
                    </div>
                    <div className="text-sm text-amber-700">
                      {(stats.paidReferralCount ?? 0) >= (stats.bonusUnlockThreshold ?? 10)
                        ? "Бонус будет автоматически добавлен к балансу"
                        : `Разблокируется после ${(stats.bonusUnlockThreshold ?? 10) - (stats.paidReferralCount ?? 0)} оплаченных пациентов (сейчас ${stats.paidReferralCount ?? 0}/${stats.bonusUnlockThreshold ?? 10})`
                      }
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-amber-600">
                      {stats.paidReferralCount ?? 0}/{stats.bonusUnlockThreshold ?? 10}
                    </div>
                    <div className="text-xs text-amber-600">пациентов</div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                        tickFormatter={(value) => `${value.toLocaleString()} \u20BD`}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString()} \u20BD`, 'Заработок']}
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

              {/* Referrals by Status Chart — fixed label display */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Рекомендации по статусам
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartStatusData} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="status"
                        stroke="#6b7280"
                        style={{ fontSize: '11px' }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={70}
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
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Последние рекомендации
                  </CardTitle>
                  <Link href="/dashboard/referrals">
                    <Button variant="ghost" size="sm" className="gap-1 text-primary">
                      Смотреть все
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
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
                            <td className="py-3 px-4 text-sm">{referral.clinic || '\u2014'}</td>
                            <td className="py-3 px-4">
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${referralStatusHexColors[referral.status] || '#6b7280'}20`,
                                  color: referralStatusHexColors[referral.status] || '#6b7280',
                                }}
                              >
                                {referralStatusLabels[referral.status] || referral.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold">
                              {referral.commissionAmount > 0
                                ? formatCurrency(referral.commissionAmount)
                                : '\u2014'
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
          </>
        )}
      </div>
      </div>
    </DashboardLayoutWrapper>
  );
}
