import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, MousePointer, Check, Clock, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Progress } from '@/components/ui/progress';

interface TaxasEntrega {
  total_agendadas: number;
  total_entregues: number;
  total_clicadas: number;
  total_acoes_tomadas: number;
  total_acoes_adiadas: number;
  taxa_entrega: number;
  taxa_cliques: number;
  taxa_acao: number;
}

interface AnalyticsPorMedicamento {
  medicamento_id: string;
  medicamento_nome: string;
  total_notificacoes: number;
  total_cliques: number;
  total_doses_tomadas: number;
  taxa_engajamento: number;
}

const Analytics = () => {
  const navigate = useNavigate();
  const { getTaxasEntrega, getAnalyticsPorMedicamento } = useAnalytics();
  
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7');
  const [taxas, setTaxas] = useState<TaxasEntrega | null>(null);
  const [medicamentosStats, setMedicamentosStats] = useState<AnalyticsPorMedicamento[]>([]);

  const loadAnalytics = async () => {
    setLoading(true);

    const dias = parseInt(periodo);
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);

    const [taxasData, medicamentosData] = await Promise.all([
      getTaxasEntrega(dataInicio, dataFim),
      getAnalyticsPorMedicamento(dataInicio, dataFim),
    ]);

    setTaxas(taxasData);
    setMedicamentosStats(medicamentosData);
    setLoading(false);
  };

  useEffect(() => {
    loadAnalytics();
  }, [periodo]);

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics de Notificações</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe o desempenho das suas notificações
            </p>
          </div>
        </div>

        {/* Filtro de Período */}
        <div className="mb-6">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <>
            {/* Cards de Taxas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Taxa de Entrega
                    </CardTitle>
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {taxas?.taxa_entrega || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {taxas?.total_entregues || 0} de {taxas?.total_agendadas || 0} agendadas
                  </p>
                  <Progress value={taxas?.taxa_entrega || 0} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Taxa de Cliques
                    </CardTitle>
                    <MousePointer className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {taxas?.taxa_cliques || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {taxas?.total_clicadas || 0} cliques
                  </p>
                  <Progress value={taxas?.taxa_cliques || 0} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Taxa de Ação
                    </CardTitle>
                    <Check className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {taxas?.taxa_acao || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {taxas?.total_acoes_tomadas || 0} doses tomadas
                  </p>
                  <Progress value={taxas?.taxa_acao || 0} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Adiamentos
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {taxas?.total_acoes_adiadas || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Doses adiadas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Analytics por Medicamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Engajamento por Medicamento
                </CardTitle>
                <CardDescription>
                  Veja quais medicamentos têm melhor taxa de resposta
                </CardDescription>
              </CardHeader>
              <CardContent>
                {medicamentosStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum dado disponível para o período selecionado
                  </p>
                ) : (
                  <div className="space-y-4">
                    {medicamentosStats.map((med) => (
                      <div key={med.medicamento_id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-foreground">
                            {med.medicamento_nome}
                          </h3>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">
                              {med.taxa_engajamento}%
                            </span>
                          </div>
                        </div>
                        
                        <Progress value={med.taxa_engajamento} className="mb-3" />
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Notificações</p>
                            <p className="font-medium text-foreground">{med.total_notificacoes}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cliques</p>
                            <p className="font-medium text-foreground">{med.total_cliques}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Doses Tomadas</p>
                            <p className="font-medium text-foreground">{med.total_doses_tomadas}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumo Geral */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Resumo do Período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de notificações agendadas:</span>
                    <span className="font-medium text-foreground">{taxas?.total_agendadas || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de notificações entregues:</span>
                    <span className="font-medium text-foreground">{taxas?.total_entregues || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de cliques:</span>
                    <span className="font-medium text-foreground">{taxas?.total_clicadas || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Doses tomadas via notificação:</span>
                    <span className="font-medium text-foreground">{taxas?.total_acoes_tomadas || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Doses adiadas:</span>
                    <span className="font-medium text-foreground">{taxas?.total_acoes_adiadas || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
