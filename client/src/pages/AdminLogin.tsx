import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation();

  const handleRequestOtp = async () => {
    try {
      await requestOtp.mutateAsync({ email });
      setOtpSent(true);
      toast.success("Код отправлен", {
        description: "Проверьте Telegram для получения кода",
      });
    } catch (error: any) {
      toast.error("Ошибка", {
        description: error.message || "Не удалось отправить код",
      });
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const result = await verifyOtp.mutateAsync({ email, code: otpCode });

      // Only allow admin role
      if (result?.role !== "admin") {
        toast.error("Доступ запрещен", {
          description: "Только администраторы могут войти в админ-панель",
        });
        return;
      }

      // Redirect to admin dashboard
      window.location.replace("/");
    } catch (error: any) {
      toast.error("Ошибка", {
        description: error.message || "Неверный код",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-primary" />
            <div className="flex flex-col leading-tight text-left">
              <span className="font-bold text-2xl">Админ-панель</span>
              <span className="text-sm text-muted-foreground">DocDocPartner</span>
            </div>
          </div>
          <p className="text-muted-foreground">Вход для администраторов</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Вход в админ-панель</CardTitle>
            <CardDescription>
              {!otpSent
                ? "Введите email для получения кода"
                : "Введите код из Telegram"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email администратора</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@docdocpartners.ru"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && email) {
                        handleRequestOtp();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleRequestOtp}
                  disabled={!email || requestOtp.isPending}
                  className="w-full"
                >
                  {requestOtp.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    "Получить код"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Код придёт в ваш зарегистрированный Telegram-аккаунт
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="admin-otp">Код из Telegram</Label>
                  <Input
                    id="admin-otp"
                    type="text"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && otpCode) {
                        handleVerifyOtp();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={!otpCode || verifyOtp.isPending}
                  className="w-full"
                >
                  {verifyOtp.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    "Войти"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  className="w-full"
                >
                  Назад
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-4">
          admin.docdocpartners.ru
        </p>
      </div>
    </div>
  );
}
