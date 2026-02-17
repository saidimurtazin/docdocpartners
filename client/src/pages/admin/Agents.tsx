import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Download, Search, ChevronLeft, ChevronRight, X, CreditCard, Smartphone, Building2, Shield, Percent, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useMemo } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

const PAGE_SIZE = 20;

export default function AdminAgents() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: agents, isLoading, refetch } = trpc.admin.agents.list.useQuery();
  const { data: clinicsList } = trpc.admin.clinics.list.useQuery();
  const updateStatus = trpc.admin.agents.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });
  const removeExcludedClinic = trpc.admin.agents.removeExcludedClinic.useMutation({
    onSuccess: () => refetch(),
  });
  const verifyViaJump = trpc.admin.agents.verifyViaJump.useMutation({
    onSuccess: (data) => { alert(data.message); refetch(); },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const updateSelfEmployment = trpc.admin.agents.updateSelfEmployment.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const updateCommissionOverride = trpc.admin.agents.updateCommissionOverride.useMutation({
    onSuccess: () => { refetch(); setEditingCommissionId(null); },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const hardDeleteAgent = trpc.admin.agents.hardDelete.useMutation({
    onSuccess: (data) => { alert(`Агент "${data.agentName}" удалён`); refetch(); },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const exportAgents = trpc.admin.export.agents.useMutation();

  // Commission override dialog state
  const [editingCommissionId, setEditingCommissionId] = useState<number | null>(null);
  const [agentTiers, setAgentTiers] = useState<{minMonthlyRevenue: number; commissionRate: number}[]>([]);

  // Helper: parse excludedClinics JSON and resolve names
  const getExcludedClinicNames = (excludedJson: string | null): { id: number; name: string }[] => {
    if (!excludedJson) return [];
    try {
      const ids: number[] = JSON.parse(excludedJson);
      if (!Array.isArray(ids)) return [];
      return ids.map(id => {
        const clinic = clinicsList?.find((c: any) => c.id === id);
        return { id, name: clinic?.name || `Клиника #${id}` };
      });
    } catch { return []; }
  };

  const handleRemoveExcludedClinic = async (agentId: number, clinicId: number) => {
    await removeExcludedClinic.mutateAsync({ agentId, clinicId });
  };

  // Filter + search
  const filtered = useMemo(() => {
    if (!agents) return [];
    return agents.filter(agent => {
      const matchSearch = !search ||
        agent.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (agent.email?.toLowerCase().includes(search.toLowerCase())) ||
        (agent.phone?.includes(search)) ||
        (agent.city?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" || agent.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [agents, search, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleStatusChange = (v: string) => { setStatusFilter(v); setPage(1); };

  const handleExport = async () => {
    try {
      const result = await exportAgents.mutateAsync({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      // Download base64 as file
      const blob = new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agents_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
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
      active: "default",
      rejected: "destructive",
      blocked: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      active: "Активен",
      rejected: "Отклонён",
      blocked: "Заблокирован",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const handleStatusChangeAction = async (id: number, status: "pending" | "active" | "rejected" | "blocked") => {
    if (confirm("Изменить статус агента?")) {
      await updateStatus.mutateAsync({ id, status });
    }
  };

  return (
    <AdminLayoutWrapper>
      <div className="container py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Все агенты ({filtered.length})</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по ФИО, email, телефону..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="active">Активен</SelectItem>
                    <SelectItem value="rejected">Отклонён</SelectItem>
                    <SelectItem value="blocked">Заблокирован</SelectItem>
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
                    <TableHead>ФИО</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Город</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Рекомендаций</TableHead>
                    <TableHead>Заработано</TableHead>
                    <TableHead>Реквизиты</TableHead>
                    <TableHead>Исключения</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>{agent.id}</TableCell>
                      <TableCell className="font-medium">{agent.fullName}</TableCell>
                      <TableCell>{agent.email || "—"}</TableCell>
                      <TableCell>{agent.phone || "—"}</TableCell>
                      <TableCell>{agent.role || "—"}</TableCell>
                      <TableCell>{agent.city || "—"}</TableCell>
                      <TableCell>{getStatusBadge(agent.status)}</TableCell>
                      <TableCell>{agent.totalReferrals}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format((agent.totalEarnings || 0) / 100)}
                      </TableCell>
                      <TableCell>
                        {agent.inn || agent.bankAccount || (agent as any).cardNumber ? (
                          <div className="text-xs space-y-0.5">
                            <div>ИНН: {agent.inn || "—"}</div>
                            {/* Payout method */}
                            <div className="flex items-center gap-1">
                              {(agent as any).payoutMethod === "sbp" ? (
                                <><Smartphone className="w-3 h-3 text-blue-500" /> СБП: {agent.phone || "—"}</>
                              ) : (agent as any).payoutMethod === "bank_account" ? (
                                <><Building2 className="w-3 h-3" /> {agent.bankName || "—"} / {agent.bankAccount?.slice(-4) || "—"}</>
                              ) : (
                                <><CreditCard className="w-3 h-3 text-amber-500" /> {(agent as any).cardNumber ? `**** ${(agent as any).cardNumber.slice(-4)}` : "—"}</>
                              )}
                            </div>
                            {/* Self-employment */}
                            <div className="flex items-center gap-1">
                              СЗ: {agent.isSelfEmployed === "yes" ? (
                                <Badge variant="default" className="text-[10px] px-1 py-0 h-4">Да</Badge>
                              ) : agent.isSelfEmployed === "no" ? (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">Нет</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">?</Badge>
                              )}
                              {(agent as any).jumpIdentified && (
                                <span title="Верифицирован в Jump"><Shield className="w-3 h-3 text-green-500" /></span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Не указаны</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {(() => {
                          const excluded = getExcludedClinicNames((agent as any).excludedClinics);
                          if (excluded.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {excluded.map(c => (
                                <span key={c.id} className="inline-flex items-center gap-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs leading-tight">
                                  <span className="truncate max-w-[140px]">{c.name}</span>
                                  <button
                                    onClick={() => handleRemoveExcludedClinic(agent.id, c.id)}
                                    className="ml-0.5 hover:bg-red-200 rounded-full p-0.5"
                                    title="Убрать из исключений"
                                    disabled={removeExcludedClinic.isPending}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {agent.createdAt ? format(new Date(agent.createdAt), "dd.MM.yyyy", { locale: ru }) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            {agent.status === "pending" && (
                              <>
                                <Button size="sm" variant="default" onClick={() => handleStatusChangeAction(agent.id, "active")} disabled={updateStatus.isPending}>
                                  Активировать
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleStatusChangeAction(agent.id, "rejected")} disabled={updateStatus.isPending}>
                                  Отклонить
                                </Button>
                              </>
                            )}
                            {agent.status === "active" && (
                              <Button size="sm" variant="destructive" onClick={() => handleStatusChangeAction(agent.id, "blocked")} disabled={updateStatus.isPending}>
                                Заблокировать
                              </Button>
                            )}
                            {agent.status === "blocked" && (
                              <Button size="sm" variant="default" onClick={() => handleStatusChangeAction(agent.id, "active")} disabled={updateStatus.isPending}>
                                Разблокировать
                              </Button>
                            )}
                          </div>
                          {/* Jump verification */}
                          {agent.inn && !(agent as any).jumpIdentified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verifyViaJump.mutate({ agentId: agent.id })}
                              disabled={verifyViaJump.isPending}
                              className="text-xs"
                            >
                              <Shield className="w-3 h-3 mr-1" />
                              Проверить Jump
                            </Button>
                          )}
                          {/* Self-employment toggle */}
                          {agent.isSelfEmployed !== "yes" && agent.inn && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateSelfEmployment.mutate({ agentId: agent.id, isSelfEmployed: "yes" })}
                              disabled={updateSelfEmployment.isPending}
                              className="text-xs text-muted-foreground"
                            >
                              СЗ: Да
                            </Button>
                          )}
                          {agent.isSelfEmployed === "yes" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateSelfEmployment.mutate({ agentId: agent.id, isSelfEmployed: "no" })}
                              disabled={updateSelfEmployment.isPending}
                              className="text-xs text-muted-foreground"
                            >
                              СЗ: Нет
                            </Button>
                          )}
                          {/* Commission override */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCommissionId(agent.id);
                              try {
                                const parsed = JSON.parse((agent as any).commissionOverride || "[]");
                                setAgentTiers(Array.isArray(parsed) ? parsed : []);
                              } catch { setAgentTiers([]); }
                            }}
                            className="text-xs"
                          >
                            % Ставка
                          </Button>
                          {/* Hard delete */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Удалить агента "${agent.fullName}" и ВСЕ связанные данные? Это необратимо!`)) {
                                hardDeleteAgent.mutate({ agentId: agent.id });
                              }
                            }}
                            disabled={hardDeleteAgent.isPending}
                            className="text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
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

      {/* Commission Override Dialog */}
      <Dialog open={editingCommissionId !== null} onOpenChange={() => setEditingCommissionId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Индивидуальная ставка агента
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Если пусто — используются глобальные тарифы. Если заданы — перекрывают глобальные.
          </p>
          <div className="space-y-2">
            {agentTiers.map((tier, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Мин. выручка (руб.)"
                  value={tier.minMonthlyRevenue / 100 || ""}
                  onChange={(e) => {
                    const updated = [...agentTiers];
                    updated[idx] = { ...updated[idx], minMonthlyRevenue: Math.round((parseFloat(e.target.value) || 0) * 100) };
                    setAgentTiers(updated);
                  }}
                  className="w-40"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <Input
                  type="number"
                  placeholder="%"
                  value={tier.commissionRate || ""}
                  onChange={(e) => {
                    const updated = [...agentTiers];
                    updated[idx] = { ...updated[idx], commissionRate: parseInt(e.target.value) || 0 };
                    setAgentTiers(updated);
                  }}
                  className="w-20"
                />
                <span className="text-xs">%</span>
                <Button variant="ghost" size="sm" onClick={() => setAgentTiers(agentTiers.filter((_, i) => i !== idx))}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setAgentTiers([...agentTiers, { minMonthlyRevenue: 0, commissionRate: 10 }])}>
              + Добавить уровень
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCommissionId(null)}>Отмена</Button>
            <Button onClick={async () => {
              if (editingCommissionId) {
                await updateCommissionOverride.mutateAsync({
                  agentId: editingCommissionId,
                  commissionOverride: agentTiers.length > 0 ? JSON.stringify(agentTiers) : null,
                });
              }
            }} disabled={updateCommissionOverride.isPending}>
              {updateCommissionOverride.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayoutWrapper>
  );
}
