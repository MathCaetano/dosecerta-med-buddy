import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoricoItem {
  id: string;
  data: string;
  horario_real: string | null;
  status: "tomado" | "esquecido" | "pendente";
  lembrete: {
    horario: string;
    periodo: string;
    medicamento: {
      nome: string;
      dosagem: string;
    };
  };
}

const History = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [stats, setStats] = useState({ tomado: 0, esquecido: 0, total: 0 });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("historico_doses")
      .select(`
        *,
        lembrete:lembretes (
          horario,
          periodo,
          medicamento:medicamentos (
            nome,
            dosagem
          )
        )
      `)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (data && !error) {
      setHistorico(data as any);
      
      const tomado = data.filter((h) => h.status === "tomado").length;
      const esquecido = data.filter((h) => h.status === "esquecido").length;
      setStats({ tomado, esquecido, total: data.length });
    }

    setLoading(false);
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
        {status === "tomado" ? "✓ Tomado" : status === "esquecido" ? "Esquecido" : "Pendente"}
      </Badge>
    );
  };

  const adesaoPercentual = stats.total > 0 
    ? Math.round((stats.tomado / stats.total) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="max-w-4xl mx-auto mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Histórico de Doses</CardTitle>
            <CardDescription className="text-base">
              Acompanhe seu progresso e adesão ao tratamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.tomado}
                </p>
                <p className="text-sm text-muted-foreground">Tomados</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {stats.esquecido}
                </p>
                <p className="text-sm text-muted-foreground">Esquecidos</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {adesaoPercentual}%
                </p>
                <p className="text-sm text-muted-foreground">Adesão</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Últimos registros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {historico.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">
                Nenhum histórico ainda. Comece a marcar suas doses!
              </p>
            ) : (
              historico.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(item.status)}
                    <div className="flex-1">
                      <p className="font-medium text-base">
                        {item.lembrete?.medicamento?.nome} ({item.lembrete?.medicamento?.dosagem})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(item.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        {" • "}
                        {item.lembrete?.horario}
                        {item.horario_real && ` (tomado às ${item.horario_real})`}
                      </p>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default History;
