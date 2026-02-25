import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Upload as UploadIcon, Download, FileSpreadsheet, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ClinicLayoutWrapper from "@/components/ClinicLayoutWrapper";

type UploadPreview = {
  type?: "excel" | "ai";
  matched: { rowIndex: number; patientName: string; birthdate: string; visitDate: string; amount: number; referralId: number; confidence?: number }[];
  notFound: { rowIndex: number; patientName: string; birthdate: string; reason: string }[];
  alreadyTreated: { rowIndex: number; patientName: string; birthdate: string; referralId: number }[];
  errors: { rowIndex: number; message: string }[];
};

// Supported file extensions
const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx", ".doc"];
const ACCEPTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
  "image/png", "image/jpeg", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

function isAcceptedFile(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export default function ClinicUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI upload — all formats go through Gemini AI + fuzzy matching
  const uploadReport = trpc.clinic.uploadReport.useMutation({
    onSuccess: (data: any) => {
      setPreview(data);
      toast.success("AI обработал файл. Проверьте результаты.");
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  const confirmUpload = trpc.clinic.confirmUpload.useMutation({
    onSuccess: (data) => {
      toast.success(`Обновлено ${(data as any).updatedCount} направлений`);
      setPreview(null);
      setFile(null);
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  const downloadTemplate = trpc.clinic.downloadTemplate.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });

  const isUploading = uploadReport.isPending;

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      // All formats go through AI parser + fuzzy matching
      uploadReport.mutate({
        base64,
        filename: selectedFile.name,
        contentType: selectedFile.type || "application/octet-stream",
      });
    };
    reader.readAsDataURL(selectedFile);
  }, [uploadReport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isAcceptedFile(droppedFile.name)) {
      handleFile(droppedFile);
    } else {
      toast.error("Неподдерживаемый формат файла");
    }
  }, [handleFile]);

  const handleConfirm = () => {
    if (!preview?.matched?.length) return;
    confirmUpload.mutate({
      items: preview.matched.map((m) => ({
        referralId: m.referralId,
        visitDate: m.visitDate,
        treatmentAmount: m.amount,
      })),
    });
  };

  return (
    <ClinicLayoutWrapper>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Загрузка отчёта</h1>
          <p className="text-muted-foreground mt-1">
            Загрузите отчёт о пролеченных пациентах в любом формате
          </p>
        </div>

        {/* Template download */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Шаблон Excel</CardTitle>
            <CardDescription>
              Скачайте шаблон, заполните данные о пролеченных пациентах и загрузите обратно
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => downloadTemplate.mutate()}
              disabled={downloadTemplate.isPending}
            >
              {downloadTemplate.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Загрузка...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Скачать шаблон</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* File upload */}
        {!preview && (
          <Card>
            <CardContent className="pt-6">
              <div
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                  ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      AI анализирует файл и ищет совпадения...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {file ? file.name : "Перетащите файл сюда или нажмите для выбора"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Excel (.xlsx, .xls), PDF, изображения (.png, .jpg), Word (.docx, .doc)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI автоматически определит данные о пациентах из файла
                      </p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview results */}
        {preview && (
          <>
            {/* AI badge */}
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-md border border-blue-200">
              <span className="font-medium">🤖 AI-анализ:</span>
              <span>Данные извлечены и сопоставлены искусственным интеллектом. Проверьте корректность перед подтверждением.</span>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{preview.matched.length}</div>
                  <p className="text-sm text-muted-foreground">Найдено</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{preview.notFound.length}</div>
                  <p className="text-sm text-muted-foreground">Не найдено</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{preview.alreadyTreated.length}</div>
                  <p className="text-sm text-muted-foreground">Уже пролечены</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{preview.errors.length}</div>
                  <p className="text-sm text-muted-foreground">Ошибки</p>
                </CardContent>
              </Card>
            </div>

            {/* Matched table */}
            {preview.matched.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-green-600">
                    Найденные совпадения ({preview.matched.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>ФИО (из файла)</TableHead>
                          <TableHead>Найден в системе</TableHead>
                          <TableHead>Дата визита</TableHead>
                          <TableHead>Сумма (руб)</TableHead>
                          <TableHead>Совпадение</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.matched.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell>{m.rowIndex}</TableCell>
                            <TableCell className="font-medium">{m.patientName}</TableCell>
                            <TableCell>
                              <span className="text-sm">{m.birthdate ? `${m.birthdate}` : "—"}</span>
                            </TableCell>
                            <TableCell>{m.visitDate}</TableCell>
                            <TableCell>{m.amount ? `${(m.amount / 100).toLocaleString("ru-RU")} \u20BD` : "—"}</TableCell>
                            <TableCell>
                              {m.confidence ? (
                                <Badge variant={m.confidence >= 90 ? "default" : "outline"} className={m.confidence >= 90 ? "bg-green-500" : m.confidence >= 80 ? "bg-yellow-500 text-white" : "bg-orange-500 text-white"}>
                                  {m.confidence}%
                                </Badge>
                              ) : (
                                <Badge variant="outline">✓</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Not found */}
            {preview.notFound.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-red-500">
                    Не найдено ({preview.notFound.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>ФИО</TableHead>
                          <TableHead>Дата рождения</TableHead>
                          <TableHead>Причина</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.notFound.map((nf, i) => (
                          <TableRow key={i}>
                            <TableCell>{nf.rowIndex}</TableCell>
                            <TableCell>{nf.patientName}</TableCell>
                            <TableCell>{nf.birthdate}</TableCell>
                            <TableCell className="text-muted-foreground">{nf.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Errors */}
            {preview.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-red-400">Ошибки ({preview.errors.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {preview.errors.map((e, i) => (
                      <li key={i} className="text-muted-foreground">#{e.rowIndex}: {e.message}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={() => { setPreview(null); setFile(null); }}>
                Отмена
              </Button>
              {preview.matched.length > 0 && (
                <Button onClick={handleConfirm} disabled={confirmUpload.isPending}>
                  {confirmUpload.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Применение...</>
                  ) : (
                    <><UploadIcon className="w-4 h-4 mr-2" /> Подтвердить ({preview.matched.length})</>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </ClinicLayoutWrapper>
  );
}
