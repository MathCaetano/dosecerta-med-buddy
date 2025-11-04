-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create medicamentos table
CREATE TABLE public.medicamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dosagem TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own medicamentos"
  ON public.medicamentos FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own medicamentos"
  ON public.medicamentos FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own medicamentos"
  ON public.medicamentos FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete own medicamentos"
  ON public.medicamentos FOR DELETE
  USING (auth.uid() = usuario_id);

-- Create lembretes table
CREATE TABLE public.lembretes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  horario TIME NOT NULL,
  periodo TEXT NOT NULL CHECK (periodo IN ('manha', 'tarde', 'noite', 'madrugada')),
  repeticao TEXT NOT NULL DEFAULT 'diariamente' CHECK (repeticao IN ('diariamente', 'dias_alternados', 'semanalmente')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lembretes"
  ON public.lembretes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medicamentos m
      WHERE m.id = lembretes.medicamento_id
      AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own lembretes"
  ON public.lembretes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medicamentos m
      WHERE m.id = medicamento_id
      AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own lembretes"
  ON public.lembretes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.medicamentos m
      WHERE m.id = lembretes.medicamento_id
      AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own lembretes"
  ON public.lembretes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.medicamentos m
      WHERE m.id = lembretes.medicamento_id
      AND m.usuario_id = auth.uid()
    )
  );

-- Create historico_doses table
CREATE TABLE public.historico_doses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lembrete_id UUID NOT NULL REFERENCES public.lembretes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_real TIME,
  status TEXT NOT NULL CHECK (status IN ('tomado', 'esquecido', 'pendente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.historico_doses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own historico"
  ON public.historico_doses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lembretes l
      JOIN public.medicamentos m ON l.medicamento_id = m.id
      WHERE l.id = historico_doses.lembrete_id
      AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own historico"
  ON public.historico_doses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lembretes l
      JOIN public.medicamentos m ON l.medicamento_id = m.id
      WHERE l.id = lembrete_id
      AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own historico"
  ON public.historico_doses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lembretes l
      JOIN public.medicamentos m ON l.medicamento_id = m.id
      WHERE l.id = historico_doses.lembrete_id
      AND m.usuario_id = auth.uid()
    )
  );

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'nome', 'Usuário'));
  RETURN new;
END;
$$;

-- Create trigger for new user profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();