-- ============================================
-- CORREÇÃO CRÍTICA: Duplicatas em historico_doses
-- ============================================

-- 1. Primeiro, manter apenas o registro mais recente de cada lembrete/data
-- (preservar dados do usuário quando possível)
DELETE FROM historico_doses h1
WHERE h1.id NOT IN (
  SELECT DISTINCT ON (lembrete_id, data) id
  FROM historico_doses
  ORDER BY lembrete_id, data, 
    CASE WHEN status = 'tomado' THEN 0 ELSE 1 END, -- Priorizar 'tomado'
    created_at DESC
);

-- 2. Adicionar constraint UNIQUE para prevenir duplicatas futuras
ALTER TABLE historico_doses 
ADD CONSTRAINT historico_doses_lembrete_data_unique 
UNIQUE (lembrete_id, data);

-- 3. Criar índice para otimizar consultas por data
CREATE INDEX IF NOT EXISTS idx_historico_doses_data 
ON historico_doses(data);

-- 4. Criar índice composto para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_historico_doses_lembrete_data_status 
ON historico_doses(lembrete_id, data, status);