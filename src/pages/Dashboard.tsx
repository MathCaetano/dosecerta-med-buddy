import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useFeedback } from "@/contexts/FeedbackContext";
import { getDelayWarning } from "@/utils/gamification";

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
  const feedback = useFeedback();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [historico, setHistorico] = useState<HistoricoDose[]>([]);

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
    const lembrete = lembretes.find(l => l.id === lembreteId);
    const horarioLembrete = lembrete?.horario || "";
    
    // Verificar se já existe registro para hoje
    const existing = historico.find(h => h.lembrete_id === lembreteId && h.data === today);

    if (existing) {
      const { error } = await supabase
        .from("historico_doses")
        .update({ status, horario_real: now })
        .eq("id", existing.id);

      if (error) {
        feedback.error("Erro ao atualizar dose");
      } else {
        if (status === "tomado") {
          const [horaLembrete, minutoLembrete] = horarioLembrete.split(":").map(Number);
          const [horaReal, minutoReal] = now.split(":").map(Number);
          const delayMinutes = (horaReal * 60 + minutoReal) - (horaLembrete * 60 + minutoLembrete);
          const warningMsg = getDelayWarning(Math.abs(delayMinutes));
          
          feedback.success(
            delayMinutes > 30 
              ? `Dose marcada! ${warningMsg || ""}` 
              : "Dose marcada no horário! Continue assim! ✨"
          );
        } else {
          feedback.info("Dose marcada como esquecida. Próxima tente não esquecer!");
        }
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
        feedback.error("Erro ao registrar dose");
      } else {
        if (status === "tomado") {
          feedback.success("Dose marcada! Você está no caminho certo! 💪");
        } else {
          feedback.warning("Dose marcada como esquecida");
        }
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

  const getTotaisHoje = () => {
    const total = lembretes.length;
    const tomados = lembretes.filter(l => getLembreteStatus(l.id) === "tomado").length;
    const pendentes = lembretes.filter(l => getLembreteStatus(l.id) === "pendente").length;
    return { total, tomados, pendentes };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const { total, tomados, pendentes } = getTotaisHoje();

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <main className="max-w-4xl mx-auto space-y-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-base text-muted-foreground">
            📅 Hoje: <strong>{total}</strong> lembretes totais • ✅ <strong>{tomados}</strong> tomados • ⏰ <strong>{pendentes}</strong> pendentes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Lembretes de Hoje</CardTitle>
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
      </main>
    </div>
  );
};

export default Dashboard;
