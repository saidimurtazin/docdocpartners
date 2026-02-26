import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Send, CheckCircle2, Clock, XCircle, FileText, FileSignature, Banknote, Download, Zap, Gift, Users, Copy, Lock, Unlock, Link2, TrendingUp, Building2, User, Calculator, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import ActSigningDialog from "@/components/ActSigningDialog";
import { toast } from "sonner";

const PAGE_SIZE = 15;

export default function AgentPayments() {
  useRequireAuth();

  const [page, setPage] = useState(1);
  const { data, isLoading: paymentsLoading, refetch } = trpc.dashboard.payments.useQuery(
    { page, pageSize: PAGE_SIZE }
  );
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const requestPayment = trpc.dashboard.requestPayment.useMutation();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [signingPaymentId, setSigningPaymentId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSelfEmployed, setIsSelfEmployed] = useState<boolean | null>(null);

  // Initialize isSelfEmployed from agent profile
  useEffect(() => {
    if (stats?.isSelfEmployed) {
      if (stats.isSelfEmployed === "yes") setIsSelfEmployed(true);
      else if (stats.isSelfEmployed === "no") setIsSelfEmployed(false);
      // "unknown" → stays null, forcing selection
    }
  }, [stats?.isSelfEmployed]);

  // Extract items and total from paginated response
  const payments = data && 'items' in data ? data.items : (data as any[] || []);
  const totalCount = data && 'total' in data ? data.total : payments.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Tax preview calculation (client-side, same logic as server)
  const taxPreview = useMemo(() => {
    const amountNum = parseInt(amount);
    if (!amount || isNaN(amountNum) || amountNum < 1000 || isSelfEmployed === null) return null;

    const grossKopecks = amountNum * 100;
    if (isSelfEmployed) {
      const npdKopecks = Math.floor(grossKopecks * 0.06);
      return {
        gross: amountNum,
        net: amountNum,
        tax: 0,
        social: 0,
        npdEstimate: npdKopecks / 100,
        isSelfEmployed: true,
      };
    }
    const taxKopecks = Math.floor(grossKopecks * 0.13);
    const socialKopecks = Math.floor(grossKopecks * 0.30);
    const netKopecks = grossKopecks - taxKopecks - socialKopecks;
    return {
      gross: amountNum,
      net: netKopecks / 100,
      tax: taxKopecks / 100,
      social: socialKopecks / 100,
      npdEstimate: 0,
      isSelfEmployed: false,
    };
  }, [amount, isSelfEmployed]);

  const handleRequestPayment = async () => {
    setError("");

    const amountNum = parseInt(amount);

    if (!amount || isNaN(amountNum)) {
      setError("Введите корректную сумму");
      return;
    }

    if (amountNum < 1000) {
      setError("Минимальная сумма для вывода — 1 000 ₽");
      return;
    }

    if (isSelfEmployed === null) {
      setError("Выберите налоговый статус (самозанятый или физлицо)");
      return;
    }

    const availBal = (stats?.availableBalance || 0) / 100;
    if (amountNum > availBal) {
      setError(`Недостаточно средств. Доступно: ${availBal.toLocaleString('ru-RU')} ₽`);
      return;
    }

    try {
      const result = await requestPayment.mutateAsync({
        amount: amountNum * 100,
        isSelfEmployed,
      });
      await refetch();
      setAmount("");
      setPage(1); // Go back to first page to see the new payment
      if (result.jumpSubmitted) {
        toast.success("Заявка на выплату создана", {
          description: "Отправлена на обработку. Вы получите уведомление в Telegram.",
        });
      } else {
        toast.success("Заявка на выплату создана", {
          description: "Будет обработана в ближайшее время.",
        });
      }
    } catch (err: any) {
      const message = err?.message || err?.data?.message || "Неизвестная ошибка";
      toast.error("Ошибка запроса выплаты", { description: message });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount / 100);
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
    processing: <Zap className="w-5 h-5 text-purple-500 animate-pulse" />,
    completed: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    failed: <XCircle className="w-5 h-5 text-red-500" />,
  };

  const statusLabels: Record<string, string> = {
    pending: "Ожидает обработки",
    act_generated: "Акт сформирован",
    sent_for_signing: "Ожидает подписания",
    signed: "Акт подписан",
    ready_for_payment: "Готово к оплате",
    processing: "Обрабатывается",
    completed: "Выплачено",
    failed: "Ошибка выплаты",
  };

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
    processing: "bg-purple-100 text-purple-800 border-purple-200",
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
                {/* Tax Status Selector */}
                <div>
                  <Label className="mb-2 block">Налоговый статус</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSelfEmployed(true)}
                      className={`relative flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelfEmployed === true
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-border hover:border-green-300 hover:bg-green-50/50"
                      }`}
                    >
                      <Building2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelfEmployed === true ? "text-green-600" : "text-muted-foreground"}`} />
                      <div>
                        <div className={`text-sm font-semibold ${isSelfEmployed === true ? "text-green-700 dark:text-green-400" : ""}`}>
                          Самозанятый
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Получаю полную сумму, плачу 6% НПД сам
                        </p>
                      </div>
                      {isSelfEmployed === true && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 absolute top-2 right-2" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSelfEmployed(false)}
                      className={`relative flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelfEmployed === false
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                          : "border-border hover:border-blue-300 hover:bg-blue-50/50"
                      }`}
                    >
                      <User className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelfEmployed === false ? "text-blue-600" : "text-muted-foreground"}`} />
                      <div>
                        <div className={`text-sm font-semibold ${isSelfEmployed === false ? "text-blue-700 dark:text-blue-400" : ""}`}>
                          Физлицо
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Удерживается ~43% (НДФЛ 13% + взносы 30%)
                        </p>
                      </div>
                      {isSelfEmployed === false && (
                        <CheckCircle2 className="w-4 h-4 text-blue-500 absolute top-2 right-2" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
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
                      disabled={requestPayment.isPending || !amount || isSelfEmployed === null}
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
                </div>

                {/* Tax Preview */}
                {taxPreview && (
                  <div className={`rounded-lg border-2 p-4 ${
                    taxPreview.isSelfEmployed
                      ? "border-green-200 bg-green-50/50 dark:bg-green-950/10"
                      : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10"
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className={`w-4 h-4 ${taxPreview.isSelfEmployed ? "text-green-600" : "text-blue-600"}`} />
                      <span className="text-sm font-semibold">Расчёт выплаты</span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Начислено</span>
                        <span className="font-medium">{taxPreview.gross.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      {!taxPreview.isSelfEmployed && (
                        <>
                          <div className="flex justify-between text-red-600">
                            <span>НДФЛ 13%</span>
                            <span>-{taxPreview.tax.toLocaleString('ru-RU')} ₽</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Соц. взносы 30%</span>
                            <span>-{taxPreview.social.toLocaleString('ru-RU')} ₽</span>
                          </div>
                          <div className="border-t pt-1.5 mt-1.5">
                            <div className="flex justify-between font-bold text-base">
                              <span>К выплате</span>
                              <span>{taxPreview.net.toLocaleString('ru-RU')} ₽</span>
                            </div>
                          </div>
                        </>
                      )}
                      {taxPreview.isSelfEmployed && (
                        <>
                          <div className="border-t pt-1.5 mt-1.5">
                            <div className="flex justify-between font-bold text-base">
                              <span>К выплате</span>
                              <span className="text-green-700 dark:text-green-400">{taxPreview.net.toLocaleString('ru-RU')} ₽</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>НПД 6% (~{taxPreview.npdEstimate.toLocaleString('ru-RU')} ₽) оплачивается вами самостоятельно</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

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
              <CardTitle>
                История выплат {totalCount > 0 && <span className="text-muted-foreground font-normal text-base ml-2">({totalCount})</span>}
              </CardTitle>
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
                  {payments.map((payment: any) => {
                    const gross = payment.grossAmount || payment.amount;
                    const net = payment.netAmount || payment.amount;
                    const isIndividual = payment.isSelfEmployedSnapshot === "no";
                    const hasTaxInfo = payment.isSelfEmployedSnapshot != null;

                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            {statusIcons[payment.status]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {formatCurrency(gross)}
                              </span>
                              {hasTaxInfo && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  isIndividual
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                }`}>
                                  {isIndividual ? (
                                    <><User className="w-2.5 h-2.5" /> Физлицо</>
                                  ) : (
                                    <><Building2 className="w-2.5 h-2.5" /> СЗ</>
                                  )}
                                </span>
                              )}
                            </div>
                            {isIndividual && net !== gross && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                К выплате: <span className="font-medium">{formatCurrency(net)}</span>
                                <span className="text-red-500 ml-1">
                                  (НДФЛ {formatCurrency(payment.taxAmount || 0)}, взносы {formatCurrency(payment.socialContributions || 0)})
                                </span>
                              </div>
                            )}
                            <div className="text-sm text-muted-foreground">
                              {formatDate(payment.createdAt)}
                            </div>
                            {payment.payoutVia === "jump" && (
                              <div className="flex items-center gap-1 mt-1">
                                <Zap className="w-3 h-3 text-purple-500" />
                                <span className="text-xs text-purple-600">Jump.Finance</span>
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
                          {/* Failed payment — contact support */}
                          {payment.status === "failed" && (
                            <span className="text-xs text-red-500">
                              Обратитесь в поддержку
                            </span>
                          )}
                          {payment.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              Обработано: {formatDate(payment.completedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <div className="text-sm text-muted-foreground">
                        Страница {page} из {totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="gap-1"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Назад
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="gap-1"
                        >
                          Вперёд
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
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
