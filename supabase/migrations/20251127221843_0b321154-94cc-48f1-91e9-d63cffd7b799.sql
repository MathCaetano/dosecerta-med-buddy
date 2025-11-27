-- Criar tabela para armazenar tokens FCM dos dispositivos
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  dispositivo TEXT,
  plataforma TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ultimo_uso TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_fcm_tokens_usuario ON public.fcm_tokens(usuario_id);
CREATE INDEX idx_fcm_tokens_token ON public.fcm_tokens(token);

-- RLS Policies
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own tokens"
  ON public.fcm_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can view their own tokens"
  ON public.fcm_tokens
  FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own tokens"
  ON public.fcm_tokens
  FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.fcm_tokens
  FOR DELETE
  USING (auth.uid() = usuario_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fcm_tokens_updated_at_trigger
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_fcm_tokens_updated_at();