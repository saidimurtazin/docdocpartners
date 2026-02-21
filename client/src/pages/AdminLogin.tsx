import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { Shield, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const STAFF_ROLES = ["admin", "support", "accountant"];

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
        description: "Проверьте вашу почту для получения кода",
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

      // Only allow staff roles
      if (!result?.role || !STAFF_ROLES.includes(result.role)) {
        toast.error("Доступ запрещен", {
          description: "Только сотрудники могут войти в панель управления",
        });
        return;
      }

      // Redirect to admin dashboard
      window.location.replace("/admin");
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
          <div className="inline-flex mb-4">
            <Logo size={48} textSuffix="Admin" />
          </div>
          <p className="text-muted-foreground">Вход для сотрудников</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Вход в панель</CardTitle>
            <CardDescription>
              {!otpSent
                ? "Введите рабочий email для получения кода"
                : "Введите код из письма или Telegram"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email сотрудника</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="email@example.com"
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
                  Код придёт на вашу рабочую почту и/или в Telegram
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="admin-otp">Код из письма</Label>
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
          DocPartner
        </p>
      </div>
    </div>
  );
}
