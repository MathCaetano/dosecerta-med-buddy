import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, History, Pill, CheckCircle, Clock, AlertCircle, Pencil, Trash2 } from "lucide-react";
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

interface Lembrete {
  id: string;
  horario: string;
  periodo: string;
  ativo: boolean;
  medicamento_id: string;
}

interface HistoricoDose {
  id: string;
  lembrete_id: string;
  data: string;
  status: "tomado" | "esquecido" | "pendente";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [historico, setHistorico] = useState<HistoricoDose[]>([]);
  
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
        loadData();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    
    // Carregar medicamentos
    const { data: medsData } = await supabase
      .from("medicamentos")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (medsData) setMedicamentos(medsData);

    // Carregar lembretes ativos
    const { data: lemData } = await supabase
      .from("lembretes")
      .select("*")
      .eq("ativo", true);
    
    if (lemData) setLembretes(lemData);

    // Carregar histórico de hoje
    const today = new Date().toISOString().split("T")[0];
    const { data: histData } = await supabase
      .from("historico_doses")
      .select("*")
      .eq("data", today);
    
    if (histData) setHistorico(histData as HistoricoDose[]);

    setLoading(false);
  };

  const marcarDose = async (lembreteId: string, status: "tomado" | "esquecido") => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toTimeString().split(" ")[0];

    // Verificar se já existe registro para hoje
    const existing = historico.find(h => h.lembrete_id === lembreteId && h.data === today);

    if (existing) {
      const { error } = await supabase
        .from("historico_doses")
        .update({ status, horario_real: now })
        .eq("id", existing.id);

      if (error) {
        toast.error("Erro ao atualizar dose");
      } else {
        toast.success(status === "tomado" ? "Dose marcada como tomada!" : "Dose marcada como esquecida");
        loadData();
      }
    } else {
      const { error } = await supabase
        .from("historico_doses")
        .insert({
          lembrete_id: lembreteId,
          data: today,
          horario_real: now,
          status,
        });

      if (error) {
        toast.error("Erro ao registrar dose");
      } else {
        toast.success(status === "tomado" ? "Dose marcada como tomada!" : "Dose marcada como esquecida");
        loadData();
      }
    }
  };

  const getLembreteStatus = (lembreteId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const hist = historico.find(h => h.lembrete_id === lembreteId && h.data === today);
    return hist?.status || "pendente";
  };

  const getMedicamentoNome = (medicamentoId: string) => {
    const med = medicamentos.find(m => m.id === medicamentoId);
    return med ? `${med.nome} (${med.dosagem})` : "Medicamento";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "tomado":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "esquecido":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      tomado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      esquecido: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      pendente: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };

    return (
      <Badge className={variants[status] || variants.pendente}>
        {status === "tomado" ? "✓ Tomado" : status === "esquecido" ? "Esquecido" : "⏰ Pendente"}
      </Badge>
    );
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

    // Verificar nomes duplicados (exceto o próprio medicamento)
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
      loadData();
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
      loadData();
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
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-full p-3">
              <Pill className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">DoseCerta</h1>
              <p className="text-muted-foreground">Bem-vindo de volta!</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate("/history")}>
              <History className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Lembretes de Hoje</CardTitle>
            <CardDescription className="text-base">
              Acompanhe seus medicamentos do dia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lembretes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">
                Nenhum lembrete ativo. Adicione um medicamento para começar!
              </p>
            ) : (
              lembretes.map((lembrete) => {
                const status = getLembreteStatus(lembrete.id);
                return (
                  <div
                    key={lembrete.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {getStatusIcon(status)}
                      <div className="flex-1">
                        <p className="font-medium text-base">
                          {getMedicamentoNome(lembrete.medicamento_id)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lembrete.horario} • {lembrete.periodo}
                        </p>
                      </div>
                      {getStatusBadge(status)}
                    </div>
                    {status === "pendente" && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => marcarDose(lembrete.id, "tomado")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Tomei
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarDose(lembrete.id, "esquecido")}
                        >
                          Esqueci
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Meus Medicamentos</CardTitle>
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
      </main>

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

export default Dashboard;
