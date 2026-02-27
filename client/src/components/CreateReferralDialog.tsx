/**
 * Shared dialog for creating a new referral.
 * Used by AgentDashboard and AgentReferrals to avoid code duplication.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

/** Auto-format date input: 01012015 → 01.01.2015 */
function formatDateMask(value: string, prev: string): string {
  // Only allow digits and dots
  const raw = value.replace(/[^\d]/g, "");
  // If user is deleting, let them delete freely
  if (value.length < prev.length) {
    return value;
  }
  // Build formatted string
  let result = "";
  for (let i = 0; i < raw.length && i < 8; i++) {
    if (i === 2 || i === 4) result += ".";
    result += raw[i];
  }
  return result;
}

interface CreateReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pre-selected clinic id (e.g. from AgentClinics "Направить пациента" button) */
  initialClinicId?: number;
}

export default function CreateReferralDialog({
  open,
  onOpenChange,
  onSuccess,
  initialClinicId,
}: CreateReferralDialogProps) {
  const { data: clinicsList } = trpc.dashboard.clinics.useQuery();
  const createReferral = trpc.dashboard.createReferral.useMutation();

  const [formData, setFormData] = useState({
    patientFullName: "",
    patientBirthdate: "",
    patientCity: "",
    patientPhone: "",
    patientEmail: "",
    notes: "",
  });
  const [contactConsent, setContactConsent] = useState(false);
  const [selectedClinicIds, setSelectedClinicIds] = useState<number[]>([]);
  const [formError, setFormError] = useState("");

  // Pre-select clinic from URL param
  useEffect(() => {
    if (initialClinicId && open) {
      setSelectedClinicIds((prev) =>
        prev.includes(initialClinicId) ? prev : [initialClinicId]
      );
    }
  }, [initialClinicId, open]);

  const resetForm = () => {
    setFormData({
      patientFullName: "",
      patientBirthdate: "",
      patientCity: "",
      patientPhone: "",
      patientEmail: "",
      notes: "",
    });
    setContactConsent(false);
    setSelectedClinicIds(initialClinicId ? [initialClinicId] : []);
    setFormError("");
  };

  const toggleClinicSelection = (clinicId: number) => {
    setSelectedClinicIds((prev) =>
      prev.includes(clinicId)
        ? prev.filter((id) => id !== clinicId)
        : [...prev, clinicId]
    );
  };

  const handleCreate = async () => {
    setFormError("");

    if (!formData.patientFullName.trim()) {
      setFormError("Укажите ФИО пациента");
      return;
    }
    const nameWords = formData.patientFullName.trim().split(/\s+/);
    if (nameWords.length !== 3) {
      setFormError("Укажите Фамилию, Имя и Отчество пациента (ровно 3 слова)");
      return;
    }
    if (!formData.patientBirthdate.trim()) {
      setFormError("Укажите дату рождения");
      return;
    }
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(formData.patientBirthdate)) {
      setFormError("Формат даты: ДД.ММ.ГГГГ (например, 15.03.1985)");
      return;
    }
    const [dd, mm, yyyy] = formData.patientBirthdate.split(".").map(Number);
    const birthDate = new Date(yyyy, mm - 1, dd);
    if (
      birthDate.getDate() !== dd ||
      birthDate.getMonth() !== mm - 1 ||
      birthDate.getFullYear() !== yyyy
    ) {
      setFormError("Указана несуществующая дата");
      return;
    }
    const ageDiff = Date.now() - birthDate.getTime();
    const ageYears = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
    if (ageYears < 0 || ageYears > 120) {
      setFormError("Возраст пациента должен быть от 0 до 120 лет");
      return;
    }

    if (contactConsent && !formData.patientPhone.trim()) {
      setFormError("Укажите телефон пациента — он обязателен при запросе на связь");
      return;
    }

    // Derive clinic name from first selected clinic (for backward compat)
    const firstClinic = selectedClinicIds.length > 0
      ? clinicsList?.find((c: any) => c.id === selectedClinicIds[0])
      : null;

    try {
      await createReferral.mutateAsync({
        patientFullName: formData.patientFullName.trim(),
        patientBirthdate: formData.patientBirthdate.trim(),
        patientCity: formData.patientCity.trim() || undefined,
        patientPhone: formData.patientPhone.trim() || undefined,
        patientEmail: formData.patientEmail.trim() || undefined,
        contactConsent,
        clinic: firstClinic?.name || undefined,
        targetClinicIds: selectedClinicIds.length > 0 ? selectedClinicIds : undefined,
        notes: formData.notes.trim() || undefined,
      });
      toast.success("Рекомендация успешно создана!");
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      const msg = error?.message || "Ошибка создания рекомендации";
      setFormError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Новая рекомендация</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2 overflow-y-auto flex-1 pr-1">
          {/* Patient name */}
          <div>
            <Label htmlFor="crd-patientFullName">ФИО пациента *</Label>
            <Input
              id="crd-patientFullName"
              placeholder="Иванов Иван Иванович"
              value={formData.patientFullName}
              onChange={(e) =>
                setFormData({ ...formData, patientFullName: e.target.value })
              }
            />
          </div>

          {/* Birthdate */}
          <div>
            <Label htmlFor="crd-patientBirthdate">Дата рождения *</Label>
            <Input
              id="crd-patientBirthdate"
              placeholder="ДД.ММ.ГГГГ"
              maxLength={10}
              inputMode="numeric"
              value={formData.patientBirthdate}
              onChange={(e) =>
                setFormData({ ...formData, patientBirthdate: formatDateMask(e.target.value, formData.patientBirthdate) })
              }
            />
          </div>

          {/* City */}
          <div>
            <Label htmlFor="crd-patientCity">Город</Label>
            <Input
              id="crd-patientCity"
              placeholder="Москва"
              value={formData.patientCity}
              onChange={(e) =>
                setFormData({ ...formData, patientCity: e.target.value })
              }
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="crd-patientPhone">Телефон {contactConsent && <span className="text-red-500">*</span>}</Label>
            <Input
              id="crd-patientPhone"
              placeholder="+7 (999) 123-45-67"
              value={formData.patientPhone}
              onChange={(e) =>
                setFormData({ ...formData, patientPhone: e.target.value })
              }
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="crd-patientEmail">Email</Label>
            <Input
              id="crd-patientEmail"
              type="email"
              placeholder="patient@email.com"
              value={formData.patientEmail}
              onChange={(e) =>
                setFormData({ ...formData, patientEmail: e.target.value })
              }
            />
          </div>

          {/* Contact consent */}
          <label className="flex items-start gap-3 cursor-pointer py-1">
            <Checkbox
              checked={contactConsent}
              onCheckedChange={(checked) => setContactConsent(!!checked)}
              className="mt-0.5"
            />
            <div>
              <span className="text-sm font-medium">Пациент хочет, чтобы с ним связались</span>
              <p className="text-xs text-muted-foreground">
                Наш сервис бесплатно свяжется с пациентом, поможет записаться к врачу и проконсультирует
              </p>
            </div>
          </label>

          {/* Clinic multi-select */}
          <div>
            <Label>Клиники для направления</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Выберите клиники, в которые хотите направить пациента. Можно
              пропустить — тогда рекомендация будет доступна всем клиникам.
            </p>
            <div className="border border-input rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {clinicsList?.map((clinic: any) => (
                <label
                  key={clinic.id}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                    selectedClinicIds.includes(clinic.id)
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedClinicIds.includes(clinic.id)}
                    onChange={() => toggleClinicSelection(clinic.id)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">{clinic.name}</span>
                  {clinic.city && (
                    <span className="text-xs text-muted-foreground">
                      ({clinic.city})
                    </span>
                  )}
                </label>
              ))}
              {(!clinicsList || clinicsList.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Нет доступных клиник
                </p>
              )}
            </div>
            {selectedClinicIds.length > 0 && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Выбрано: {selectedClinicIds.length}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedClinicIds([])}
                  className="text-xs text-primary hover:underline"
                >
                  Сбросить
                </button>
              </div>
            )}
            {selectedClinicIds.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Не выбраны — рекомендация будет доступна для всех клиник (любая)
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="crd-notes">Примечание</Label>
            <Textarea
              id="crd-notes"
              placeholder="Например: запись к конкретному врачу, важная информация о пациенте..."
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              maxLength={500}
              rows={3}
              className="resize-none"
            />
            {formData.notes.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {formData.notes.length}/500
              </p>
            )}
          </div>

        </div>

        {/* Error */}
        {formError && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            {formError}
          </div>
        )}

        {/* Actions — always visible at bottom */}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createReferral.isPending}
          >
            {createReferral.isPending ? "Создание..." : "Создать"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
