import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardList, Clock, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Новая", variant: "secondary", icon: Clock },
  in_progress: { label: "В работе", variant: "default", icon: PlayCircle },
  completed: { label: "Выполнена", variant: "outline", icon: CheckCircle2 },
  cancelled: { label: "Отменена", variant: "destructive", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Низкий", color: "text-muted-foreground" },
  normal: { label: "Обычный", color: "text-foreground" },
  high: { label: "Высокий", color: "text-amber-600" },
  urgent: { label: "Срочный", color: "text-red-600 font-bold" },
};

const TYPE_LABELS: Record<string, string> = {
  contact_patient: "Связаться с пациентом",
  schedule_appointment: "Записать на приём",
  confirm_visit: "Подтвердить визит",
  manual: "Ручная задача",
};

const LOAD_MORE_STEP = 10;

export default function AdminTasks() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_STEP);

  const { data: tasks, isLoading, refetch } = trpc.admin.tasks.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );
  const { data: stats } = trpc.admin.tasks.stats.useQuery();
  const updateStatus = trpc.admin.tasks.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const handleFilterChange = (v: string) => {
    setStatusFilter(v);
    setVisibleCount(LOAD_MORE_STEP);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || !["admin", "support"].includes(user.role)) {
    setLocation("/admin");
    return null;
  }

  const visible = tasks?.slice(0, visibleCount) || [];

  return (
    <AdminLayoutWrapper>
      <div className="container py-8 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleFilterChange("pending")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                  <p className="text-xs text-muted-foreground">Новые</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleFilterChange("in_progress")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <PlayCircle className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.inProgress || 0}</p>
                  <p className="text-xs text-muted-foreground">В работе</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleFilterChange("completed")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.completed || 0}</p>
                  <p className="text-xs text-muted-foreground">Выполнены</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleFilterChange("all")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {(stats?.pending || 0) + (stats?.inProgress || 0) + (stats?.completed || 0) + (stats?.cancelled || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Всего</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task list */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Задачи ({tasks?.length || 0})</CardTitle>
              <Select value={statusFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Новые</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="completed">Выполненные</SelectItem>
                  <SelectItem value="cancelled">Отменённые</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {visible.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Нет задач</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((task) => {
                  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <div
                      key={task.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className="w-4 h-4 shrink-0" />
                            <span className="font-medium truncate">{task.title}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant={statusCfg.variant} className="text-xs">
                              {statusCfg.label}
                            </Badge>
                            <span className={`text-xs ${priorityCfg.color}`}>
                              {priorityCfg.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {TYPE_LABELS[task.type] || task.type}
                            </span>
                            {task.referralId && (
                              <span className="text-xs text-muted-foreground">
                                Рек. #{task.referralId}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {task.createdAt ? format(new Date(task.createdAt), "dd.MM.yyyy HH:mm", { locale: ru }) : ""}
                            </span>
                          </div>
                          {task.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{task.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {task.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus.mutate({ id: task.id, status: "in_progress" })}
                              disabled={updateStatus.isPending}
                            >
                              Взять
                            </Button>
                          )}
                          {task.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={() => updateStatus.mutate({ id: task.id, status: "completed" })}
                              disabled={updateStatus.isPending}
                            >
                              Выполнено
                            </Button>
                          )}
                          {(task.status === "pending" || task.status === "in_progress") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => updateStatus.mutate({ id: task.id, status: "cancelled" })}
                              disabled={updateStatus.isPending}
                            >
                              Отменить
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Show more */}
            {tasks && visibleCount < tasks.length && (
              <div className="flex flex-col items-center gap-2 mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Показано {visibleCount} из {tasks.length}
                </p>
                <Button variant="outline" onClick={() => setVisibleCount(v => v + LOAD_MORE_STEP)}>
                  Показать ещё ({Math.min(LOAD_MORE_STEP, tasks.length - visibleCount)})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayoutWrapper>
  );
}
