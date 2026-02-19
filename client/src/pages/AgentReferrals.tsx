import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Filter, Plus } from "lucide-react";
import { useState } from "react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function AgentReferrals() {
  useRequireAuth();
  const { data: referrals, isLoading, refetch } = trpc.dashboard.referrals.useQuery();
  const { data: clinicsList } = trpc.dashboard.clinics.useQuery();
  const createReferral = trpc.dashboard.createReferral.useMutation();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
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

  const statusLabels: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    contacted: "Связались",
    scheduled: "Записан",
    visited: "Приём состоялся",
    paid: "Оплачено",
    duplicate: "Дубликат",
    no_answer: "Не дозвонились",
    cancelled: "Отменена",
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

    // Validate
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
      refetch();
    } catch (error: any) {
      const msg = error?.message || "Ошибка создания рекомендации";
      setFormError(msg);
    }
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
                         (ref.patientPhone && ref.patientPhone.includes(searchTerm));
    const matchesStatus = statusFilter === "all" || ref.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
          <div className="container">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">Мои рекомендации</h1>
                <p className="text-primary-foreground/80">Все пациенты, которых вы направили</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="lg" className="gap-2">
                    <Plus className="w-5 h-5" />
                    Добавить рекомендацию
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Новая рекомендация</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label htmlFor="patientFullName">ФИО пациента *</Label>
                      <Input
                        id="patientFullName"
                        placeholder="Иванов Иван Иванович"
                        value={formData.patientFullName}
                        onChange={(e) => setFormData({ ...formData, patientFullName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="patientBirthdate">Дата рождения *</Label>
                      <Input
                        id="patientBirthdate"
                        placeholder="ДД.ММ.ГГГГ"
                        value={formData.patientBirthdate}
                        onChange={(e) => setFormData({ ...formData, patientBirthdate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="patientCity">Город</Label>
                      <Input
                        id="patientCity"
                        placeholder="Москва"
                        value={formData.patientCity}
                        onChange={(e) => setFormData({ ...formData, patientCity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="patientPhone">Телефон</Label>
                      <Input
                        id="patientPhone"
                        placeholder="+7 (999) 123-45-67"
                        value={formData.patientPhone}
                        onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="patientEmail">Email</Label>
                      <Input
                        id="patientEmail"
                        type="email"
                        placeholder="patient@email.com"
                        value={formData.patientEmail}
                        onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="clinic">Клиника</Label>
                      <select
                        id="clinic"
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
                      <Label htmlFor="notes">Примечание</Label>
                      <textarea
                        id="notes"
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
            </div>
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
                    <option value="new">Новая</option>
                    <option value="in_progress">В работе</option>
                    <option value="contacted">Связались</option>
                    <option value="scheduled">Записан</option>
                    <option value="visited">Приём состоялся</option>
                    <option value="paid">Оплачено</option>
                    <option value="duplicate">Дубликат</option>
                    <option value="no_answer">Не дозвонились</option>
                    <option value="cancelled">Отменена</option>
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
                      : "Нажмите «Добавить рекомендацию» чтобы направить пациента"}
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
                          {referral.patientPhone && <div>Tel: {referral.patientPhone}</div>}
                          {referral.patientBirthdate && <div>Д.р.: {referral.patientBirthdate}</div>}
                          <div>Создано: {formatDate(referral.createdAt)}</div>
                          {referral.clinic && (
                            <div>Клиника: {referral.clinic}</div>
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
                            {referral.notes}
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
