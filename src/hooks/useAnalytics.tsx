import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AnalyticsEventType = 
  | 'scheduled' 
  | 'delivered' 
  | 'clicked' 
  | 'action_taken' 
  | 'action_snoozed' 
  | 'dismissed';

interface AnalyticsEvent {
  evento_tipo: AnalyticsEventType;
  lembrete_id?: string;
  medicamento_id?: string;
  metadata?: Record<string, any>;
}

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

export const useAnalytics = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  /**
   * Registrar evento de analytics
   */
  const trackEvent = async (event: AnalyticsEvent): Promise<boolean> => {
    if (!userId) {
      console.warn('Analytics: Usuário não autenticado');
      return false;
    }

    try {
      const { error } = await supabase
        .from('notification_analytics')
        .insert({
          usuario_id: userId,
          evento_tipo: event.evento_tipo,
          lembrete_id: event.lembrete_id,
          medicamento_id: event.medicamento_id,
          metadata: event.metadata,
        });

      if (error) {
        console.error('Erro ao registrar analytics:', error);
        return false;
      }

      console.log(`Analytics: ${event.evento_tipo} registrado`);
      return true;
    } catch (error) {
      console.error('Erro ao registrar analytics:', error);
      return false;
    }
  };

  /**
   * Obter taxas de entrega de notificações
   */
  const getTaxasEntrega = async (
    dataInicio?: Date,
    dataFim?: Date
  ): Promise<TaxasEntrega | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase.rpc('calcular_taxa_entrega_notificacoes', {
        _usuario_id: userId,
        _data_inicio: dataInicio?.toISOString(),
        _data_fim: dataFim?.toISOString(),
      });

      if (error) {
        console.error('Erro ao calcular taxas:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Erro ao calcular taxas:', error);
      return null;
    }
  };

  /**
   * Obter analytics por medicamento
   */
  const getAnalyticsPorMedicamento = async (
    dataInicio?: Date,
    dataFim?: Date
  ): Promise<AnalyticsPorMedicamento[]> => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase.rpc('analytics_por_medicamento', {
        _usuario_id: userId,
        _data_inicio: dataInicio?.toISOString(),
        _data_fim: dataFim?.toISOString(),
      });

      if (error) {
        console.error('Erro ao buscar analytics por medicamento:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar analytics por medicamento:', error);
      return [];
    }
  };

  /**
   * Rastrear notificação agendada
   */
  const trackScheduled = (lembreteId: string, medicamentoId: string, horario: string) => {
    return trackEvent({
      evento_tipo: 'scheduled',
      lembrete_id: lembreteId,
      medicamento_id: medicamentoId,
      metadata: { horario },
    });
  };

  /**
   * Rastrear notificação entregue
   */
  const trackDelivered = (lembreteId: string, medicamentoId: string) => {
    return trackEvent({
      evento_tipo: 'delivered',
      lembrete_id: lembreteId,
      medicamento_id: medicamentoId,
    });
  };

  /**
   * Rastrear clique em notificação
   */
  const trackClicked = (lembreteId: string, medicamentoId: string) => {
    return trackEvent({
      evento_tipo: 'clicked',
      lembrete_id: lembreteId,
      medicamento_id: medicamentoId,
    });
  };

  /**
   * Rastrear ação "Tomar" via notificação
   */
  const trackActionTaken = (lembreteId: string, medicamentoId: string) => {
    return trackEvent({
      evento_tipo: 'action_taken',
      lembrete_id: lembreteId,
      medicamento_id: medicamentoId,
    });
  };

  /**
   * Rastrear ação "Adiar" via notificação
   */
  const trackActionSnoozed = (lembreteId: string, medicamentoId: string, minutes: number) => {
    return trackEvent({
      evento_tipo: 'action_snoozed',
      lembrete_id: lembreteId,
      medicamento_id: medicamentoId,
      metadata: { minutes },
    });
  };

  return {
    trackEvent,
    trackScheduled,
    trackDelivered,
    trackClicked,
    trackActionTaken,
    trackActionSnoozed,
    getTaxasEntrega,
    getAnalyticsPorMedicamento,
  };
};
