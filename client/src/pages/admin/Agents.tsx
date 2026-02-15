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
import { Loader2, ArrowLeft, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useMemo } from "react";

const PAGE_SIZE = 20;

export default function AdminAgents() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: agents, isLoading, refetch } = trpc.admin.agents.list.useQuery();
  const updateStatus = trpc.admin.agents.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });
  const exportAgents = trpc.admin.export.agents.useMutation();

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
              <h1 className="text-2xl font-bold">Агенты</h1>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={exportAgents.isPending}>
              <Download className="w-4 h-4 mr-2" />
              {exportAgents.isPending ? "Экспорт..." : "Excel"}
            </Button>
          </div>
        </div>
      </header>

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
                        {agent.inn || agent.bankAccount ? (
                          <div className="text-xs space-y-0.5">
                            <div>ИНН: {agent.inn || "—"}</div>
                            <div>Банк: {agent.bankName || "—"}</div>
                            <div>Счёт: {agent.bankAccount || "—"}</div>
                            <div>БИК: {agent.bankBik || "—"}</div>
                            <div>СЗ: {agent.isSelfEmployed === "yes" ? "Да" : agent.isSelfEmployed === "no" ? "Нет" : "?"}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Не указаны</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {agent.createdAt ? format(new Date(agent.createdAt), "dd.MM.yyyy", { locale: ru }) : "—"}
                      </TableCell>
                      <TableCell>
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
