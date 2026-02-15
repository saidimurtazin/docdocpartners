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
import { Loader2, ArrowLeft, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useMemo } from "react";

const PAGE_SIZE = 20;

export default function AdminReferrals() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [treatmentAmount, setTreatmentAmount] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: referrals, isLoading, refetch } = trpc.admin.referrals.list.useQuery();
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleFilterChange = (v: string) => { setStatusFilter(v); setPage(1); };

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

  if (!user || user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      contacted: "default",
      scheduled: "default",
      completed: "default",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      contacted: "Связались",
      scheduled: "Назначено",
      completed: "Завершено",
      cancelled: "Отменено",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const handleStatusChange = async (
    id: number,
    status: "pending" | "contacted" | "scheduled" | "completed" | "cancelled"
  ) => {
    await updateStatus.mutateAsync({ id, status });
  };

  const handleEditAmounts = (referral: any) => {
    setEditingId(referral.id);
    const treatment = (referral.treatmentAmount || 0) / 100;
    setTreatmentAmount(String(treatment));
    setCommissionAmount(String((treatment * 0.1).toFixed(2)));
  };

  const handleTreatmentAmountChange = (value: string) => {
    setTreatmentAmount(value);
    const treatment = parseFloat(value) || 0;
    setCommissionAmount(String((treatment * 0.1).toFixed(2)));
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Рекомендации пациентов</h1>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={exportReferrals.isPending}>
              <Download className="w-4 h-4 mr-2" />
              {exportReferrals.isPending ? "Экспорт..." : "Excel"}
            </Button>
          </div>
        </div>
      </header>

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
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="contacted">Связались</SelectItem>
                    <SelectItem value="scheduled">Назначено</SelectItem>
                    <SelectItem value="completed">Завершено</SelectItem>
                    <SelectItem value="cancelled">Отменено</SelectItem>
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
                    <TableHead>Клиника</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Сумма лечения</TableHead>
                    <TableHead>Комиссия</TableHead>
                    <TableHead>Дата создания</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>{referral.id}</TableCell>
                      <TableCell className="font-mono text-sm">{referral.agentId}</TableCell>
                      <TableCell className="font-medium">{referral.patientFullName}</TableCell>
                      <TableCell>{referral.patientBirthdate}</TableCell>
                      <TableCell>{referral.patientPhone || "—"}</TableCell>
                      <TableCell>{referral.clinic || "—"}</TableCell>
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
                                  handleStatusChange(referral.id, value as "pending" | "contacted" | "scheduled" | "completed" | "cancelled")
                                }
                                disabled={updateStatus.isPending}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Ожидает</SelectItem>
                                  <SelectItem value="contacted">Связались</SelectItem>
                                  <SelectItem value="scheduled">Назначено</SelectItem>
                                  <SelectItem value="completed">Завершено</SelectItem>
                                  <SelectItem value="cancelled">Отменено</SelectItem>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Показано {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} из {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2">Стр. {page} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
