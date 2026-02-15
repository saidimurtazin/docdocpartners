import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Plus, Pencil, Trash2, Building2, Globe, Phone, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

const emptyClinic = {
  name: "",
  type: "Многопрофильная",
  ownership: "Частная",
  city: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  specializations: "",
  certifications: "",
  description: "",
  commissionRate: 10,
  averageCheck: 0,
  foundedYear: 2020,
  languages: "Русский",
  imageUrl: "",
};

export default function AdminClinics() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<any>(null);
  const [form, setForm] = useState(emptyClinic);
  const [search, setSearch] = useState("");

  const { data: clinicsList, isLoading, refetch } = trpc.admin.clinics.list.useQuery();
  const createClinic = trpc.admin.clinics.create.useMutation({
    onSuccess: () => { refetch(); setIsDialogOpen(false); resetForm(); toast.success("Клиника добавлена"); },
  });
  const updateClinic = trpc.admin.clinics.update.useMutation({
    onSuccess: () => { refetch(); setIsDialogOpen(false); resetForm(); toast.success("Клиника обновлена"); },
  });
  const deleteClinic = trpc.admin.clinics.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Клиника удалена"); },
  });

  const resetForm = () => {
    setForm(emptyClinic);
    setEditingClinic(null);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (clinic: any) => {
    setEditingClinic(clinic);
    setForm({
      name: clinic.name || "",
      type: clinic.type || "Многопрофильная",
      ownership: clinic.ownership || "Частная",
      city: clinic.city || "",
      address: clinic.address || "",
      phone: clinic.phone || "",
      email: clinic.email || "",
      website: clinic.website || "",
      specializations: clinic.specializations || "",
      certifications: clinic.certifications || "",
      description: clinic.description || "",
      commissionRate: clinic.commissionRate || 10,
      averageCheck: clinic.averageCheck || 0,
      foundedYear: clinic.foundedYear || 2020,
      languages: clinic.languages || "Русский",
      imageUrl: clinic.imageUrl || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Введите название клиники"); return; }

    if (editingClinic) {
      await updateClinic.mutateAsync({ id: editingClinic.id, ...form });
    } else {
      await createClinic.mutateAsync(form);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Удалить клинику?")) {
      await deleteClinic.mutateAsync({ id });
    }
  };

  const filtered = (clinicsList || []).filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) ||
      c.city?.toLowerCase().includes(s) ||
      c.type?.toLowerCase().includes(s);
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const formatCurrency = (kopecks: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(kopecks / 100);

  return (
    <AdminLayoutWrapper>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Клиники-партнеры</h1>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить клинику
          </Button>
        </div>
        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Поиск по названию, городу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Clinics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((clinic: any) => (
            <Card key={clinic.id} className="overflow-hidden hover:border-primary/50 transition-all">
              {clinic.imageUrl && (
                <div className="aspect-video overflow-hidden bg-muted">
                  <img
                    src={clinic.imageUrl}
                    alt={clinic.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{clinic.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {clinic.city || "Город не указан"} {clinic.foundedYear ? `• c ${clinic.foundedYear}` : ""}
                    </p>
                  </div>
                  <Badge variant={clinic.isActive === "yes" ? "default" : "destructive"}>
                    {clinic.isActive === "yes" ? "Активна" : "Скрыта"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {clinic.type && (
                    <Badge variant="outline">
                      <Building2 className="w-3 h-3 mr-1" />
                      {clinic.type}
                    </Badge>
                  )}
                  {clinic.ownership && (
                    <Badge variant="outline">{clinic.ownership}</Badge>
                  )}
                </div>

                {clinic.specializations && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {clinic.specializations}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {clinic.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {clinic.phone}
                    </span>
                  )}
                  {clinic.website && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {clinic.website}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span>Комиссия: <b>{clinic.commissionRate}%</b></span>
                  {clinic.averageCheck > 0 && (
                    <span>Средний чек: <b>{formatCurrency(clinic.averageCheck)}</b></span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => openEdit(clinic)} className="flex-1">
                    <Pencil className="w-3 h-3 mr-1" />
                    Редактировать
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(clinic.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {search ? "Ничего не найдено" : "Нет клиник. Добавьте первую!"}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClinic ? "Редактировать клинику" : "Добавить клинику"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium">Название *</label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Тип</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({...form, type: e.target.value})}
                >
                  <option value="Многопрофильная">Многопрофильная</option>
                  <option value="Узкопрофильная">Узкопрофильная</option>
                  <option value="Стоматология">Стоматология</option>
                  <option value="Онкологическая">Онкологическая</option>
                  <option value="Реабилитационная">Реабилитационная</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Форма собственности</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.ownership}
                  onChange={(e) => setForm({...form, ownership: e.target.value})}
                >
                  <option value="Частная">Частная</option>
                  <option value="Государственная">Государственная</option>
                  <option value="Смешанная">Смешанная</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Город</label>
                <Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Год основания</label>
                <Input type="number" value={form.foundedYear} onChange={(e) => setForm({...form, foundedYear: parseInt(e.target.value) || 2020})} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Адрес</label>
                <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Телефон</label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Сайт</label>
                <Input value={form.website} onChange={(e) => setForm({...form, website: e.target.value})} placeholder="medsi.ru" />
              </div>
              <div>
                <label className="text-sm font-medium">Языки</label>
                <Input value={form.languages} onChange={(e) => setForm({...form, languages: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Комиссия агенту (%)</label>
                <Input type="number" value={form.commissionRate} onChange={(e) => setForm({...form, commissionRate: parseInt(e.target.value) || 10})} />
              </div>
              <div>
                <label className="text-sm font-medium">Средний чек (руб.)</label>
                <Input type="number" value={form.averageCheck / 100} onChange={(e) => setForm({...form, averageCheck: Math.round((parseFloat(e.target.value) || 0) * 100)})} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Специализации</label>
                <Input value={form.specializations} onChange={(e) => setForm({...form, specializations: e.target.value})} placeholder="Онкология, хирургия, терапия..." />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Сертификаты и лицензии</label>
                <Input value={form.certifications} onChange={(e) => setForm({...form, certifications: e.target.value})} placeholder="JCI, ISO 9001, ..." />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">URL изображения</label>
                <Input value={form.imageUrl} onChange={(e) => setForm({...form, imageUrl: e.target.value})} placeholder="https://..." />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Описание</label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
              <Button onClick={handleSubmit} disabled={createClinic.isPending || updateClinic.isPending}>
                {(createClinic.isPending || updateClinic.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingClinic ? "Сохранить" : "Добавить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayoutWrapper>
  );
}
