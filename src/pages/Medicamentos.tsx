import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useFeedback } from "@/contexts/FeedbackContext";
import { useNotifications } from "@/hooks/useNotifications";
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
  const feedback = useFeedback();
  const notifications = useNotifications();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  
  // Estados para edição
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicamento | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editDosagem, setEditDosagem] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Estados para exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMed, setDeletingMed] = useState<Medicamento | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Validação em tempo real
  const [nomeError, setNomeError] = useState("");
  const [dosagemError, setDosagemError] = useState("");

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
    setNomeError("");
    setDosagemError("");
    setEditDialogOpen(true);
  };

  const validateNome = (value: string) => {
    if (!value.trim()) {
      setNomeError("Obrigatório");
      return false;
    }
    const duplicate = medicamentos.find(
      m => m.id !== editingMed?.id && m.nome.toLowerCase() === value.trim().toLowerCase()
    );
    if (duplicate) {
      setNomeError("Nome já cadastrado");
      return false;
    }
    setNomeError("");
    return true;
  };

  const validateDosagem = (value: string) => {
    if (!value.trim()) {
      setDosagemError("Obrigatório");
      return false;
    }
    setDosagemError("");
    return true;
  };

  const handleDelete = (med: Medicamento, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingMed(med);
    setDeleteDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!editingMed) return;
    
    const nomeValid = validateNome(editNome);
    const dosagemValid = validateDosagem(editDosagem);
    
    if (!nomeValid || !dosagemValid) {
      feedback.error("Corrija os erros");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("medicamentos")
        .update({
          nome: editNome.trim(),
          dosagem: editDosagem.trim(),
          observacoes: editObservacoes.trim() || null,
        })
        .eq("id", editingMed.id);

      if (error) throw error;

      // Atualizar lista localmente para feedback instantâneo
      setMedicamentos(prev => prev.map(m => 
        m.id === editingMed.id 
          ? { ...m, nome: editNome.trim(), dosagem: editDosagem.trim(), observacoes: editObservacoes.trim() || null }
          : m
      ));

      feedback.success("Atualizado");
      setEditDialogOpen(false);
    } catch (error: any) {
      feedback.error("Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingMed) return;

    setDeleting(true);
    try {
      // Cancelar todas as notificações do medicamento
      await notifications.cancelMedicationNotifications(deletingMed.id);

      const { error } = await supabase
        .from("medicamentos")
        .delete()
        .eq("id", deletingMed.id);

      if (error) throw error;

      // Remover da lista localmente para feedback instantâneo
      setMedicamentos(prev => prev.filter(m => m.id !== deletingMed.id));

      feedback.success("Excluído");
      setDeleteDialogOpen(false);
    } catch (error: any) {
      feedback.error("Erro ao excluir");
    } finally {
      setDeleting(false);
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
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-all hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-2"
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
                      className="h-8 w-8 hover:scale-110 transition-transform"
                      onClick={(e) => handleEdit(med, e)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:scale-110 transition-transform"
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
                onChange={(e) => {
                  setEditNome(e.target.value);
                  validateNome(e.target.value);
                }}
                placeholder="Ex: Paracetamol"
                className={nomeError ? "border-destructive" : ""}
              />
              {nomeError && (
                <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1">{nomeError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dosagem">Dosagem</Label>
              <Input
                id="edit-dosagem"
                value={editDosagem}
                onChange={(e) => {
                  setEditDosagem(e.target.value);
                  validateDosagem(e.target.value);
                }}
                placeholder="Ex: 500mg"
                className={dosagemError ? "border-destructive" : ""}
              />
              {dosagemError && (
                <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1">{dosagemError}</p>
              )}
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="min-w-[140px]">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar alterações"
              )}
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
