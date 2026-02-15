import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Search, ChevronLeft, ChevronRight, Mail, CheckCircle, XCircle,
  Link2, Pencil, ChevronDown, ChevronUp, RefreshCw, Eye,
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useMemo } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

const PAGE_SIZE = 20;

export default function AdminClinicReports() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Dialogs
  const [rejectDialog, setRejectDialog] = useState<{ id: number } | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [approveDialog, setApproveDialog] = useState<{ id: number; referralId: number | null; treatmentAmount: number } | null>(null);
  const [approveReferralId, setApproveReferralId] = useState("");
  const [approveTreatmentAmount, setApproveTreatmentAmount] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [linkDialog, setLinkDialog] = useState<{ id: number } | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [selectedReferralId, setSelectedReferralId] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState<any | null>(null);
  const [editFields, setEditFields] = useState({ patientName: "", visitDate: "", treatmentAmount: "", services: "", clinicName: "" });

  // Queries
  const { data: listData, isLoading, refetch } = trpc.admin.clinicReports.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: stats } = trpc.admin.clinicReports.stats.useQuery();
  const { data: searchReferrals } = trpc.admin.clinicReports.searchReferrals.useQuery(
    { search: linkSearch },
    { enabled: linkDialog !== null && linkSearch.length >= 2 }
  );

  // Mutations
  const approveMutation = trpc.admin.clinicReports.approve.useMutation({ onSuccess: () => { refetch(); setApproveDialog(null); } });
  const rejectMutation = trpc.admin.clinicReports.reject.useMutation({ onSuccess: () => { refetch(); setRejectDialog(null); } });
  const updateMutation = trpc.admin.clinicReports.update.useMutation({ onSuccess: () => { refetch(); setEditDialog(null); } });
  const linkMutation = trpc.admin.clinicReports.linkToReferral.useMutation({ onSuccess: () => { refetch(); setLinkDialog(null); } });
  const triggerPoll = trpc.admin.clinicReports.triggerPoll.useMutation({ onSuccess: () => refetch() });

  const reports = listData?.reports || [];
  const total = listData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleFilterChange = (v: string) => { setStatusFilter(v); setPage(1); };

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
      pending_review: "secondary",
      auto_matched: "default",
      approved: "default",
      rejected: "destructive",
    };
    const labels: Record<string, string> = {
      pending_review: "🔍 На проверке",
      auto_matched: "🤖 Авто-привязка",
      approved: "✅ Одобрен",
      rejected: "❌ Отклонён",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 85) return <Badge variant="default" className="bg-green-600">{confidence}%</Badge>;
    if (confidence >= 60) return <Badge variant="secondary" className="bg-yellow-500 text-black">{confidence}%</Badge>;
    return <Badge variant="outline">{confidence}%</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(amount / 100);
  };

  const openApproveDialog = (report: any) => {
    setApproveDialog({ id: report.id, referralId: report.referralId, treatmentAmount: report.treatmentAmount || 0 });
    setApproveReferralId(report.referralId ? String(report.referralId) : "");
    setApproveTreatmentAmount(report.treatmentAmount ? String(report.treatmentAmount / 100) : "");
    setApproveNotes("");
  };

  const openEditDialog = (report: any) => {
    setEditDialog(report);
    setEditFields({
      patientName: report.patientName || "",
      visitDate: report.visitDate || "",
      treatmentAmount: report.treatmentAmount ? String(report.treatmentAmount / 100) : "",
      services: report.services || "",
      clinicName: report.clinicName || "",
    });
  };

  const handleApprove = async () => {
    if (!approveDialog) return;
    await approveMutation.mutateAsync({
      id: approveDialog.id,
      referralId: approveReferralId ? parseInt(approveReferralId) : undefined,
      treatmentAmount: approveTreatmentAmount ? Math.round(parseFloat(approveTreatmentAmount) * 100) : undefined,
      notes: approveNotes || undefined,
    });
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    await rejectMutation.mutateAsync({ id: rejectDialog.id, notes: rejectNotes || undefined });
  };

  const handleEdit = async () => {
    if (!editDialog) return;
    await updateMutation.mutateAsync({
      id: editDialog.id,
      patientName: editFields.patientName || undefined,
      visitDate: editFields.visitDate || undefined,
      treatmentAmount: editFields.treatmentAmount ? Math.round(parseFloat(editFields.treatmentAmount) * 100) : undefined,
      services: editFields.services || undefined,
      clinicName: editFields.clinicName || undefined,
    });
  };

  const handleLink = async () => {
    if (!linkDialog || !selectedReferralId) return;
    await linkMutation.mutateAsync({ id: linkDialog.id, referralId: selectedReferralId });
  };

  return (
    <AdminLayoutWrapper>
      <div className="container py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Всего</p>
              <p className="text-2xl font-bold">{stats?.total ?? "..."}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">🔍 На проверке</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.pendingReview ?? "..."}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">🤖 Авто-привязка</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.autoMatched ?? "..."}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">✅ Одобрено</p>
              <p className="text-2xl font-bold text-green-600">{stats?.approved ?? "..."}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">❌ Отклонено</p>
              <p className="text-2xl font-bold text-red-600">{stats?.rejected ?? "..."}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Table Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Отчёты клиник ({total})
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerPoll.mutateAsync()}
                  disabled={triggerPoll.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${triggerPoll.isPending ? "animate-spin" : ""}`} />
                  {triggerPoll.isPending ? "Проверяем..." : "Проверить почту"}
                </Button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по пациенту..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 w-full sm:w-56"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="pending_review">🔍 На проверке</SelectItem>
                    <SelectItem value="auto_matched">🤖 Авто-привязка</SelectItem>
                    <SelectItem value="approved">✅ Одобрено</SelectItem>
                    <SelectItem value="rejected">❌ Отклонено</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Нет отчётов</p>
                <p className="text-sm mt-1">Нажмите «Проверить почту» или дождитесь автоматического опроса</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Пациент</TableHead>
                      <TableHead>Клиника</TableHead>
                      <TableHead>Дата визита</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>AI %</TableHead>
                      <TableHead>Привязка</TableHead>
                      <TableHead>Получено</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report: any) => (
                      <>
                        <TableRow key={report.id} className={expandedId === report.id ? "border-b-0" : ""}>
                          <TableCell>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                            >
                              {expandedId === report.id
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{report.id}</TableCell>
                          <TableCell className="font-medium max-w-[180px] truncate">{report.patientName || "—"}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{report.clinicName || "—"}</TableCell>
                          <TableCell>{report.visitDate || "—"}</TableCell>
                          <TableCell>{report.treatmentAmount ? formatCurrency(report.treatmentAmount) : "—"}</TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                          <TableCell>{getConfidenceBadge(report.aiConfidence || 0)}</TableCell>
                          <TableCell>
                            {report.referralId ? (
                              <Badge variant="outline" className="text-blue-600">
                                <Link2 className="w-3 h-3 mr-1" />
                                #{report.referralId}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">нет</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {report.emailReceivedAt
                              ? format(new Date(report.emailReceivedAt), "dd.MM.yy HH:mm", { locale: ru })
                              : report.createdAt
                              ? format(new Date(report.createdAt), "dd.MM.yy HH:mm", { locale: ru })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(report.status === "pending_review" || report.status === "auto_matched") && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700" title="Одобрить" onClick={() => openApproveDialog(report)}>
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" title="Отклонить" onClick={() => { setRejectDialog({ id: report.id }); setRejectNotes(""); }}>
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Редактировать" onClick={() => openEditDialog(report)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {!report.referralId && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700" title="Привязать к рекомендации" onClick={() => { setLinkDialog({ id: report.id }); setLinkSearch(""); setSelectedReferralId(null); }}>
                                  <Link2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded row — email body & details */}
                        {expandedId === report.id && (
                          <TableRow key={`${report.id}-expanded`}>
                            <TableCell colSpan={11} className="bg-muted/30 p-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">Данные из письма (AI)</h4>
                                  <div className="text-sm space-y-1">
                                    <p><span className="text-muted-foreground">Пациент:</span> {report.patientName || "—"}</p>
                                    <p><span className="text-muted-foreground">Клиника:</span> {report.clinicName || "—"}</p>
                                    <p><span className="text-muted-foreground">Дата визита:</span> {report.visitDate || "—"}</p>
                                    <p><span className="text-muted-foreground">Сумма:</span> {report.treatmentAmount ? formatCurrency(report.treatmentAmount) : "—"}</p>
                                    <p><span className="text-muted-foreground">Услуги:</span> {report.services || "—"}</p>
                                    <p><span className="text-muted-foreground">AI уверенность:</span> {report.aiConfidence}%</p>
                                    <p><span className="text-muted-foreground">Совпадение:</span> {report.matchConfidence}%</p>
                                    {report.referralId && (
                                      <p><span className="text-muted-foreground">Рекомендация:</span> #{report.referralId}</p>
                                    )}
                                    {report.reviewNotes && (
                                      <p><span className="text-muted-foreground">Комментарий:</span> {report.reviewNotes}</p>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Текст письма
                                  </h4>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    <span>От: {report.emailFrom}</span>
                                    {report.emailSubject && <span className="ml-3">Тема: {report.emailSubject}</span>}
                                  </div>
                                  <div className="bg-background border rounded-md p-3 max-h-60 overflow-y-auto">
                                    <pre className="text-xs whitespace-pre-wrap font-sans">{report.emailBodyRaw || "Текст не доступен"}</pre>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Стр. {page} из {totalPages} ({total} записей)
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialog !== null} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Одобрить отчёт</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">ID рекомендации (привязка)</label>
              <Input
                type="number"
                value={approveReferralId}
                onChange={(e) => setApproveReferralId(e.target.value)}
                placeholder="Оставьте пустым если нет привязки"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Сумма лечения (руб.)</label>
              <Input
                type="number"
                value={approveTreatmentAmount}
                onChange={(e) => setApproveTreatmentAmount(e.target.value)}
                placeholder="0"
              />
              {approveTreatmentAmount && parseFloat(approveTreatmentAmount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Комиссия агента (10%): {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(parseFloat(approveTreatmentAmount) * 0.1)}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Комментарий</label>
              <Textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Необязательно"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Отмена</Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Одобрить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog !== null} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить отчёт</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Причина отклонения</label>
            <Textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Укажите причину (необязательно)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Отмена</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog !== null} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать данные</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">ФИО пациента</label>
              <Input value={editFields.patientName} onChange={(e) => setEditFields(f => ({ ...f, patientName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Клиника</label>
              <Input value={editFields.clinicName} onChange={(e) => setEditFields(f => ({ ...f, clinicName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Дата визита</label>
              <Input value={editFields.visitDate} onChange={(e) => setEditFields(f => ({ ...f, visitDate: e.target.value }))} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <label className="text-sm font-medium">Сумма лечения (руб.)</label>
              <Input type="number" value={editFields.treatmentAmount} onChange={(e) => setEditFields(f => ({ ...f, treatmentAmount: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Услуги</label>
              <Textarea value={editFields.services} onChange={(e) => setEditFields(f => ({ ...f, services: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Отмена</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Referral Dialog */}
      <Dialog open={linkDialog !== null} onOpenChange={() => setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Привязать к рекомендации</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Поиск рекомендации</label>
              <Input
                value={linkSearch}
                onChange={(e) => { setLinkSearch(e.target.value); setSelectedReferralId(null); }}
                placeholder="Введите ФИО пациента или клинику..."
              />
            </div>
            {searchReferrals && searchReferrals.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {searchReferrals.map((ref: any) => (
                  <div
                    key={ref.id}
                    className={`p-2 text-sm cursor-pointer hover:bg-accent transition-colors ${selectedReferralId === ref.id ? "bg-accent" : ""}`}
                    onClick={() => setSelectedReferralId(ref.id)}
                  >
                    <div className="font-medium">#{ref.id} — {ref.patientFullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {ref.clinic || "Клиника не указана"} · {ref.status}
                      {ref.createdAt && ` · ${format(new Date(ref.createdAt), "dd.MM.yy", { locale: ru })}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {linkSearch.length >= 2 && searchReferrals && searchReferrals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Ничего не найдено</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Отмена</Button>
            <Button onClick={handleLink} disabled={!selectedReferralId || linkMutation.isPending}>
              {linkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
              Привязать #{selectedReferralId || "..."}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayoutWrapper>
  );
}
