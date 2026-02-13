import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Send, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function AgentLogin() {
  const [telegramId, setTelegramId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"telegram" | "otp">("telegram");
  const [, setLocation] = useLocation();

  const requestOTP = trpc.bot.requestTelegramOTP.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setStep("otp");
    },
  });

  const verifyOTP = trpc.bot.verifyTelegramOTP.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        // Redirect to agent cabinet
        setLocation("/agent/cabinet");
      }
    },
  });

  const handleRequestOTP = (e: React.FormEvent) => {
    e.preventDefault();
    requestOTP.mutate({ telegramId });
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOTP.mutate({ sessionId, code: otpCode });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Вход для агентов</CardTitle>
          <CardDescription>
            {step === "telegram" 
              ? "Введите ваш Telegram ID для получения кода" 
              : "Введите код, отправленный в Telegram"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "telegram" ? (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="telegramId" className="text-sm font-medium">
                  Telegram ID
                </label>
                <Input
                  id="telegramId"
                  type="text"
                  placeholder="Например: 123456789"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Ваш Telegram ID можно узнать у бота @userinfobot
                </p>
              </div>

              {requestOTP.error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {requestOTP.error.message}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={requestOTP.isPending}
              >
                {requestOTP.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Получить код
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="otpCode" className="text-sm font-medium">
                  Код подтверждения
                </label>
                <Input
                  id="otpCode"
                  type="text"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  required
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Код действителен 5 минут
                </p>
              </div>

              {verifyOTP.error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {verifyOTP.error.message || "Неверный код"}
                </div>
              )}

              {verifyOTP.data && !verifyOTP.data.success && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  Неверный код или код истёк
                </div>
              )}

              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={verifyOTP.isPending}
                >
                  {verifyOTP.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Войти
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStep("telegram");
                    setOtpCode("");
                    setSessionId("");
                  }}
                >
                  Назад
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Ещё не зарегистрированы?{" "}
              <a href="https://t.me/maruspartnersbot" className="text-primary hover:underline">
                Начните в Telegram
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
