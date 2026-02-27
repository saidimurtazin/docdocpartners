import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { 
  TrendingUp, 
  Users, 
  Wallet, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LogOut,
  Loader2
} from "lucide-react";
import { useLocation } from "wouter";
import Logo from "@/components/Logo";

interface AgentSession {
  telegramId: string;
  agentId: string;
  email: string;
  fullName: string;
}

export default function AgentCabinet() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<AgentSession | null>(null);

  // Load session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("agent_session");
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        setLocation("/login");
      }
    } else {
      setLocation("/login");
    }
  }, [setLocation]);

  // Fetch agent data
  const { data: agentData, isLoading: agentLoading } = trpc.bot.getAgent.useQuery(
    { telegramId: session?.telegramId || "" },
    { enabled: !!session?.telegramId }
  );

  // Fetch agent statistics
  const { data: statsData, isLoading: statsLoading } = trpc.bot.getAgentStatistics.useQuery(
    { telegramId: session?.telegramId || "" },
    { enabled: !!session?.telegramId }
  );

  const handleLogout = () => {
    localStorage.removeItem("agent_session");
    setLocation("/login");
  };

  const formatMoney = (kopecks: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(kopecks / 100);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, text: "На проверке", className: "bg-yellow-100 text-yellow-800" },
      active: { icon: CheckCircle2, text: "Активен", className: "bg-green-100 text-green-800" },
      rejected: { icon: XCircle, text: "Отклонён", className: "bg-red-100 text-red-800" },
      blocked: { icon: AlertCircle, text: "Заблокирован", className: "bg-gray-100 text-gray-800" },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
        <Icon className="w-4 h-4" />
        {badge.text}
      </span>
    );
  };

  if (!session || agentLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const agent = agentData?.agent;
  const stats = statsData?.statistics;

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Агент не найден</CardTitle>
            <CardDescription>Пожалуйста, зарегистрируйтесь в боте</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/login")} className="w-full">
              Вернуться к входу
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo size={32} />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{agent.fullName}</CardTitle>
                <CardDescription className="mt-2">
                  {agent.role} • {agent.city}
                </CardDescription>
              </div>
              {getStatusBadge(agent.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="font-medium">{agent.email}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Телефон</div>
                <div className="font-medium">{agent.phone}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Telegram ID</div>
                <div className="font-mono font-medium">{agent.telegramId}</div>
              </div>
              {agent.referralCode && (
                <div>
                  <div className="text-sm text-muted-foreground">Реферальный код</div>
                  <div className="font-mono font-medium">{agent.referralCode}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Всего заработано</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {formatMoney(stats?.totalEarnings || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">За все время</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Рекомендаций</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">{stats?.totalReferrals || 0}</div>
                  <div className="text-sm text-muted-foreground">Пациентов направлено</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Средний заработок</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {formatMoney(
                      Math.floor((stats?.totalEarnings || 0) / Math.max(stats?.totalReferrals || 1, 1))
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">На пациента</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bonus Points Card */}
        {(agent.bonusPoints || 0) > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎁 Бонусные баллы
              </CardTitle>
              <CardDescription>
                За приведённых агентов
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary mb-2">
                {agent.bonusPoints?.toLocaleString()} баллов
              </div>
              <p className="text-sm text-muted-foreground">
                Вывод доступен после {stats?.totalReferrals || 0}/5 собственных рекомендаций
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Управляйте рекомендациями через Telegram-бот</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Button 
                className="h-auto py-4 flex-col items-start" 
                variant="outline"
                onClick={() => window.open("https://t.me/docpartnerbot", "_blank")}
              >
                <div className="font-semibold mb-1">📝 Отправить пациента</div>
                <div className="text-sm text-muted-foreground">Создать новую рекомендацию</div>
              </Button>
              <Button 
                className="h-auto py-4 flex-col items-start" 
                variant="outline"
                onClick={() => window.open("https://t.me/docpartnerbot", "_blank")}
              >
                <div className="font-semibold mb-1">📊 Моя статистика</div>
                <div className="text-sm text-muted-foreground">Просмотр всех рекомендаций</div>
              </Button>
              <Button 
                className="h-auto py-4 flex-col items-start" 
                variant="outline"
                onClick={() => window.open("https://t.me/docpartnerbot", "_blank")}
              >
                <div className="font-semibold mb-1">💰 Запросить выплату</div>
                <div className="text-sm text-muted-foreground">Минимум 1 000 ₽</div>
              </Button>
              <Button 
                className="h-auto py-4 flex-col items-start" 
                variant="outline"
                onClick={() => window.open("https://t.me/docpartnerbot", "_blank")}
              >
                <div className="font-semibold mb-1">📚 База знаний</div>
                <div className="text-sm text-muted-foreground">Ответы на вопросы</div>
              </Button>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Все функции доступны в Telegram-боте{" "}
                <a href="https://t.me/docpartnerbot" className="text-primary hover:underline">
                  @docpartnerbot
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
