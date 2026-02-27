import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, Download, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useMemo } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

const LOAD_MORE_STEP = 6;

export default function AdminReferrals() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [treatmentAmount, setTreatmentAmount] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_STEP);
  // State for "scheduled" status — selecting which clinic to book
  const [bookingReferralId, setBookingReferralId] = useState<number | null>(null);
  const [bookingClinicId, setBookingClinicId] = useState<string>("");

  const { data: referrals, isLoading, refetch } = trpc.admin.referrals.list.useQuery();
  const { data: clinicsList } = trpc.admin.clinics.list.useQuery();
  const updateStatus = trpc.admin.referrals.updateStatus.useMutation({ onSuccess: () => refetch() });
  const updateAmounts = trpc.admin.referrals.updateAmounts.useMutation({
    onSuccess: () => { refetch(); setEditingId(null); setTreatmentAmount(""); setCommissionAmount(""); },
  });
  const exportReferrals = trpc.admin.export.referrals.useMutation();

  // Filter + search
  const filtered = useMemo(() => {
    if (!referrals) return [];
    return referrals.filter(r => {
      const matchSearch = !search ||
        r.patientFullName.toLowerCase().includes(search.toLowerCase()) ||
        (r.patientPhone?.includes(search)) ||
        (r.clinic?.toLowerCase().includes(search.toLowerCase())) ||
        String(r.agentId).includes(search);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [referrals, search, statusFilter]);

  const visible = filtered.slice(0, visibleCount);

  const handleSearchChange = (v: string) => { setSearch(v); setVisibleCount(LOAD_MORE_STEP); };
  const handleFilterChange = (v: string) => { setStatusFilter(v); setVisibleCount(LOAD_MORE_STEP); };

  const handleExport = async () => {
    try {
      const result = await exportReferrals.mutateAsync({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      const blob = new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `referrals_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Ошибка экспорта");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || !["admin", "support", "accountant"].includes(user.role)) {
    setLocation("/");
    return null;
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      new: "secondary",
      in_progress: "default",
      contacted: "default",
      scheduled: "default",
      visited: "default",
      duplicate: "outline",
      no_answer: "outline",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      new: "🆕 Новая",
      in_progress: "⚙️ В работе",
      contacted: "📞 Связались",
      scheduled: "📅 Записан",
      visited: "✅ Приём состоялся",
      duplicate: "🔁 Дубликат",
      no_answer: "📵 Не дозвонились",
      cancelled: "❌ Отменена",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  type ReferralStatus = "new" | "in_progress" | "contacted" | "scheduled" | "visited" | "duplicate" | "no_answer" | "cancelled";

  const handleStatusChange = async (id: number, status: ReferralStatus) => {
    if (status === "scheduled") {
      // Show clinic selection before changing to "scheduled"
      setBookingReferralId(id);
      setBookingClinicId("");
      return;
    }
    await updateStatus.mutateAsync({ id, status });
  };

  const handleConfirmBooking = async () => {
    if (!bookingReferralId) return;
    await updateStatus.mutateAsync({
      id: bookingReferralId,
      status: "scheduled",
      bookedClinicId: bookingClinicId ? parseInt(bookingClinicId) : undefined,
    });
    setBookingReferralId(null);
    setBookingClinicId("");
  };

  // Helper: get clinic names from targetClinicIds JSON
  const getTargetClinicNames = (ref: any): string => {
    if (!ref.targetClinicIds) return ref.clinic || "любая";
    try {
      const ids = JSON.parse(ref.targetClinicIds) as number[];
      if (ids.length === 0) return "любая";
      return ids.map(id => clinicsList?.find((c: any) => c.id === id)?.name || `#${id}`).join(", ");
    } catch {
      return ref.clinic || "—";
    }
  };

  // Helper: get booked clinic name
  const getBookedClinicName = (ref: any): string | null => {
    if (!ref.bookedClinicId) return null;
    return clinicsList?.find((c: any) => c.id === ref.bookedClinicId)?.name || `#${ref.bookedClinicId}`;
  };

  // Get clinic commission rate by name (fallback 10%)
  const getClinicRate = (clinicName: string | null): number => {
    if (!clinicName || !clinicsList) return 10;
    const clinic = clinicsList.find((c: any) =>
      c.name.toLowerCase() === clinicName.toLowerCase()
    );
    return clinic?.commissionRate || 10;
  };

  const handleEditAmounts = (referral: any) => {
    setEditingId(referral.id);
    const treatment = (referral.treatmentAmount || 0) / 100;
    setTreatmentAmount(String(treatment));
    const rate = getClinicRate(referral.clinic);
    setCommissionAmount(String((treatment * rate / 100).toFixed(2)));
  };

  const handleTreatmentAmountChange = (value: string) => {
    setTreatmentAmount(value);
    const treatment = parseFloat(value) || 0;
    // Use the editing referral's clinic rate
    const editingRef = referrals?.find((r: any) => r.id === editingId);
    const rate = getClinicRate(editingRef?.clinic || null);
    setCommissionAmount(String((treatment * rate / 100).toFixed(2)));
  };

  const handleSaveAmounts = async (id: number) => {
    const treatment = Math.round(parseFloat(treatmentAmount) * 100);
    const commission = Math.round(parseFloat(commissionAmount) * 100);
    await updateAmounts.mutateAsync({ id, treatmentAmount: treatment, commissionAmount: commission });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(amount / 100);
  };

  return (
    <AdminLayoutWrapper>
      <div className="container py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Все рекомендации ({filtered.length})</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по пациенту, клинике..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="new">🆕 Новая</SelectItem>
                    <SelectItem value="in_progress">⚙️ В работе</SelectItem>
                    <SelectItem value="contacted">📞 Связались</SelectItem>
                    <SelectItem value="scheduled">📅 Записан</SelectItem>
                    <SelectItem value="visited">✅ Приём состоялся</SelectItem>

                    <SelectItem value="duplicate">🔁 Дубликат</SelectItem>
                    <SelectItem value="no_answer">📵 Не дозвонились</SelectItem>
                    <SelectItem value="cancelled">❌ Отменена</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>ID агента</TableHead>
                    <TableHead>Пациент</TableHead>
                    <TableHead>Дата рождения</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Связь DocDoc</TableHead>
                    <TableHead>Клиники направления</TableHead>
                    <TableHead>Запись от Doc Partner</TableHead>
                    <TableHead>Примечание врача</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Сумма лечения</TableHead>
                    <TableHead>Комиссия</TableHead>
                    <TableHead>Дата создания</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>{referral.id}</TableCell>
                      <TableCell className="font-mono text-sm">{referral.agentId}</TableCell>
                      <TableCell className="font-medium">{referral.patientFullName}</TableCell>
                      <TableCell>{referral.patientBirthdate}</TableCell>
                      <TableCell>{referral.patientPhone || "—"}</TableCell>
                      <TableCell>
                        {referral.contactConsent === true ? (
                          <Badge variant="default" className="bg-green-600">✅ Да</Badge>
                        ) : referral.contactConsent === false ? (
                          <Badge variant="destructive">❌ Нет</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getTargetClinicNames(referral)}</span>
                      </TableCell>
                      <TableCell>
                        {referral.bookedClinicId ? (
                          <div>
                            <Badge variant="default" className="bg-purple-600 text-xs">
                              {getBookedClinicName(referral)}
                            </Badge>
                            {referral.bookedByPartner === "yes" && (
                              <span className="text-xs text-green-600 block mt-1">от клиники</span>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {referral.notes ? (
                          <span className="text-sm text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 inline-block max-w-[200px] truncate" title={referral.notes}>
                            {referral.notes}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell>
                        {editingId === referral.id ? (
                          <Input type="number" value={treatmentAmount} onChange={(e) => handleTreatmentAmountChange(e.target.value)} className="w-24" placeholder="0.00" />
                        ) : formatCurrency(referral.treatmentAmount || 0)}
                      </TableCell>
                      <TableCell>
                        {editingId === referral.id ? (
                          <Input type="number" value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} className="w-24" placeholder="0.00" />
                        ) : formatCurrency(referral.commissionAmount || 0)}
                      </TableCell>
                      <TableCell>
                        {referral.createdAt ? format(new Date(referral.createdAt), "dd.MM.yyyy", { locale: ru }) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {editingId === referral.id ? (
                            <>
                              <Button size="sm" onClick={() => handleSaveAmounts(referral.id)} disabled={updateAmounts.isPending}>
                                Сохранить
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                Отмена
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleEditAmounts(referral)}>
                                Редактировать
                              </Button>
                              <Select
                                value={referral.status}
                                onValueChange={(value) =>
                                  handleStatusChange(referral.id, value as ReferralStatus)
                                }
                                disabled={updateStatus.isPending}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">🆕 Новая</SelectItem>
                                  <SelectItem value="in_progress">⚙️ В работе</SelectItem>
                                  <SelectItem value="contacted">📞 Связались</SelectItem>
                                  <SelectItem value="scheduled">📅 Записан</SelectItem>
                                  <SelectItem value="visited">✅ Приём состоялся</SelectItem>
              
                                  <SelectItem value="duplicate">🔁 Дубликат</SelectItem>
                                  <SelectItem value="no_answer">📵 Не дозвонились</SelectItem>
                                  <SelectItem value="cancelled">❌ Отменена</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Booking clinic selection modal */}
            {bookingReferralId && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4">Записать в клинику</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Выберите клинику, в которую записан пациент. Можно пропустить.
                  </p>
                  <select
                    value={bookingClinicId}
                    onChange={(e) => setBookingClinicId(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm mb-4"
                  >
                    <option value="">— Не указана —</option>
                    {clinicsList?.map((c: any) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setBookingReferralId(null); setBookingClinicId(""); }}>
                      Отмена
                    </Button>
                    <Button size="sm" onClick={handleConfirmBooking} disabled={updateStatus.isPending}>
                      {updateStatus.isPending ? "Сохранение..." : "Записать"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Show more */}
            {visibleCount < filtered.length && (
              <div className="flex flex-col items-center gap-2 mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Показано {visibleCount} из {filtered.length}
                </p>
                <Button variant="outline" onClick={() => setVisibleCount(v => v + LOAD_MORE_STEP)}>
                  Показать ещё ({Math.min(LOAD_MORE_STEP, filtered.length - visibleCount)})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayoutWrapper>
  );
}
