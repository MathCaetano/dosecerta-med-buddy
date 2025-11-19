import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, TrendingUp, TrendingDown, Pill, Filter } from "lucide-react";
import { format, parseISO, isToday, isYesterday, startOfDay, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface ChartData {
  date: string;
  tomadas: number;
  esquecidas: number;
}

const History = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [filteredHistorico, setFilteredHistorico] = useState<HistoricoItem[]>([]);
  const [stats, setStats] = useState({ tomado: 0, esquecido: 0, total: 0 });
  
  // Filtros
  const [selectedMedicamento, setSelectedMedicamento] = useState<string>("todos");
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("todos");
  const [selectedIntervalo, setSelectedIntervalo] = useState<string>("mes");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [historico, selectedMedicamento, selectedPeriodo, selectedIntervalo, selectedStatus]);

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
      .limit(200);

    if (data && !error) {
      setHistorico(data as any);
    }

    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...historico];

    // Filtro por intervalo
    const now = new Date();
    const startDate = new Date();
    if (selectedIntervalo === "semana") {
      startDate.setDate(now.getDate() - 7);
    } else if (selectedIntervalo === "mes") {
      startDate.setMonth(now.getMonth() - 1);
    } else if (selectedIntervalo === "90dias") {
      startDate.setDate(now.getDate() - 90);
    }
    filtered = filtered.filter(h => new Date(h.data) >= startDate);

    // Filtro por medicamento
    if (selectedMedicamento !== "todos") {
      filtered = filtered.filter(h => h.lembrete?.medicamento?.nome === selectedMedicamento);
    }

    // Filtro por período
    if (selectedPeriodo !== "todos") {
      filtered = filtered.filter(h => h.lembrete?.periodo === selectedPeriodo);
    }

    // Filtro por status
    if (selectedStatus !== "todos") {
      filtered = filtered.filter(h => h.status === selectedStatus);
    }

    setFilteredHistorico(filtered);
    
    // Atualizar stats
    const tomado = filtered.filter((h) => h.status === "tomado").length;
    const esquecido = filtered.filter((h) => h.status === "esquecido").length;
    setStats({ tomado, esquecido, total: filtered.length });
  };

  const getMedicamentosList = () => {
    const medicamentos = new Set(historico.map(h => h.lembrete?.medicamento?.nome).filter(Boolean));
    return Array.from(medicamentos);
  };

  const getAdesaoMensal = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dosesDoMes = filteredHistorico.filter(h => new Date(h.data) >= startOfMonth);
    if (dosesDoMes.length === 0) return 0;
    const tomadas = dosesDoMes.filter(h => h.status === "tomado").length;
    return Math.round((tomadas / dosesDoMes.length) * 100);
  };

  const getPeriodoMaiorAdesao = () => {
    const periodos = { manha: 0, tarde: 0, noite: 0 };
    const totais = { manha: 0, tarde: 0, noite: 0 };
    
    filteredHistorico.forEach(h => {
      const periodo = h.lembrete?.periodo;
      if (periodo && (periodo === "manha" || periodo === "tarde" || periodo === "noite")) {
        totais[periodo]++;
        if (h.status === "tomado") periodos[periodo]++;
      }
    });

    let maiorPeriodo = "-";
    let maiorAdesao = 0;
    Object.entries(periodos).forEach(([periodo, tomadas]) => {
      const total = totais[periodo as keyof typeof totais];
      if (total > 0) {
        const adesao = (tomadas / total) * 100;
        if (adesao > maiorAdesao) {
          maiorAdesao = adesao;
          maiorPeriodo = periodo.charAt(0).toUpperCase() + periodo.slice(1);
        }
      }
    });

    return maiorPeriodo;
  };

  const getPeriodoMenorAdesao = () => {
    const periodos = { manha: 0, tarde: 0, noite: 0 };
    const totais = { manha: 0, tarde: 0, noite: 0 };
    
    filteredHistorico.forEach(h => {
      const periodo = h.lembrete?.periodo;
      if (periodo && (periodo === "manha" || periodo === "tarde" || periodo === "noite")) {
        totais[periodo]++;
        if (h.status === "tomado") periodos[periodo]++;
      }
    });

    let menorPeriodo = "-";
    let menorAdesao = 100;
    Object.entries(periodos).forEach(([periodo, tomadas]) => {
      const total = totais[periodo as keyof typeof totais];
      if (total > 0) {
        const adesao = (tomadas / total) * 100;
        if (adesao < menorAdesao) {
          menorAdesao = adesao;
          menorPeriodo = periodo.charAt(0).toUpperCase() + periodo.slice(1);
        }
      }
    });

    return menorPeriodo;
  };

  const getMedicamentoMaisEsquecido = () => {
    const medicamentos: Record<string, number> = {};
    
    filteredHistorico
      .filter(h => h.status === "esquecido")
      .forEach(h => {
        const nome = h.lembrete?.medicamento?.nome;
        if (nome) {
          medicamentos[nome] = (medicamentos[nome] || 0) + 1;
        }
      });

    const entries = Object.entries(medicamentos);
    if (entries.length === 0) return "-";
    
    return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
  };

  const getChartData = (): ChartData[] => {
    const last7Days: ChartData[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dosesDay = filteredHistorico.filter(h => h.data === dateStr);
      const tomadas = dosesDay.filter(h => h.status === "tomado").length;
      const esquecidas = dosesDay.filter(h => h.status === "esquecido").length;

      last7Days.push({
        date: format(date, "dd/MM"),
        tomadas,
        esquecidas,
      });
    }

    return last7Days;
  };

  const groupByDate = () => {
    const grouped: Record<string, HistoricoItem[]> = {};
    
    filteredHistorico.forEach(item => {
      const date = parseISO(item.data);
      let label = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
      
      if (isToday(date)) {
        label = "Hoje";
      } else if (isYesterday(date)) {
        label = "Ontem";
      }
      
      if (!grouped[label]) {
        grouped[label] = [];
      }
      grouped[label].push(item);
    });

    return grouped;
  };

  const getDelayInfo = (item: HistoricoItem) => {
    if (item.status !== "tomado" || !item.horario_real) return null;

    const [scheduledHours, scheduledMinutes] = item.lembrete.horario.split(":").map(Number);
    const [actualHours, actualMinutes] = item.horario_real.split(":").map(Number);

    const scheduled = new Date();
    scheduled.setHours(scheduledHours, scheduledMinutes, 0, 0);

    const actual = new Date();
    actual.setHours(actualHours, actualMinutes, 0, 0);

    const delayMinutes = differenceInMinutes(actual, scheduled);

    if (delayMinutes > 5) {
      return `${delayMinutes} min atrasado`;
    }

    return null;
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

  const groupedHistorico = groupByDate();
  const chartData = getChartData();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">Histórico de Doses</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Medicamento</label>
                <Select value={selectedMedicamento} onValueChange={setSelectedMedicamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {getMedicamentosList().map(med => (
                      <SelectItem key={med} value={med}>{med}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Período</label>
                <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="noite">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Intervalo</label>
                <Select value={selectedIntervalo} onValueChange={setSelectedIntervalo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semana">Última semana</SelectItem>
                    <SelectItem value="mes">Último mês</SelectItem>
                    <SelectItem value="90dias">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="tomado">Tomados</SelectItem>
                    <SelectItem value="esquecido">Esquecidos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard com 4 cards estatísticos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Adesão Mensal</p>
                  <p className="text-3xl font-bold text-primary">{getAdesaoMensal()}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Maior Adesão</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {getPeriodoMaiorAdesao()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Menor Adesão</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {getPeriodoMenorAdesao()}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mais Esquecido</p>
                  <p className="text-base font-bold text-orange-600 dark:text-orange-400 truncate">
                    {getMedicamentoMaisEsquecido()}
                  </p>
                </div>
                <Pill className="h-8 w-8 text-orange-600 dark:text-orange-400 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de barras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Doses — Últimos 7 dias</CardTitle>
            <CardDescription>Comparativo entre doses tomadas e esquecidas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="tomadas" fill="hsl(142, 76%, 36%)" name="Tomadas" radius={[8, 8, 0, 0]} />
                <Bar dataKey="esquecidas" fill="hsl(0, 84%, 60%)" name="Esquecidas" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stats resumidos */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4">
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

        {/* Lista agrupada por dia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Registros detalhados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {filteredHistorico.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">
                Nenhum registro encontrado com os filtros selecionados.
              </p>
            ) : (
              Object.entries(groupedHistorico).map(([dateLabel, items]) => (
                <div key={dateLabel} className="space-y-3">
                  <h3 className="font-semibold text-lg text-foreground sticky top-0 bg-background py-2">
                    {dateLabel}
                  </h3>
                  {items.map((item) => {
                    const delay = getDelayInfo(item);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {getStatusIcon(item.status)}
                          <div className="flex-1">
                            <p className="font-medium text-base">
                              {item.lembrete?.medicamento?.nome} ({item.lembrete?.medicamento?.dosagem})
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Programado: {item.lembrete?.horario}
                              {item.horario_real && (
                                <>
                                  {" • "}
                                  Tomado às {item.horario_real}
                                  {delay && (
                                    <span className="text-orange-600 dark:text-orange-400 ml-1">
                                      ({delay})
                                    </span>
                                  )}
                                </>
                              )}
                            </p>
                          </div>
                          {getStatusBadge(item.status)}
                        </div>
                      </div>
                    );
                  })}
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
