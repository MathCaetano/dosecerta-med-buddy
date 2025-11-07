import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Medicamento {
  id: string;
  nome: string;
  dosagem: string;
  observacoes: string | null;
}

const Medicamentos = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  
  // Estados para edição
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicamento | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editDosagem, setEditDosagem] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");
  
  // Estados para exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMed, setDeletingMed] = useState<Medicamento | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        loadMedicamentos();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadMedicamentos = async () => {
    setLoading(true);
    
    const { data: medsData } = await supabase
      .from("medicamentos")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (medsData) setMedicamentos(medsData);
    setLoading(false);
  };

  const handleEdit = (med: Medicamento, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMed(med);
    setEditNome(med.nome);
    setEditDosagem(med.dosagem);
    setEditObservacoes(med.observacoes || "");
    setEditDialogOpen(true);
  };

  const handleDelete = (med: Medicamento, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingMed(med);
    setDeleteDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!editingMed) return;
    
    if (!editNome.trim() || !editDosagem.trim()) {
      toast.error("Nome e dosagem são obrigatórios");
      return;
    }

    const duplicate = medicamentos.find(
      m => m.id !== editingMed.id && m.nome.toLowerCase() === editNome.trim().toLowerCase()
    );
    
    if (duplicate) {
      toast.error("Já existe um medicamento com este nome");
      return;
    }

    const { error } = await supabase
      .from("medicamentos")
      .update({
        nome: editNome.trim(),
        dosagem: editDosagem.trim(),
        observacoes: editObservacoes.trim() || null,
      })
      .eq("id", editingMed.id);

    if (error) {
      toast.error("Erro ao atualizar medicamento");
      console.error(error);
    } else {
      toast.success("Medicamento atualizado com sucesso");
      setEditDialogOpen(false);
      loadMedicamentos();
    }
  };

  const confirmDelete = async () => {
    if (!deletingMed) return;

    const { error } = await supabase
      .from("medicamentos")
      .delete()
      .eq("id", deletingMed.id);

    if (error) {
      toast.error("Erro ao excluir medicamento");
      console.error(error);
    } else {
      toast.success("Medicamento excluído com sucesso");
      setDeleteDialogOpen(false);
      loadMedicamentos();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Meus Medicamentos</CardTitle>
            <CardDescription className="text-base">
              {medicamentos.length} medicamento{medicamentos.length !== 1 ? "s" : ""} cadastrado{medicamentos.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {medicamentos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">
                Nenhum medicamento cadastrado. Adicione seu primeiro medicamento para começar.
              </p>
            ) : (
              medicamentos.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-base">{med.nome}</p>
                    <p className="text-sm text-muted-foreground">{med.dosagem}</p>
                    {med.observacoes && (
                      <p className="text-sm text-muted-foreground mt-1">{med.observacoes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleEdit(med, e)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(med, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-6 right-6">
        <Button
          size="lg"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={() => navigate("/add-medication")}
        >
          <Plus className="h-8 w-8" />
        </Button>
      </div>

      {/* Modal de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Medicamento</DialogTitle>
            <DialogDescription>
              Atualize as informações do medicamento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome do medicamento</Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Ex: Paracetamol"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dosagem">Dosagem</Label>
              <Input
                id="edit-dosagem"
                value={editDosagem}
                onChange={(e) => setEditDosagem(e.target.value)}
                placeholder="Ex: 500mg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-observacoes">Observações (opcional)</Label>
              <Textarea
                id="edit-observacoes"
                value={editObservacoes}
                onChange={(e) => setEditObservacoes(e.target.value)}
                placeholder="Adicione observações sobre o medicamento"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} className="bg-green-600 hover:bg-green-700">
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingMed?.nome}</strong>? 
              Essa ação é irreversível e também excluirá todos os lembretes e histórico associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Medicamentos;
