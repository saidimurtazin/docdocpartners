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
import { Loader2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function AdminAgents() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: agents, isLoading, refetch } = trpc.admin.agents.list.useQuery();
  const updateStatus = trpc.admin.agents.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

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

  const handleStatusChange = async (id: number, status: "pending" | "active" | "rejected" | "blocked") => {
    if (confirm(`Изменить статус агента?`)) {
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
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Все агенты ({agents?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
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
                {agents?.map((agent) => (
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
                      {new Intl.NumberFormat("ru-RU", {
                        style: "currency",
                        currency: "RUB",
                      }).format((agent.totalEarnings || 0) / 100)}
                    </TableCell>
                    <TableCell>
                      {agent.inn && agent.bankAccount ? (
                        <div className="text-xs">
                          <div>ИНН: {agent.inn}</div>
                          <div>Счёт: {agent.bankAccount?.slice(-4)}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Не указаны</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {agent.createdAt
                        ? format(new Date(agent.createdAt), "dd.MM.yyyy", { locale: ru })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {agent.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleStatusChange(agent.id, "active")}
                              disabled={updateStatus.isPending}
                            >
                              Активировать
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleStatusChange(agent.id, "rejected")}
                              disabled={updateStatus.isPending}
                            >
                              Отклонить
                            </Button>
                          </>
                        )}
                        {agent.status === "active" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleStatusChange(agent.id, "blocked")}
                            disabled={updateStatus.isPending}
                          >
                            Заблокировать
                          </Button>
                        )}
                        {agent.status === "blocked" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleStatusChange(agent.id, "active")}
                            disabled={updateStatus.isPending}
                          >
                            Разблокировать
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
