import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getReminderStatus, getReminderStatusInfo } from "@/lib/reminderStatus";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";

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
  horario_real?: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [historico, setHistorico] = useState<HistoricoDose[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const getMedicamentoNome = (medicamentoId: string) => {
    const med = medicamentos.find(m => m.id === medicamentoId);
    return med ? `${med.nome} (${med.dosagem})` : "Medicamento";
  };

  // Preparar dados para notificações
  const lembretesComNomes = lembretes.map(lem => ({
    id: lem.id,
    horario: lem.horario,
    medicamento_id: lem.medicamento_id,
    medicamentoNome: getMedicamentoNome(lem.medicamento_id).split(" - ")[0]
  }));

  // Hook de notificações
  useReminderNotifications(lembretesComNomes);

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
    
    // Carregar nome e avatar do usuário
    if (user?.id) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", user.id)
        .single();
      
      if (profileData) {
        setUserName(profileData.nome);
        if (profileData.avatar_url) {
          const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(profileData.avatar_url);
          setAvatarUrl(data.publicUrl);
        }
      }
    }
    
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

  const markDoseAsTaken = async (lembreteId: string, medicamentoId: string) => {
    if (!user?.id) return;

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toTimeString().split(" ")[0];

    // Verificar se já existe registro para hoje
    const existing = historico.find(h => h.lembrete_id === lembreteId && h.data === today);

    if (existing) {
      const { error } = await supabase
        .from("historico_doses")
        .update({ status: "tomado", horario_real: now })
        .eq("id", existing.id);

      if (error) {
        toast.error("Erro ao atualizar dose");
      } else {
        toast.success("Dose marcada como tomada!");
        loadData();
      }
    } else {
      const { error } = await supabase
        .from("historico_doses")
        .insert([{ lembrete_id: lembreteId, data: today, status: "tomado", horario_real: now }]);

      if (error) {
        toast.error("Erro ao registrar dose");
      } else {
        toast.success("Dose registrada como tomada!");
        loadData();
      }
    }
  };

  const marcarDose = async (lembreteId: string, status: "tomado" | "esquecido") => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toTimeString().split(" ")[0];

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
        .insert([{ lembrete_id: lembreteId, data: today, status, horario_real: now }]);

      if (error) {
        toast.error("Erro ao registrar dose");
      } else {
        toast.success(status === "tomado" ? "Dose registrada como tomada!" : "Dose registrada como esquecida");
        loadData();
      }
    }
  };

  const getTotaisHoje = () => {
    const total = lembretes.length;
    let tomados = 0;
    let atrasados = 0;
    let perdidos = 0;

    lembretes.forEach(lembrete => {
      const historicoDose = historico.find(h => h.lembrete_id === lembrete.id);
      const status = getReminderStatus(lembrete.horario, historicoDose?.horario_real);
      
      if (status === "taken") tomados++;
      else if (status === "late") atrasados++;
      else if (status === "missed") perdidos++;
    });
    
    return { total, tomados, atrasados, perdidos };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const { total, tomados, atrasados, perdidos } = getTotaisHoje();

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        {/* Cabeçalho com saudação */}
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={userName}
              className="w-12 h-12 rounded-full object-cover border-2 border-primary"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {userName}! 👋
            </h1>
          </div>
        </div>

        {/* Resumo do dia - Contadores inteligentes */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Hoje</CardTitle>
            <CardDescription>
              {total} {total === 1 ? "lembrete" : "lembretes"} • {tomados} {tomados === 1 ? "tomado" : "tomados"} • {atrasados} {atrasados === 1 ? "atrasado" : "atrasados"} • {perdidos} {perdidos === 1 ? "perdido" : "perdidos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total de doses:</span>
              <Badge variant="outline">{total}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Doses tomadas:</span>
              <Badge className="bg-success text-success-foreground hover:bg-success/90">{tomados}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Doses atrasadas:</span>
              <Badge className="bg-warning text-white hover:bg-warning/90">{atrasados}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Doses perdidas:</span>
              <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{perdidos}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Lembretes de hoje */}
        <Card>
          <CardHeader>
            <CardTitle>Lembretes de Hoje</CardTitle>
            <CardDescription>Seus medicamentos programados para hoje</CardDescription>
          </CardHeader>
          <CardContent>
            {lembretes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum lembrete cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {lembretes
                  .sort((a, b) => a.horario.localeCompare(b.horario))
                  .map((lembrete) => {
                    const historicoDose = historico.find(h => h.lembrete_id === lembrete.id);
                    const status = getReminderStatus(lembrete.horario, historicoDose?.horario_real);
                    const statusInfo = getReminderStatusInfo(status);
                    const medicamentoNome = getMedicamentoNome(lembrete.medicamento_id);
                    
                    return (
                      <div
                        key={lembrete.id}
                        className={`flex flex-col gap-3 p-4 border-2 rounded-lg transition-all ${statusInfo.color}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-lg">{medicamentoNome}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-4 h-4" />
                              <p className="text-sm font-medium">
                                {lembrete.horario.substring(0, 5)}
                              </p>
                            </div>
                            <p className="text-sm mt-1 font-medium">
                              {statusInfo.label}
                              {status === "taken" && historicoDose?.horario_real && 
                                ` às ${historicoDose.horario_real.substring(0, 5)}`
                              }
                            </p>
                          </div>
                          <div>
                            {status === "taken" && (
                              <CheckCircle className="w-8 h-8" />
                            )}
                            {status === "on_time" && (
                              <Clock className="w-8 h-8" />
                            )}
                            {status === "late" && (
                              <AlertCircle className="w-8 h-8" />
                            )}
                            {status === "missed" && (
                              <XCircle className="w-8 h-8" />
                            )}
                          </div>
                        </div>
                        
                        {status !== "taken" && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <Button
                              size="lg"
                              className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                              onClick={() => markDoseAsTaken(lembrete.id, lembrete.medicamento_id)}
                            >
                              <CheckCircle className="w-5 h-5 mr-2" />
                              Tomar Agora
                            </Button>
                            <Button
                              size="lg"
                              variant="outline"
                              className="flex-1"
                              onClick={() => marcarDose(lembrete.id, "esquecido")}
                            >
                              <AlertCircle className="w-5 h-5 mr-2" />
                              Esqueci
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
