import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Send, Loader2, Users, CheckCircle2, AlertTriangle, Image } from "lucide-react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";
import { toast } from "sonner";

export default function AdminNotifications() {
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const { data: recipientInfo, isLoading } = trpc.admin.notifications.recipientCount.useQuery();
  const broadcast = trpc.admin.notifications.broadcast.useMutation();

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Введите текст сообщения");
      return;
    }

    if (!recipientInfo || recipientInfo.withTelegram === 0) {
      toast.error("Нет активных агентов с Telegram");
      return;
    }

    setSending(true);
    setLastResult(null);

    try {
      const result = await broadcast.mutateAsync({
        message: message.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });

      setLastResult(result);

      if (result.sent > 0) {
        toast.success(`Отправлено ${result.sent} из ${result.total} агентам`);
      }
      if (result.failed > 0) {
        toast.warning(`Не удалось доставить ${result.failed} агентам`);
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка при отправке");
    } finally {
      setSending(false);
    }
  };

  const charCount = message.length;
  const maxChars = 4000;
  const isOverLimit = charCount > maxChars;

  return (
    <AdminLayoutWrapper>
      <div className="container py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Уведомления агентам
          </h1>
          <p className="text-muted-foreground mt-1">
            Отправить сообщение всем активным агентам через Telegram
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Новое уведомление</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="message">Текст сообщения</Label>
                  <Textarea
                    id="message"
                    placeholder="Введите текст уведомления для агентов...&#10;&#10;Поддерживается HTML-разметка:&#10;<b>жирный</b>, <i>курсив</i>, <a href='url'>ссылка</a>"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    className="resize-y"
                  />
                  <div className={`text-xs text-right ${isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {charCount} / {maxChars}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="flex items-center gap-1.5">
                    <Image className="w-4 h-4" />
                    Картинка (необязательно)
                  </Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Прямая ссылка на изображение (JPG, PNG). Если указана, сообщение отправится как подпись к картинке.
                  </p>
                </div>

                {/* Image preview */}
                {imageUrl.trim() && (
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <img
                      src={imageUrl}
                      alt="Превью"
                      className="max-h-48 object-contain mx-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                      onLoad={(e) => {
                        (e.target as HTMLImageElement).style.display = "block";
                      }}
                    />
                  </div>
                )}

                <Button
                  onClick={handleSend}
                  disabled={sending || !message.trim() || isOverLimit || isLoading}
                  className="w-full sm:w-auto"
                  size="lg"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Отправить всем агентам
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Result card */}
            {lastResult && (
              <Card className={lastResult.failed > 0 ? "border-amber-300" : "border-green-300"}>
                <CardContent className="flex items-start gap-4 py-5">
                  {lastResult.failed === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {lastResult.failed === 0 ? "Уведомление отправлено!" : "Отправлено с ошибками"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Доставлено: <span className="font-medium text-green-600">{lastResult.sent}</span>
                      {lastResult.failed > 0 && (
                        <> / Не доставлено: <span className="font-medium text-red-600">{lastResult.failed}</span></>
                      )}
                      {" "}из {lastResult.total} агентов
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Получатели
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="text-3xl font-bold text-primary">
                        {recipientInfo?.withTelegram ?? 0}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        агентов с Telegram
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground border-t pt-3">
                      Всего агентов: {recipientInfo?.total ?? 0}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Подсказки
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li>
                    <code className="bg-muted px-1 rounded">&lt;b&gt;жирный&lt;/b&gt;</code>
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">&lt;i&gt;курсив&lt;/i&gt;</code>
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">&lt;a href="url"&gt;ссылка&lt;/a&gt;</code>
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">&lt;code&gt;код&lt;/code&gt;</code>
                  </li>
                  <li className="pt-1 border-t">
                    Используйте перенос строки для абзацев
                  </li>
                  <li>
                    Картинка — прямая ссылка (не Google Drive)
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayoutWrapper>
  );
}
