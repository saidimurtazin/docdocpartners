import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Send, CheckCircle2, Clock, XCircle, AlertCircle, FileText, FileSignature, Banknote, Download, Zap, Gift, Users, Copy, Lock, Unlock, Link2, TrendingUp } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

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

    const availBal = (stats?.availableBalance || 0) / 100; // convert from kopecks
    if (amountNum > availBal) {
      setError(`Недостаточно средств. Доступно: ${availBal.toLocaleString('ru-RU')} ₽`);
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

  const availableBalance = (stats?.availableBalance || 0) / 100;
  const totalEarnings = (stats?.totalEarnings || 0) / 100;
  const completedPaymentsSum = (stats?.completedPaymentsSum || 0) / 100;
  const bonusPoints = (stats?.bonusPoints || 0) / 100;
  const paidReferralCount = stats?.paidReferralCount || 0;
  const bonusUnlockThreshold = stats?.bonusUnlockThreshold || 10;
  const bonusUnlocked = paidReferralCount >= bonusUnlockThreshold;
  const referredAgentsCount = stats?.referredAgentsCount || 0;
  const referralLink = stats?.referralLink || '';

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          {/* Balance Overview + Request Payment */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Balance Card — with full breakdown */}
            <Card className="border-2 lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="w-4 h-4" />
                  Доступно для вывода
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-4">
                  {availableBalance.toLocaleString('ru-RU')} ₽
                </div>

                {/* Balance breakdown */}
                <div className="space-y-2 text-sm border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                      Заработано
                    </span>
                    <span className="font-semibold">{totalEarnings.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                      Выплачено
                    </span>
                    <span className="font-semibold">{completedPaymentsSum.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  {bonusPoints > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-amber-500" />
                        Бонус рефералов
                      </span>
                      <span className="font-semibold flex items-center gap-1">
                        {bonusPoints.toLocaleString('ru-RU')} ₽
                        {bonusUnlocked
                          ? <Unlock className="w-3 h-3 text-green-500" />
                          : <Lock className="w-3 h-3 text-amber-500" />
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Bonus unlock progress */}
                {bonusPoints > 0 && !bonusUnlocked && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between text-xs text-amber-700 mb-1.5">
                      <span>Разблокировка бонуса</span>
                      <span className="font-medium">{paidReferralCount}/{bonusUnlockThreshold}</span>
                    </div>
                    <div className="w-full bg-amber-100 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (paidReferralCount / bonusUnlockThreshold) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-amber-600 mt-1">
                      Ещё {bonusUnlockThreshold - paidReferralCount} оплаченных пациентов
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                  Минимум для вывода: 1 000 ₽
                </p>
              </CardContent>
            </Card>

            {/* Request Payment + Referral Link */}
            <Card className="border-2 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" />
                  Запросить выплату
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="amount">Сумма вывода (₽)</Label>
                  <div className="flex gap-2 mt-2">
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
                    />
                    <Button
                      onClick={handleRequestPayment}
                      disabled={requestPayment.isPending || !amount}
                      className="bg-primary hover:bg-primary/90 whitespace-nowrap"
                    >
                      {requestPayment.isPending ? (
                        <>
                          <Send className="w-4 h-4 mr-2 animate-pulse" />
                          Отправка...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Запросить
                        </>
                      )}
                    </Button>
                  </div>
                  {error && (
                    <p className="text-sm text-destructive mt-2">{error}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Выплаты производятся в течение 3-5 рабочих дней
                  </p>
                </div>

                {/* Referral Program — compact inline */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <Gift className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">Реферальная программа</h4>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <strong>{referredAgentsCount}</strong> агентов
                          </span>
                          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                            <Gift className="w-3.5 h-3.5" />
                            {bonusPoints.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Приглашайте коллег — <strong>1 000 ₽</strong> за каждого.
                        {!bonusUnlocked && ` Бонус разблокируется после ${bonusUnlockThreshold} оплаченных пациентов.`}
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={referralLink}
                          readOnly
                          className="text-xs font-mono bg-white/70 dark:bg-background/50 h-8"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyReferralLink}
                          className="h-8 px-3 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
                        >
                          {copied ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                      {copied && <p className="text-xs text-green-600 mt-1">Ссылка скопирована!</p>}
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• Убедитесь, что ваши реквизиты заполнены в профиле</li>
                    <li>• Выплаты обрабатываются только по рабочим дням</li>
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
