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
import { Loader2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";

export default function AdminPayments() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [transactionId, setTransactionId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: payments, isLoading, refetch } = trpc.admin.payments.list.useQuery();
  const updateStatus = trpc.admin.payments.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
      setTransactionId("");
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
      processing: "default",
      completed: "default",
      failed: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "Ожидает",
      processing: "Обрабатывается",
      completed: "Выплачено",
      failed: "Ошибка",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const handleStatusChange = async (
    id: number,
    status: "pending" | "processing" | "completed" | "failed"
  ) => {
    const txId = status === "completed" ? transactionId : undefined;
    await updateStatus.mutateAsync({ id, status, transactionId: txId });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(amount / 100);
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
              <h1 className="text-2xl font-bold">Выплаты</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Все выплаты ({payments?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>ID Агента</TableHead>
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
                {payments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.id}</TableCell>
                    <TableCell>{payment.agentId}</TableCell>
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
                        {payment.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingId(payment.id);
                              }}
                            >
                              Обработать
                            </Button>
                          </>
                        )}
                        {editingId === payment.id && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(payment.id, "completed")}
                              disabled={updateStatus.isPending}
                            >
                              Выплачено
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleStatusChange(payment.id, "failed")}
                              disabled={updateStatus.isPending}
                            >
                              Ошибка
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setTransactionId("");
                              }}
                            >
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
