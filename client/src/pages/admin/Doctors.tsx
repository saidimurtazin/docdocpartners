import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

export default function AdminDoctors() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    specialization: "",
    clinic: "",
    clinicLocation: "",
    experience: "",
    education: "",
    achievements: "",
    services: "",
    phone: "",
    email: "",
    bio: "",
  });

  const { data: doctors, isLoading, refetch } = trpc.admin.doctors.list.useQuery();
  const createDoctor = trpc.admin.doctors.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsDialogOpen(false);
      resetForm();
    },
  });
  const updateDoctor = trpc.admin.doctors.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsDialogOpen(false);
      resetForm();
      setEditingDoctor(null);
    },
  });
  const deleteDoctor = trpc.admin.doctors.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
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

  const resetForm = () => {
    setFormData({
      fullName: "",
      specialization: "",
      clinic: "",
      clinicLocation: "",
      experience: "",
      education: "",
      achievements: "",
      services: "",
      phone: "",
      email: "",
      bio: "",
    });
  };

  const handleEdit = (doctor: any) => {
    setEditingDoctor(doctor);
    setFormData({
      fullName: doctor.fullName || "",
      specialization: doctor.specialization || "",
      clinic: doctor.clinic || "",
      clinicLocation: doctor.clinicLocation || "",
      experience: doctor.experience?.toString() || "",
      education: doctor.education || "",
      achievements: doctor.achievements || "",
      services: doctor.services || "",
      phone: doctor.phone || "",
      email: doctor.email || "",
      bio: doctor.bio || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      experience: formData.experience ? parseInt(formData.experience) : undefined,
    };

    if (editingDoctor) {
      await updateDoctor.mutateAsync({ id: editingDoctor.id, ...data });
    } else {
      await createDoctor.mutateAsync(data as any);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Удалить врача из базы знаний?")) {
      await deleteDoctor.mutateAsync({ id });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">База знаний врачей</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingDoctor(null); resetForm(); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить врача
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingDoctor ? "Редактировать врача" : "Добавить врача"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">ФИО *</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="specialization">Специализация *</Label>
                      <Input
                        id="specialization"
                        value={formData.specialization}
                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="clinic">Клиника *</Label>
                      <Input
                        id="clinic"
                        value={formData.clinic}
                        onChange={(e) => setFormData({ ...formData, clinic: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="clinicLocation">Город</Label>
                      <Input
                        id="clinicLocation"
                        value={formData.clinicLocation}
                        onChange={(e) => setFormData({ ...formData, clinicLocation: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="experience">Опыт (лет)</Label>
                      <Input
                        id="experience"
                        type="number"
                        value={formData.experience}
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Телефон</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="education">Образование</Label>
                    <Textarea
                      id="education"
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="achievements">Достижения</Label>
                    <Textarea
                      id="achievements"
                      value={formData.achievements}
                      onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="services">Услуги (через запятую)</Label>
                    <Textarea
                      id="services"
                      value={formData.services}
                      onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bio">Биография</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={createDoctor.isPending || updateDoctor.isPending}>
                      {editingDoctor ? "Сохранить" : "Добавить"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Все врачи ({doctors?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Специализация</TableHead>
                  <TableHead>Клиника</TableHead>
                  <TableHead>Город</TableHead>
                  <TableHead>Опыт</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors?.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="font-medium">{doctor.fullName}</TableCell>
                    <TableCell>{doctor.specialization}</TableCell>
                    <TableCell>{doctor.clinic}</TableCell>
                    <TableCell>{doctor.clinicLocation || "—"}</TableCell>
                    <TableCell>{doctor.experience ? `${doctor.experience} лет` : "—"}</TableCell>
                    <TableCell>{doctor.phone || "—"}</TableCell>
                    <TableCell>{doctor.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(doctor)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(doctor.id)}
                          disabled={deleteDoctor.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
