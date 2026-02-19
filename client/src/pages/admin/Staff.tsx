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
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"support" | "accountant">("support");

  const { data: staff, isLoading, refetch } = trpc.admin.staff.list.useQuery();
  const createStaff = trpc.admin.staff.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowDialog(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewRole("support");
    },
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });
  const deleteStaff = trpc.admin.staff.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => alert(`Ошибка: ${err.message}`),
  });

  if (authLoading || isLoading) {
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

  const handleCreate = () => {
    if (!newName || !newEmail) return;
    createStaff.mutate({
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      phone: newPhone.trim() || undefined,
      role: newRole,
    });
  };

  const handleDelete = (id: number, name: string | null) => {
    if (confirm(`Удалить сотрудника "${name}"?`)) {
      deleteStaff.mutate({ id });
    }
  };

  return (
    <AdminLayoutWrapper>
      <div className="container py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Сотрудники ({staff?.length || 0})</CardTitle>
              <Button onClick={() => setShowDialog(true)}>
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
                            onClick={() => handleDelete(s.id, s.name)}
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
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ФИО</Label>
              <Input
                placeholder="Иванов Иван Иванович"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон (необязательно)</Label>
              <Input
                placeholder="+79001234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Поддержка</SelectItem>
                  <SelectItem value="accountant">Бухгалтер</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Отмена</Button>
            <Button
              onClick={handleCreate}
              disabled={!newName || !newEmail || createStaff.isPending}
            >
              {createStaff.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Создание...</>
              ) : (
                "Создать"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayoutWrapper>
  );
}
