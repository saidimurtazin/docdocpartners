import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Send, Loader2, Users, CheckCircle2, AlertTriangle, Image, Upload, X, Link2 } from "lucide-react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";
import { toast } from "sonner";

export default function AdminNotifications() {
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"file" | "url">("file");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: recipientInfo, isLoading } = trpc.admin.notifications.recipientCount.useQuery();
  const broadcast = trpc.admin.notifications.broadcast.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Выберите изображение (JPG, PNG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Максимальный размер изображения — 5 МБ");
      return;
    }

    setImageFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImageBase64(base64);
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageBase64(null);
    setImagePreview(null);
    setImageFileName(null);
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
        imageUrl: imageMode === "url" && imageUrl.trim() ? imageUrl.trim() : undefined,
        imageBase64: imageMode === "file" && imageBase64 ? imageBase64 : undefined,
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
  const hasImage = (imageMode === "file" && imageBase64) || (imageMode === "url" && imageUrl.trim());

  const captionLimit = hasImage ? 1024 : maxChars;
  const isOverCaptionLimit = hasImage && charCount > 1024;

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
                    placeholder={"Введите текст уведомления для агентов...\n\nПоддерживается HTML-разметка:\n<b>жирный</b>, <i>курсив</i>, <a href='url'>ссылка</a>"}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    className="resize-y"
                  />
                  <div className={`text-xs text-right ${
                    isOverCaptionLimit ? "text-destructive font-medium" :
                    isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
                  }`}>
                    {charCount} / {captionLimit}
                    {isOverCaptionLimit && (
                      <span className="ml-2">(с картинкой макс. 1024 символа)</span>
                    )}
                  </div>
                </div>

                {/* Image section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Image className="w-4 h-4" />
                      Картинка (необязательно)
                    </Label>
                    <div className="flex gap-1">
                      <Button
                        variant={imageMode === "file" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setImageMode("file"); setImageUrl(""); }}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Файл
                      </Button>
                      <Button
                        variant={imageMode === "url" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setImageMode("url"); clearImage(); }}
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Ссылка
                      </Button>
                    </div>
                  </div>

                  {imageMode === "file" ? (
                    <div>
                      {!imageBase64 ? (
                        <div
                          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Нажмите для загрузки или перетащите файл
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPG, PNG, WebP до 5 МБ
                          </p>
                        </div>
                      ) : (
                        <div className="relative border rounded-lg overflow-hidden bg-muted/30">
                          <img
                            src={imagePreview!}
                            alt="Превью"
                            className="max-h-48 object-contain mx-auto block"
                          />
                          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-t">
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {imageFileName}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={clearImage}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                  ) : (
                    <div>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        type="url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Прямая ссылка на изображение (JPG, PNG)
                      </p>
                      {imageUrl.trim() && (
                        <div className="mt-2 border rounded-lg overflow-hidden bg-muted/30">
                          <img
                            src={imageUrl}
                            alt="Превью"
                            className="max-h-48 object-contain mx-auto"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block"; }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sending || !message.trim() || isOverLimit || isOverCaptionLimit || isLoading}
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
                    С картинкой макс. 1024 символа
                  </li>
                  <li>
                    Без картинки макс. 4000 символов
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
