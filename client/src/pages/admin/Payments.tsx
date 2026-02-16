import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Download, Search, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Send, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useMemo } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

const PAGE_SIZE = 20;

export default function AdminPayments() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [transactionId, setTransactionId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Registry period state
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return format(d, "yyyy-MM-dd");
  });
  const [periodEnd, setPeriodEnd] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data: payments, isLoading, refetch } = trpc.admin.payments.list.useQuery();
  const updateStatus = trpc.admin.payments.updateStatus.useMutation({
    onSuccess: () => { refetch(); setEditingId(null); setTransactionId(""); },
  });
  const generateAct = trpc.admin.payments.generateAct.useMutation({
    onSuccess: (data) => {
      alert(`Акт ${data.actNumber} создан!`);
      refetch();
    },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const sendForSigning = trpc.admin.payments.sendForSigning.useMutation({
    onSuccess: (data) => {
      alert(`OTP-код отправлен через ${data.sentVia === "telegram" ? "Telegram" : "email"}`);
      refetch();
    },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const batchMarkCompleted = trpc.admin.payments.batchMarkCompleted.useMutation({
    onSuccess: (data) => {
      alert(`${data.count} выплат помечены как выплаченные`);
      refetch();
    },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const exportPayments = trpc.admin.export.payments.useMutation();
  const exportRegistry = trpc.admin.export.paymentRegistry.useMutation();
  const exportSignedRegistry = trpc.admin.export.signedActsRegistry.useMutation();

  // Filter + search
  const filtered = useMemo(() => {
    if (!payments) return [];
    return payments.filter(p => {
      const matchSearch = !search ||
        String(p.id).includes(search) ||
        String(p.agentId).includes(search) ||
        (p.agentFullName?.toLowerCase().includes(search.toLowerCase())) ||
        (p.transactionId?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [payments, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleFilterChange = (v: string) => { setStatusFilter(v); setPage(1); };

  const handleExport = async () => {
    try {
      const result = await exportPayments.mutateAsync({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      downloadExcel(result.data, `payments_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } catch {
      alert("Ошибка экспорта");
    }
  };

  const handleExportRegistry = async () => {
    try {
      const result = await exportRegistry.mutateAsync({
        periodStart,
        periodEnd,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      downloadExcel(result.data, `registry_${periodStart}_${periodEnd}.xlsx`);
    } catch {
      alert("Ошибка формирования реестра");
    }
  };

  const handleExportSignedRegistry = async () => {
    try {
      const result = await exportSignedRegistry.mutateAsync({ periodStart, periodEnd });
      downloadExcel(result.data, `signed_acts_registry_${periodStart}_${periodEnd}.xlsx`);
    } catch {
      alert("Ошибка формирования реестра подписанных актов");
    }
  };

  const handleBatchComplete = () => {
    if (!payments) return;
    const readyIds = payments
      .filter(p => p.status === "ready_for_payment")
      .map(p => p.id);
    if (readyIds.length === 0) {
      alert("Нет выплат со статусом «К оплате»");
      return;
    }
    if (confirm(`Пометить ${readyIds.length} выплат как выплаченные?`)) {
      batchMarkCompleted.mutate({ paymentIds: readyIds });
    }
  };

  function downloadExcel(base64: string, filename: string) {
    const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

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
      act_generated: "outline",
      sent_for_signing: "outline",
      signed: "default",
      ready_for_payment: "default",
      processing: "default",
      completed: "default",
      failed: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      act_generated: "Акт создан",
      sent_for_signing: "На подписании",
      signed: "Подписан",
      ready_for_payment: "К оплате",
      processing: "Обрабатывается",
      completed: "Выплачено",
      failed: "Ошибка",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const handleStatusChange = async (
    id: number,
    status: "pending" | "act_generated" | "sent_for_signing" | "signed" | "ready_for_payment" | "processing" | "completed" | "failed"
  ) => {
    const txId = status === "completed" ? transactionId : undefined;
    await updateStatus.mutateAsync({ id, status, transactionId: txId });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(amount / 100);
  };

  const readyForPaymentCount = payments?.filter(p => p.status === "ready_for_payment").length || 0;

  return (
    <AdminLayoutWrapper>
      <div className="container py-8 space-y-6">
        {/* Registry generation card */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Реестры и выплаты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full sm:w-auto">
                <Label htmlFor="periodStart" className="text-sm text-muted-foreground">Начало периода</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <Label htmlFor="periodEnd" className="text-sm text-muted-foreground">Конец периода</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleExportRegistry}
                disabled={exportRegistry.isPending || !periodStart || !periodEnd}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {exportRegistry.isPending ? "Формирование..." : "Общий реестр"}
              </Button>
              <Button
                onClick={handleExportSignedRegistry}
                disabled={exportSignedRegistry.isPending || !periodStart || !periodEnd}
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
              >
                <FileText className="w-4 h-4 mr-2" />
                {exportSignedRegistry.isPending ? "Формирование..." : "Реестр подписанных актов"}
              </Button>
            </div>
            {readyForPaymentCount > 0 && (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                <span className="text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  {readyForPaymentCount} выплат готовы к оплате (подписанные акты)
                </span>
                <Button
                  size="sm"
                  onClick={handleBatchComplete}
                  disabled={batchMarkCompleted.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {batchMarkCompleted.isPending ? "Обработка..." : "Пакетная выплата"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Все выплаты ({filtered.length})</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по ID, агенту..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 w-full sm:w-52"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="act_generated">Акт создан</SelectItem>
                    <SelectItem value="sent_for_signing">На подписании</SelectItem>
                    <SelectItem value="signed">Подписан</SelectItem>
                    <SelectItem value="ready_for_payment">К оплате</SelectItem>
                    <SelectItem value="processing">Обрабатывается</SelectItem>
                    <SelectItem value="completed">Выплачено</SelectItem>
                    <SelectItem value="failed">Ошибка</SelectItem>
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
                    <TableHead>Агент</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Метод</TableHead>
                    <TableHead>ID Транзакции</TableHead>
                    <TableHead>Запрошено</TableHead>
                    <TableHead>Выплачено</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.id}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.agentFullName || "—"}</div>
                          <div className="text-xs text-muted-foreground">ID: {payment.agentId}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>{payment.method || "—"}</TableCell>
                      <TableCell>
                        {editingId === payment.id ? (
                          <Input
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="TX123456"
                            className="w-32"
                          />
                        ) : (
                          payment.transactionId || "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.requestedAt
                          ? format(new Date(payment.requestedAt), "dd.MM.yyyy HH:mm", { locale: ru })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {payment.completedAt
                          ? format(new Date(payment.completedAt), "dd.MM.yyyy HH:mm", { locale: ru })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {/* Step 1: Generate act */}
                          {payment.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => generateAct.mutate({ paymentId: payment.id })}
                              disabled={generateAct.isPending}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Сформировать акт
                            </Button>
                          )}

                          {/* Step 2: Send for signing */}
                          {payment.status === "act_generated" && (
                            <ActionsForActGenerated
                              paymentId={payment.id}
                              onSendForSigning={(actId) => sendForSigning.mutate({ actId })}
                              isSending={sendForSigning.isPending}
                            />
                          )}

                          {/* Step 3: Waiting for signature */}
                          {payment.status === "sent_for_signing" && (
                            <span className="text-xs text-amber-600">Ожидание подписи...</span>
                          )}

                          {/* Step 4: Ready for payment */}
                          {payment.status === "ready_for_payment" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(payment.id, "completed")}
                                disabled={updateStatus.isPending}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Выплатить
                              </Button>
                            </>
                          )}

                          {/* Legacy: manual processing for older payments */}
                          {editingId === payment.id && (
                            <>
                              <Button size="sm" onClick={() => handleStatusChange(payment.id, "completed")} disabled={updateStatus.isPending}>
                                Выплачено
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleStatusChange(payment.id, "failed")} disabled={updateStatus.isPending}>
                                Ошибка
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setTransactionId(""); }}>
                                Отмена
                              </Button>
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
    </AdminLayoutWrapper>
  );
}

/**
 * Sub-component for act_generated status actions
 * Needs to fetch the act to get actId for sending
 */
function ActionsForActGenerated({
  paymentId,
  onSendForSigning,
  isSending,
}: {
  paymentId: number;
  onSendForSigning: (actId: number) => void;
  isSending: boolean;
}) {
  const { data: act } = trpc.admin.payments.getAct.useQuery({ paymentId });

  return (
    <>
      <Button
        size="sm"
        onClick={() => act && onSendForSigning(act.id)}
        disabled={isSending || !act}
      >
        <Send className="w-3 h-3 mr-1" />
        На подписание
      </Button>
      {act && (
        <a href={`/api/acts/${act.id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="w-full">
            <Download className="w-3 h-3 mr-1" />
            Скачать PDF
          </Button>
        </a>
      )}
    </>
  );
}
