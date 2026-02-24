import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  support: "Поддержка",
  accountant: "Бухгалтер",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  support: "secondary",
  accountant: "outline",
};

export default function AdminStaff() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Staff state
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"support" | "accountant">("support");

  // Clinic user state
  const [showClinicDialog, setShowClinicDialog] = useState(false);
  const [clinicUserName, setClinicUserName] = useState("");
  const [clinicUserEmail, setClinicUserEmail] = useState("");
  const [clinicUserPhone, setClinicUserPhone] = useState("");
  const [clinicUserPosition, setClinicUserPosition] = useState("");
  const [clinicUserClinicId, setClinicUserClinicId] = useState<string>("");

  // Queries
  const { data: staff, isLoading: staffLoading, refetch: refetchStaff } = trpc.admin.staff.list.useQuery();
  const { data: clinicUsers, isLoading: clinicUsersLoading, refetch: refetchClinicUsers } = trpc.admin.clinicUsers.list.useQuery();
  const { data: clinicsList } = trpc.admin.clinics.list.useQuery();

  // Staff mutations
  const createStaff = trpc.admin.staff.create.useMutation({
    onSuccess: () => {
      refetchStaff();
      setShowStaffDialog(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewRole("support");
    },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const deleteStaff = trpc.admin.staff.delete.useMutation({
    onSuccess: () => refetchStaff(),
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });

  // Clinic user mutations
  const createClinicUser = trpc.admin.clinicUsers.create.useMutation({
    onSuccess: () => {
      refetchClinicUsers();
      setShowClinicDialog(false);
      setClinicUserName(""); setClinicUserEmail(""); setClinicUserPhone("");
      setClinicUserPosition(""); setClinicUserClinicId("");
    },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const deleteClinicUser = trpc.admin.clinicUsers.delete.useMutation({
    onSuccess: () => refetchClinicUsers(),
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });

  if (authLoading || staffLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    setLocation("/admin");
    return null;
  }

  const handleCreateStaff = () => {
    if (!newName || !newEmail) return;
    createStaff.mutate({
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      phone: newPhone.trim() || undefined,
      role: newRole,
    });
  };

  const handleDeleteStaff = (id: number, name: string | null) => {
    if (confirm(`Удалить сотрудника "${name}"?`)) {
      deleteStaff.mutate({ id });
    }
  };

  const handleCreateClinicUser = () => {
    if (!clinicUserName || !clinicUserEmail || !clinicUserClinicId) return;
    createClinicUser.mutate({
      name: clinicUserName.trim(),
      email: clinicUserEmail.trim().toLowerCase(),
      phone: clinicUserPhone.trim() || undefined,
      position: clinicUserPosition.trim() || undefined,
      clinicId: parseInt(clinicUserClinicId),
    });
  };

  const handleDeleteClinicUser = (id: number, name: string | null) => {
    if (confirm(`Удалить пользователя клиники "${name}"?`)) {
      deleteClinicUser.mutate({ id });
    }
  };

  return (
    <AdminLayoutWrapper>
      <div className="container py-8">
        <Tabs defaultValue="staff">
          <TabsList className="mb-6">
            <TabsTrigger value="staff">Сотрудники ({staff?.length || 0})</TabsTrigger>
            <TabsTrigger value="clinics">Клиники ({clinicUsers?.length || 0})</TabsTrigger>
          </TabsList>

          {/* ===== TAB: Сотрудники ===== */}
          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Сотрудники</CardTitle>
                  <Button onClick={() => setShowStaffDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>ФИО</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Телефон</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead>Дата создания</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff?.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.id}</TableCell>
                          <TableCell className="font-medium">{s.name || "—"}</TableCell>
                          <TableCell>{s.email || "—"}</TableCell>
                          <TableCell>{s.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={ROLE_VARIANTS[s.role] || "outline"}>
                              {ROLE_LABELS[s.role] || s.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.createdAt ? format(new Date(s.createdAt), "dd.MM.yyyy", { locale: ru }) : "—"}
                          </TableCell>
                          <TableCell>
                            {s.id !== user.userId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteStaff(s.id, s.name)}
                                disabled={deleteStaff.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB: Клиники ===== */}
          <TabsContent value="clinics">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Пользователи клиник</CardTitle>
                  <Button onClick={() => setShowClinicDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {clinicUsersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ФИО</TableHead>
                          <TableHead>Должность</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Телефон</TableHead>
                          <TableHead>Клиника</TableHead>
                          <TableHead>Дата создания</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clinicUsers?.map((cu) => (
                          <TableRow key={cu.id}>
                            <TableCell className="font-medium">{cu.name || "—"}</TableCell>
                            <TableCell>{cu.position || "—"}</TableCell>
                            <TableCell>{cu.email || "—"}</TableCell>
                            <TableCell>{cu.phone || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{cu.clinicName || "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              {cu.createdAt ? format(new Date(cu.createdAt), "dd.MM.yyyy", { locale: ru }) : "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClinicUser(cu.id, cu.name)}
                                disabled={deleteClinicUser.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!clinicUsers || clinicUsers.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              Нет пользователей клиник
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== Add Staff Dialog ===== */}
      <Dialog open={showStaffDialog} onOpenChange={(open) => {
        setShowStaffDialog(open);
        if (!open) { setNewName(""); setNewEmail(""); setNewPhone(""); setNewRole("support"); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ФИО</Label>
              <Input placeholder="Иванов Иван Иванович" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="email@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Телефон (необязательно)</Label>
              <Input placeholder="+79001234567" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Поддержка</SelectItem>
                  <SelectItem value="accountant">Бухгалтер</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStaffDialog(false)}>Отмена</Button>
            <Button onClick={handleCreateStaff} disabled={!newName || !newEmail || createStaff.isPending}>
              {createStaff.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Создание...</> : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Add Clinic User Dialog ===== */}
      <Dialog open={showClinicDialog} onOpenChange={(open) => {
        setShowClinicDialog(open);
        if (!open) { setClinicUserName(""); setClinicUserEmail(""); setClinicUserPhone(""); setClinicUserPosition(""); setClinicUserClinicId(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить пользователя клиники</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ФИО *</Label>
              <Input placeholder="Иванов Иван Иванович" value={clinicUserName} onChange={(e) => setClinicUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email * (для входа по OTP)</Label>
              <Input type="email" placeholder="email@clinic.com" value={clinicUserEmail} onChange={(e) => setClinicUserEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input placeholder="+79001234567" value={clinicUserPhone} onChange={(e) => setClinicUserPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Должность</Label>
              <Input placeholder="Главный врач" value={clinicUserPosition} onChange={(e) => setClinicUserPosition(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Клиника *</Label>
              <Select value={clinicUserClinicId} onValueChange={setClinicUserClinicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите клинику" />
                </SelectTrigger>
                <SelectContent>
                  {(clinicsList as any[])?.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClinicDialog(false)}>Отмена</Button>
            <Button
              onClick={handleCreateClinicUser}
              disabled={!clinicUserName || !clinicUserEmail || !clinicUserClinicId || createClinicUser.isPending}
            >
              {createClinicUser.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Создание...</> : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayoutWrapper>
  );
}
