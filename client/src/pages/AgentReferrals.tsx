import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Filter } from "lucide-react";
import { useState } from "react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function AgentReferrals() {
  useRequireAuth();
  const { data: referrals, isLoading } = trpc.dashboard.referrals.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statusLabels: Record<string, string> = {
    new: "🆕 Новая",
    in_progress: "⚙️ В работе",
    contacted: "📞 Связались",
    scheduled: "📅 Записан",
    visited: "✅ Приём состоялся",
    paid: "💰 Оплачено",
    duplicate: "🔁 Дубликат",
    no_answer: "📵 Не дозвонились",
    cancelled: "❌ Отменена",
  };

  const statusColors: Record<string, string> = {
    new: "bg-amber-100 text-amber-800 border-amber-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    contacted: "bg-sky-100 text-sky-800 border-sky-200",
    scheduled: "bg-purple-100 text-purple-800 border-purple-200",
    visited: "bg-emerald-100 text-emerald-800 border-emerald-200",
    paid: "bg-green-100 text-green-800 border-green-200",
    duplicate: "bg-gray-100 text-gray-800 border-gray-200",
    no_answer: "bg-orange-100 text-orange-800 border-orange-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount / 100); // convert from kopecks
  };

  if (isLoading) {
    return (
      <DashboardLayoutWrapper>
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <Users className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Загрузка рекомендаций...</p>
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  // Filter referrals
  const filteredReferrals = referrals?.filter((ref: any) => {
    const matchesSearch = ref.patientFullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ref.patientPhone.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || ref.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
          <div className="container">
            <h1 className="text-4xl font-bold mb-2">Мои рекомендации</h1>
            <p className="text-primary-foreground/80">Все пациенты, которых вы направили</p>
          </div>
        </div>

        <div className="container py-8 max-w-7xl">
          {/* Filters */}
          <Card className="border-2 mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по имени или телефону..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="all">Все статусы</option>
                    <option value="new">🆕 Новая</option>
                    <option value="in_progress">⚙️ В работе</option>
                    <option value="contacted">📞 Связались</option>
                    <option value="scheduled">📅 Записан</option>
                    <option value="visited">✅ Приём состоялся</option>
                    <option value="paid">💰 Оплачено</option>
                    <option value="duplicate">🔁 Дубликат</option>
                    <option value="no_answer">📵 Не дозвонились</option>
                    <option value="cancelled">❌ Отменена</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referrals List */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                Всего рекомендаций: {filteredReferrals.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredReferrals.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" 
                      ? "Рекомендации не найдены" 
                      : "Пока нет рекомендаций"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchTerm || statusFilter !== "all"
                      ? "Попробуйте изменить фильтры"
                      : "Отправьте первого пациента через Telegram-бот"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReferrals.map((referral: any) => (
                    <div
                      key={referral.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors gap-4"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-lg mb-1">
                          {referral.patientFullName}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>📞 {referral.patientPhone}</div>
                          <div>🎂 {new Date(referral.patientBirthDate).toLocaleDateString('ru-RU')}</div>
                          <div>📅 Создано: {formatDate(referral.createdAt)}</div>
                          {referral.clinicName && (
                            <div>🏥 {referral.clinicName}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                            statusColors[referral.status]
                          }`}
                        >
                          {statusLabels[referral.status]}
                        </span>
                        {referral.commissionAmount > 0 && (
                          <div className="text-sm font-semibold text-primary">
                            {formatCurrency(referral.commissionAmount)}
                          </div>
                        )}
                        {referral.notes && (
                          <div className="text-xs text-muted-foreground max-w-xs text-right">
                            💬 {referral.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayoutWrapper>
  );
}
