import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Download, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import ClinicLayoutWrapper from "@/components/ClinicLayoutWrapper";

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  in_progress: "В работе",
  contacted: "Связались",
  scheduled: "Записан",
  visited: "Пролечен",
  paid: "Оплачен",
  duplicate: "Дубликат",
  no_answer: "Нет ответа",
  cancelled: "Отменён",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "outline",
  in_progress: "secondary",
  contacted: "secondary",
  scheduled: "default",
  visited: "default",
  paid: "default",
  duplicate: "destructive",
  no_answer: "destructive",
  cancelled: "destructive",
};

function formatAmount(kopecks: number): string {
  return new Intl.NumberFormat("ru-RU").format(kopecks / 100) + " \u20BD";
}

export default function ClinicReferrals() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const perPage = 20;

  // Confirm treatment dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedReferralId, setSelectedReferralId] = useState<number | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [treatmentAmount, setTreatmentAmount] = useState("");

  const { data, isLoading, refetch } = trpc.clinic.referrals.useQuery({
    page,
    perPage,
    status: statusFilter !== "all" ? statusFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const confirmTreatment = trpc.clinic.confirmTreatment.useMutation({
    onSuccess: () => {
      toast.success("Лечение подтверждено");
      setConfirmDialogOpen(false);
      setSelectedReferralId(null);
      setVisitDate("");
      setTreatmentAmount("");
      refetch();
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  const exportReferrals = trpc.clinic.exportReferrals.useMutation({
    onSuccess: (data) => {
      // Download Excel file
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Файл загружен");
    },
    onError: (err) => toast.error(`Ошибка экспорта: ${err.message}`),
  });

  const openConfirmDialog = (referralId: number) => {
    setSelectedReferralId(referralId);
    setVisitDate(format(new Date(), "yyyy-MM-dd"));
    setTreatmentAmount("");
    setConfirmDialogOpen(true);
  };

  const handleConfirmTreatment = () => {
    if (!selectedReferralId || !visitDate || !treatmentAmount) return;
    confirmTreatment.mutate({
      referralId: selectedReferralId,
      visitDate,
      treatmentAmount: Math.round(parseFloat(treatmentAmount) * 100), // рубли → копейки
    });
  };

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  return (
    <ClinicLayoutWrapper>
      <div className="container py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Реестр направлений</h1>
            <p className="text-muted-foreground mt-1">
              Всего: {data?.total || 0} направлений
            </p>
          </div>
          <Button
            onClick={() => exportReferrals.mutate({
              status: statusFilter !== "all" ? statusFilter : undefined,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
            })}
            disabled={exportReferrals.isPending}
            variant="outline"
          >
            {exportReferrals.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Экспорт...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Выгрузить Excel</>
            )}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Дата от</Label>
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-2">
                <Label>Дата до</Label>
                <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ФИО пациента</TableHead>
                        <TableHead>Дата рождения</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Дата направления</TableHead>
                        <TableHead>Сумма лечения</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.items?.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.patientFullName}</TableCell>
                          <TableCell>{r.patientBirthdate || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[r.status] || "outline"}>
                              {STATUS_LABELS[r.status] || r.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.createdAt ? format(new Date(r.createdAt), "dd.MM.yyyy", { locale: ru }) : "—"}
                          </TableCell>
                          <TableCell>
                            {r.treatmentAmount ? formatAmount(r.treatmentAmount) : "—"}
                          </TableCell>
                          <TableCell>
                            {!["visited", "paid"].includes(r.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => openConfirmDialog(r.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Подтвердить
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!data?.items || data.items.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Нет направлений
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Страница {page} из {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page <= 1}
                      >
                        Назад
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                      >
                        Вперёд
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Treatment Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={(open) => {
        setConfirmDialogOpen(open);
        if (!open) { setSelectedReferralId(null); setVisitDate(""); setTreatmentAmount(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтвердить лечение</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Дата визита *</Label>
              <Input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Сумма лечения (руб) *</Label>
              <Input
                type="number"
                placeholder="5000"
                value={treatmentAmount}
                onChange={(e) => setTreatmentAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Отмена</Button>
            <Button
              onClick={handleConfirmTreatment}
              disabled={!visitDate || !treatmentAmount || confirmTreatment.isPending}
            >
              {confirmTreatment.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Сохранение...</>
              ) : (
                "Подтвердить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClinicLayoutWrapper>
  );
}
