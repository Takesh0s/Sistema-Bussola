ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS nivel text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS ano text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS instituicao text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS imagem_url text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'especialidades_codigo_unique'
  ) THEN
    ALTER TABLE especialidades ADD CONSTRAINT especialidades_codigo_unique UNIQUE (codigo);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS requisito_especialidade (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialidade_id uuid REFERENCES especialidades(id) ON DELETE CASCADE,
  numero int NOT NULL,
  texto text NOT NULL,
  clube_id uuid REFERENCES clube(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS membro_requisito (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  desbravador_id uuid REFERENCES desbravador(id) ON DELETE CASCADE,
  requisito_id uuid REFERENCES requisito_especialidade(id) ON DELETE CASCADE,
  concluido boolean DEFAULT false,
  clube_id uuid REFERENCES clube(id) ON DELETE CASCADE,
  UNIQUE(desbravador_id, requisito_id)
);

ALTER TABLE requisito_especialidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE membro_requisito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura global - requisito_especialidade" ON requisito_especialidade;
CREATE POLICY "Leitura global - requisito_especialidade"
  ON requisito_especialidade FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Acesso por clube - membro_requisito" ON membro_requisito;
CREATE POLICY "Acesso por clube - membro_requisito"
  ON membro_requisito FOR ALL
  USING (clube_id = meu_clube_id())
  WITH CHECK (clube_id = meu_clube_id());