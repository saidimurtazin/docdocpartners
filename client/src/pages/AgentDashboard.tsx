import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Users, Percent, Activity, Banknote, Gift, Plus, MessageSquare, CreditCard, UserPlus, Send, Check, ArrowRight, X, Copy, ExternalLink } from "lucide-react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function AgentDashboard() {
  useRequireAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyData, isLoading: monthlyLoading } = trpc.dashboard.monthlyEarnings.useQuery();
  const { data: statusData, isLoading: statusLoading } = trpc.dashboard.referralsByStatus.useQuery();
  const { data: referrals, isLoading: referralsLoading, refetch: refetchReferrals } = trpc.dashboard.referrals.useQuery();
  const { data: clinicsList } = trpc.dashboard.clinics.useQuery();
  const createReferral = trpc.dashboard.createReferral.useMutation();

  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    return localStorage.getItem("onboarding_dismissed") === "true";
  });
  const [referralLinkCopied, setReferralLinkCopied] = useState(false);

  // Referral form state
  const [formData, setFormData] = useState({
    patientFullName: "",
    patientBirthdate: "",
    patientCity: "",
    patientPhone: "",
    patientEmail: "",
    clinic: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setFormData({
      patientFullName: "",
      patientBirthdate: "",
      patientCity: "",
      patientPhone: "",
      patientEmail: "",
      clinic: "",
      notes: "",
    });
    setFormError("");
  };

  const handleCreateReferral = async () => {
    setFormError("");

    if (!formData.patientFullName.trim()) {
      setFormError("Укажите ФИО пациента");
      return;
    }
    const nameWords = formData.patientFullName.trim().split(/\s+/);
    if (nameWords.length !== 3) {
      setFormError("Укажите Фамилию, Имя и Отчество пациента (ровно 3 слова)");
      return;
    }
    if (!formData.patientBirthdate.trim()) {
      setFormError("Укажите дату рождения");
      return;
    }
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(formData.patientBirthdate)) {
      setFormError("Формат даты: ДД.ММ.ГГГГ (например, 15.03.1985)");
      return;
    }
    const [dd, mm, yyyy] = formData.patientBirthdate.split('.').map(Number);
    const birthDate = new Date(yyyy, mm - 1, dd);
    if (birthDate.getDate() !== dd || birthDate.getMonth() !== mm - 1 || birthDate.getFullYear() !== yyyy) {
      setFormError("Указана несуществующая дата");
      return;
    }
    const ageDiff = Date.now() - birthDate.getTime();
    const ageYears = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
    if (ageYears < 0 || ageYears > 120) {
      setFormError("Возраст пациента должен быть от 0 до 120 лет");
      return;
    }

    try {
      await createReferral.mutateAsync({
        patientFullName: formData.patientFullName.trim(),
        patientBirthdate: formData.patientBirthdate.trim(),
        patientCity: formData.patientCity.trim() || undefined,
        patientPhone: formData.patientPhone.trim() || undefined,
        patientEmail: formData.patientEmail.trim() || undefined,
        clinic: formData.clinic || undefined,
        notes: formData.notes.trim() || undefined,
      });
      alert("Рекомендация успешно создана!");
      resetForm();
      setDialogOpen(false);
      refetchReferrals();
    } catch (error: any) {
      const msg = error?.message || "Ошибка создания рекомендации";
      setFormError(msg);
    }
  };

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const recentReferrals = referrals?.slice(0, 5) || [];

  const statusColors: Record<string, string> = {
    new: '#f59e0b',
    in_progress: '#f97316',
    contacted: '#3b82f6',
    scheduled: '#8b5cf6',
    booked: '#6366f1',
    booked_elsewhere: '#a855f7',
    visited: '#10b981',
    paid: '#059669',
    cancelled: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    contacted: 'Контакт',
    scheduled: 'Записан',
    booked: 'Забронирован',
    booked_elsewhere: 'В другой клинике',
    visited: 'Приём состоялся',
    paid: 'Оплачено',
    cancelled: 'Отменено',
  };

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

  // Create referral dialog (shared between header button and onboarding)
  const referralDialog = (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Новая рекомендация</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="db-patientFullName">ФИО пациента *</Label>
            <Input
              id="db-patientFullName"
              placeholder="Иванов Иван Иванович"
              value={formData.patientFullName}
              onChange={(e) => setFormData({ ...formData, patientFullName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="db-patientBirthdate">Дата рождения *</Label>
            <Input
              id="db-patientBirthdate"
              placeholder="ДД.ММ.ГГГГ"
              value={formData.patientBirthdate}
              onChange={(e) => setFormData({ ...formData, patientBirthdate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="db-patientCity">Город</Label>
            <Input
              id="db-patientCity"
              placeholder="Москва"
              value={formData.patientCity}
              onChange={(e) => setFormData({ ...formData, patientCity: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="db-patientPhone">Телефон</Label>
            <Input
              id="db-patientPhone"
              placeholder="+7 (999) 123-45-67"
              value={formData.patientPhone}
              onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="db-patientEmail">Email</Label>
            <Input
              id="db-patientEmail"
              type="email"
              placeholder="patient@email.com"
              value={formData.patientEmail}
              onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="db-clinic">Клиника</Label>
            <select
              id="db-clinic"
              value={formData.clinic}
              onChange={(e) => setFormData({ ...formData, clinic: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Не указана</option>
              {clinicsList?.map((clinic: any) => (
                <option key={clinic.id} value={clinic.name}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="db-notes">Примечание</Label>
            <textarea
              id="db-notes"
              placeholder="Например: запись к конкретному врачу, важная информация о пациенте..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm resize-none"
            />
            {formData.notes.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 text-right">{formData.notes.length}/500</p>
            )}
          </div>

          {formError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Отмена
            </Button>
            <Button
              onClick={handleCreateReferral}
              disabled={createReferral.isPending}
            >
              {createReferral.isPending ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

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

      {referralDialog}

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
          </>
        )}
      </div>
      </div>
    </DashboardLayoutWrapper>
  );
}
