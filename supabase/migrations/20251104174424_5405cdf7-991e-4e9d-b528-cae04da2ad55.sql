-- Adicionar índices para otimização de queries
CREATE INDEX IF NOT EXISTS idx_medicamentos_usuario_id ON public.medicamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_lembretes_medicamento_id ON public.lembretes(medicamento_id);
CREATE INDEX IF NOT EXISTS idx_lembretes_ativo ON public.lembretes(ativo);
CREATE INDEX IF NOT EXISTS idx_historico_doses_lembrete_id ON public.historico_doses(lembrete_id);
CREATE INDEX IF NOT EXISTS idx_historico_doses_data ON public.historico_doses(data);
CREATE INDEX IF NOT EXISTS idx_historico_doses_status ON public.historico_doses(status);

-- Constraint para evitar lembretes duplicados no mesmo horário
ALTER TABLE public.lembretes 
ADD CONSTRAINT unique_lembrete_horario_medicamento 
UNIQUE (medicamento_id, horario, periodo);

-- Função para calcular adesão do usuário
CREATE OR REPLACE FUNCTION public.calcular_adesao_usuario(
  _usuario_id uuid,
  _data_inicio date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  _data_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_doses integer,
  doses_tomadas integer,
  doses_esquecidas integer,
  doses_pendentes integer,
  percentual_adesao numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH doses_usuario AS (
    SELECT h.status
    FROM historico_doses h
    JOIN lembretes l ON h.lembrete_id = l.id
    JOIN medicamentos m ON l.medicamento_id = m.id
    WHERE m.usuario_id = _usuario_id
      AND h.data BETWEEN _data_inicio AND _data_fim
  )
  SELECT 
    COUNT(*)::integer AS total_doses,
    COUNT(*) FILTER (WHERE status = 'tomado')::integer AS doses_tomadas,
    COUNT(*) FILTER (WHERE status = 'esquecido')::integer AS doses_esquecidas,
    COUNT(*) FILTER (WHERE status = 'pendente')::integer AS doses_pendentes,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE status = 'tomado')::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END AS percentual_adesao
  FROM doses_usuario;
$$;

-- Função para obter resumo semanal
CREATE OR REPLACE FUNCTION public.resumo_semanal_usuario(_usuario_id uuid)
RETURNS TABLE (
  semana text,
  total integer,
  tomadas integer,
  esquecidas integer,
  adesao numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    TO_CHAR(h.data, 'YYYY-"W"IW') AS semana,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE h.status = 'tomado')::integer AS tomadas,
    COUNT(*) FILTER (WHERE h.status = 'esquecido')::integer AS esquecidas,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE h.status = 'tomado')::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END AS adesao
  FROM historico_doses h
  JOIN lembretes l ON h.lembrete_id = l.id
  JOIN medicamentos m ON l.medicamento_id = m.id
  WHERE m.usuario_id = _usuario_id
    AND h.data >= CURRENT_DATE - INTERVAL '4 weeks'
  GROUP BY semana
  ORDER BY semana DESC;
$$;

-- Trigger para criar histórico pendente automaticamente quando lembrete é criado
CREATE OR REPLACE FUNCTION public.criar_historico_pendente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar registro pendente para hoje se o lembrete está ativo
  IF NEW.ativo = true THEN
    INSERT INTO public.historico_doses (lembrete_id, data, status)
    VALUES (NEW.id, CURRENT_DATE, 'pendente')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_criar_historico_pendente
AFTER INSERT ON public.lembretes
FOR EACH ROW
EXECUTE FUNCTION public.criar_historico_pendente();

-- Função para marcar doses esquecidas automaticamente
CREATE OR REPLACE FUNCTION public.marcar_doses_esquecidas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marcar como esquecido doses pendentes cujo horário passou há mais de 30 minutos
  UPDATE historico_doses h
  SET status = 'esquecido'
  FROM lembretes l
  WHERE h.lembrete_id = l.id
    AND h.status = 'pendente'
    AND h.data = CURRENT_DATE
    AND (l.horario + INTERVAL '30 minutes') < CURRENT_TIME;
END;
$$;