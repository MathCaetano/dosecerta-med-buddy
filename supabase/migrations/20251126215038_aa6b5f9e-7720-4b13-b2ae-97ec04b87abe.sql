-- Criar tabela para analytics de notificações
CREATE TABLE public.notification_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  evento_tipo TEXT NOT NULL, -- 'scheduled', 'delivered', 'clicked', 'action_taken', 'action_snoozed', 'dismissed'
  lembrete_id UUID,
  medicamento_id UUID,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB, -- dados adicionais como horário agendado, delay, etc
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_notification_analytics_usuario ON notification_analytics(usuario_id);
CREATE INDEX idx_notification_analytics_evento ON notification_analytics(evento_tipo);
CREATE INDEX idx_notification_analytics_timestamp ON notification_analytics(timestamp);
CREATE INDEX idx_notification_analytics_lembrete ON notification_analytics(lembrete_id);

-- RLS policies
ALTER TABLE public.notification_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics"
  ON public.notification_analytics
  FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own analytics"
  ON public.notification_analytics
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- Função para calcular taxa de entrega de notificações
CREATE OR REPLACE FUNCTION public.calcular_taxa_entrega_notificacoes(
  _usuario_id UUID,
  _data_inicio TIMESTAMP WITH TIME ZONE DEFAULT (now() - INTERVAL '7 days'),
  _data_fim TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS TABLE(
  total_agendadas BIGINT,
  total_entregues BIGINT,
  total_clicadas BIGINT,
  total_acoes_tomadas BIGINT,
  total_acoes_adiadas BIGINT,
  taxa_entrega NUMERIC,
  taxa_cliques NUMERIC,
  taxa_acao NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE evento_tipo = 'scheduled') AS agendadas,
      COUNT(*) FILTER (WHERE evento_tipo = 'delivered') AS entregues,
      COUNT(*) FILTER (WHERE evento_tipo = 'clicked') AS clicadas,
      COUNT(*) FILTER (WHERE evento_tipo = 'action_taken') AS acoes_tomadas,
      COUNT(*) FILTER (WHERE evento_tipo = 'action_snoozed') AS acoes_adiadas
    FROM notification_analytics
    WHERE usuario_id = _usuario_id
      AND timestamp BETWEEN _data_inicio AND _data_fim
  )
  SELECT
    agendadas,
    entregues,
    clicadas,
    acoes_tomadas,
    acoes_adiadas,
    CASE WHEN agendadas > 0 THEN ROUND((entregues::NUMERIC / agendadas::NUMERIC) * 100, 2) ELSE 0 END AS taxa_entrega,
    CASE WHEN entregues > 0 THEN ROUND((clicadas::NUMERIC / entregues::NUMERIC) * 100, 2) ELSE 0 END AS taxa_cliques,
    CASE WHEN clicadas > 0 THEN ROUND((acoes_tomadas::NUMERIC / clicadas::NUMERIC) * 100, 2) ELSE 0 END AS taxa_acao
  FROM stats;
$$;

-- Função para obter analytics por medicamento
CREATE OR REPLACE FUNCTION public.analytics_por_medicamento(
  _usuario_id UUID,
  _data_inicio TIMESTAMP WITH TIME ZONE DEFAULT (now() - INTERVAL '30 days'),
  _data_fim TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS TABLE(
  medicamento_id UUID,
  medicamento_nome TEXT,
  total_notificacoes BIGINT,
  total_cliques BIGINT,
  total_doses_tomadas BIGINT,
  taxa_engajamento NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id AS medicamento_id,
    m.nome AS medicamento_nome,
    COUNT(*) FILTER (WHERE na.evento_tipo = 'delivered') AS total_notificacoes,
    COUNT(*) FILTER (WHERE na.evento_tipo = 'clicked') AS total_cliques,
    COUNT(*) FILTER (WHERE na.evento_tipo = 'action_taken') AS total_doses_tomadas,
    CASE 
      WHEN COUNT(*) FILTER (WHERE na.evento_tipo = 'delivered') > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE na.evento_tipo = 'action_taken')::NUMERIC / 
                  COUNT(*) FILTER (WHERE na.evento_tipo = 'delivered')::NUMERIC) * 100, 2)
      ELSE 0 
    END AS taxa_engajamento
  FROM medicamentos m
  LEFT JOIN notification_analytics na ON na.medicamento_id = m.id
    AND na.timestamp BETWEEN _data_inicio AND _data_fim
  WHERE m.usuario_id = _usuario_id
  GROUP BY m.id, m.nome
  ORDER BY total_notificacoes DESC;
$$;