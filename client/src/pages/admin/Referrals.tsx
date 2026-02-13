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
import { Loader2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";

export default function AdminReferrals() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [treatmentAmount, setTreatmentAmount] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");

  const { data: referrals, isLoading, refetch } = trpc.admin.referrals.list.useQuery();
  const updateStatus = trpc.admin.referrals.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const updateAmounts = trpc.admin.referrals.updateAmounts.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
      setTreatmentAmount("");
      setCommissionAmount("");
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
    // Auto-calculate 10% commission
    setCommissionAmount(String((treatment * 0.1).toFixed(2)));
  };

  const handleTreatmentAmountChange = (value: string) => {
    setTreatmentAmount(value);
    // Auto-calculate 10% commission
    const treatment = parseFloat(value) || 0;
    setCommissionAmount(String((treatment * 0.1).toFixed(2)));
  };

  const handleSaveAmounts = async (id: number) => {
    const treatment = Math.round(parseFloat(treatmentAmount) * 100);
    const commission = Math.round(parseFloat(commissionAmount) * 100);
    await updateAmounts.mutateAsync({
      id,
      treatmentAmount: treatment,
      commissionAmount: commission,
    });
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
              <h1 className="text-2xl font-bold">Рекомендации пациентов</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Все рекомендации ({referrals?.length || 0})</CardTitle>
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
                  {referrals?.map((referral) => (
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
                          <Input
                            type="number"
                            value={treatmentAmount}
                            onChange={(e) => handleTreatmentAmountChange(e.target.value)}
                            className="w-24"
                            placeholder="0.00"
                          />
                        ) : (
                          formatCurrency(referral.treatmentAmount || 0)
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === referral.id ? (
                          <Input
                            type="number"
                            value={commissionAmount}
                            onChange={(e) => setCommissionAmount(e.target.value)}
                            className="w-24"
                            placeholder="0.00"
                          />
                        ) : (
                          formatCurrency(referral.commissionAmount || 0)
                        )}
                      </TableCell>
                      <TableCell>
                        {referral.createdAt
                          ? format(new Date(referral.createdAt), "dd.MM.yyyy", { locale: ru })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {editingId === referral.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleSaveAmounts(referral.id)}
                                disabled={updateAmounts.isPending}
                              >
                                Сохранить
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                              >
                                Отмена
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditAmounts(referral)}
                              >
                                Редактировать
                              </Button>
                              <Select
                                value={referral.status}
                                onValueChange={(value) =>
                                  handleStatusChange(
                                    referral.id,
                                    value as "pending" | "contacted" | "scheduled" | "completed" | "cancelled"
                                  )
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
