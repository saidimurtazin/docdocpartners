import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Send, CheckCircle2, Clock, XCircle, AlertCircle, FileText, FileSignature, Banknote, Download, Zap } from "lucide-react";
import { useState } from "react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import ActSigningDialog from "@/components/ActSigningDialog";

export default function AgentPayments() {
  useRequireAuth();
  const { data: payments, isLoading: paymentsLoading, refetch } = trpc.dashboard.payments.useQuery();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const requestPayment = trpc.dashboard.requestPayment.useMutation();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [signingPaymentId, setSigningPaymentId] = useState<number | null>(null);

  const handleRequestPayment = async () => {
    setError("");
    
    const amountNum = parseInt(amount);
    
    // Validation
    if (!amount || isNaN(amountNum)) {
      setError("Введите корректную сумму");
      return;
    }
    
    if (amountNum < 1000) {
      setError("Минимальная сумма для вывода — 1 000 ₽");
      return;
    }

    const availableBalance = (stats?.totalEarnings || 0) / 100; // convert from kopecks
    if (amountNum > availableBalance) {
      setError(`Недостаточно средств. Доступно: ${availableBalance.toLocaleString('ru-RU')} ₽`);
      return;
    }

    try {
      await requestPayment.mutateAsync({ amount: amountNum * 100 }); // convert to kopecks
      await refetch();
      setAmount("");
      alert("✅ Заявка на выплату успешно создана!");
    } catch (error) {
      alert("❌ Ошибка создания заявки. Попробуйте еще раз.");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount / 100); // convert from kopecks
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-5 h-5 text-amber-500" />,
    act_generated: <FileText className="w-5 h-5 text-blue-500" />,
    sent_for_signing: <FileSignature className="w-5 h-5 text-amber-500" />,
    signed: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    ready_for_payment: <Banknote className="w-5 h-5 text-green-600" />,
    processing: <AlertCircle className="w-5 h-5 text-blue-500" />,
    completed: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    failed: <XCircle className="w-5 h-5 text-red-500" />,
  };

  const statusLabels: Record<string, string> = {
    pending: "Ожидает обработки",
    act_generated: "Акт сформирован",
    sent_for_signing: "Ожидает подписания",
    signed: "Акт подписан",
    ready_for_payment: "Готово к оплате",
    processing: "В обработке",
    completed: "Выплачено",
    failed: "Ошибка",
  };

  // Jump.Finance status labels (jumpStatus field, 1-8)
  const jumpStatusLabels: Record<number, string> = {
    1: "Выплачено",
    2: "Отклонено",
    3: "Обрабатывается",
    4: "Ожидает оплаты",
    5: "Ошибка",
    6: "Удалён",
    7: "Ожидает подтверждения",
    8: "Ожидает подписания",
  };

  const getPaymentStatusLabel = (payment: any) => {
    if (payment.payoutVia === "jump" && payment.jumpStatus) {
      return jumpStatusLabels[payment.jumpStatus] || statusLabels[payment.status] || payment.status;
    }
    return statusLabels[payment.status] || payment.status;
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    act_generated: "bg-blue-100 text-blue-800 border-blue-200",
    sent_for_signing: "bg-amber-100 text-amber-800 border-amber-200",
    signed: "bg-green-100 text-green-800 border-green-200",
    ready_for_payment: "bg-emerald-100 text-emerald-800 border-emerald-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };

  if (paymentsLoading) {
    return (
      <DashboardLayoutWrapper>
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <Wallet className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Загрузка данных...</p>
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  const availableBalance = (stats?.totalEarnings || 0) / 100;

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
          <div className="container">
            <h1 className="text-4xl font-bold mb-2">Выплаты</h1>
            <p className="text-primary-foreground/80">Запрос выплат и история транзакций</p>
          </div>
        </div>

        <div className="container py-8 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Balance Card */}
            <Card className="border-2 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Доступно для вывода</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {availableBalance.toLocaleString('ru-RU')} ₽
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Минимум для вывода: 1 000 ₽
                </p>
              </CardContent>
            </Card>

            {/* Request Payment Card */}
            <Card className="border-2 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Запросить выплату
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="amount">Сумма вывода (₽)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError("");
                    }}
                    placeholder="1000"
                    min="1000"
                    className="mt-2"
                  />
                  {error && (
                    <p className="text-sm text-destructive mt-2">{error}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    Выплаты производятся в течение 3-5 рабочих дней
                  </p>
                </div>

                <Button
                  onClick={handleRequestPayment}
                  disabled={requestPayment.isPending || !amount}
                  className="bg-primary hover:bg-primary/90"
                >
                  {requestPayment.isPending ? (
                    <>
                      <Send className="w-4 h-4 mr-2 animate-pulse" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Запросить выплату
                    </>
                  )}
                </Button>

                {/* Info Box */}
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-4">
                  <h4 className="font-semibold text-primary mb-2">💡 Важная информация</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Убедитесь, что ваши реквизиты заполнены в профиле</li>
                    <li>• Выплаты обрабатываются только по рабочим дням</li>
                    <li>• При возникновении вопросов свяжитесь с поддержкой</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment History */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>История выплат</CardTitle>
            </CardHeader>
            <CardContent>
              {!payments || payments.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Пока нет выплат</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Запросите первую выплату, когда накопится достаточно средств
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {statusIcons[payment.status]}
                        </div>
                        <div>
                          <div className="font-semibold">
                            {formatCurrency(payment.amount)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(payment.createdAt)}
                          </div>
                          {payment.payoutVia === "jump" && (
                            <div className="flex items-center gap-1 mt-1">
                              <Zap className="w-3 h-3 text-amber-500" />
                              <span className="text-xs text-muted-foreground">Jump.Finance</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                            statusColors[payment.status] || "bg-gray-100 text-gray-800 border-gray-200"
                          }`}
                        >
                          {getPaymentStatusLabel(payment)}
                        </span>
                        {/* OTP signing — only for manual (non-Jump) payments */}
                        {payment.status === "sent_for_signing" && payment.payoutVia !== "jump" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setSigningPaymentId(payment.id)}
                            className="text-xs"
                          >
                            <FileSignature className="w-3 h-3 mr-1" />
                            Подписать акт
                          </Button>
                        )}
                        {/* Jump: awaiting signature message */}
                        {payment.payoutVia === "jump" && payment.jumpStatus === 8 && (
                          <span className="text-xs text-amber-600">
                            Подпишите документы в Jump.Finance
                          </span>
                        )}
                        {payment.processedAt && (
                          <div className="text-xs text-muted-foreground">
                            Обработано: {formatDate(payment.processedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Act Signing Dialog */}
      {signingPaymentId && (
        <ActSigningDialog
          paymentId={signingPaymentId}
          isOpen={!!signingPaymentId}
          onClose={() => setSigningPaymentId(null)}
          onSigned={() => {
            setSigningPaymentId(null);
            refetch();
          }}
        />
      )}
    </DashboardLayoutWrapper>
  );
}
