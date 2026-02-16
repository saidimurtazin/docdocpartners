import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { FileText, Download, Loader2, CheckCircle2, RefreshCw } from "lucide-react";

interface ActSigningDialogProps {
  paymentId: number;
  isOpen: boolean;
  onClose: () => void;
  onSigned: () => void;
}

export default function ActSigningDialog({ paymentId, isOpen, onClose, onSigned }: ActSigningDialogProps) {
  const [otpValue, setOtpValue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { data: act, isLoading } = trpc.dashboard.getPaymentAct.useQuery(
    { paymentId },
    { enabled: isOpen }
  );

  const signAct = trpc.dashboard.signAct.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError("");
      setTimeout(() => {
        onSigned();
        onClose();
      }, 1500);
    },
    onError: (err) => {
      setError(err.message || "Неверный код. Попробуйте снова.");
      setOtpValue("");
    },
  });

  const resendOtp = trpc.dashboard.resendActOtp.useMutation({
    onSuccess: () => {
      setResendCooldown(60);
      setError("");
    },
    onError: (err) => {
      setError(err.message || "Ошибка отправки кода");
    },
  });

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setOtpValue("");
      setError("");
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSign = () => {
    if (!act || otpValue.length !== 6) return;
    signAct.mutate({ actId: act.id, code: otpValue });
  };

  const handleResend = () => {
    if (!act || resendCooldown > 0) return;
    resendOtp.mutate({ actId: act.id });
  };

  const formatMoney = (kopecks: number) => {
    return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " ₽";
  };

  const formatDate = (d: string | Date) => {
    return new Date(d).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Подписание акта
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {success && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-lg font-semibold text-green-700">Акт подписан!</p>
            <p className="text-sm text-muted-foreground">Выплата будет произведена в ближайшее время.</p>
          </div>
        )}

        {!isLoading && !success && act && (
          <div className="space-y-5">
            {/* Act summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Акт №:</span>
                <span className="font-medium">{act.actNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Дата:</span>
                <span>{formatDate(act.actDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Сумма:</span>
                <span className="font-bold text-lg">{formatMoney(act.totalAmount)}</span>
              </div>
            </div>

            {/* Download PDF */}
            <a
              href={`/api/acts/${act.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="w-4 h-4" />
              Скачать акт (PDF)
            </a>

            {/* OTP input */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Введите 6-значный код, отправленный вам в Telegram:
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={(value) => {
                    setOtpValue(value);
                    setError("");
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSign}
                disabled={otpValue.length !== 6 || signAct.isPending}
                className="w-full"
              >
                {signAct.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Подписать акт
              </Button>

              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || resendOtp.isPending}
                className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                {resendCooldown > 0
                  ? `Отправить повторно (${resendCooldown}с)`
                  : "Отправить код повторно"
                }
              </button>
            </div>
          </div>
        )}

        {!isLoading && !success && !act && (
          <p className="text-center text-muted-foreground py-4">Акт не найден</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
