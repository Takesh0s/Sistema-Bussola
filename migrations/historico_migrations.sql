-- =============================================================================
-- Sistema Bússola — Histórico Completo de Migrations
-- Organizado em ordem cronológica de execução
-- =============================================================================


-- =============================================================================
-- MIGRATION 001 — Schema Inicial
-- Criação das tabelas base, RLS e dados iniciais de classes
-- =============================================================================

create extension if not exists "uuid-ossp";

create table classe (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text
);

create table conselheiro (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  telefone text,
  email text
);

create table unidade (
  id uuid primary key default uuid_generate_v4(),
  nome text not null
);

create table unidade_membro (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid references unidade(id) on delete cascade,
  conselheiro_id uuid references conselheiro(id) on delete cascade,
  tipo text check (tipo in ('conselheiro','associado')) not null
);

create table desbravador (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  unidade_id uuid references unidade(id) on delete set null,
  classe_id uuid references classe(id) on delete set null,
  data_nascimento date,
  contato text
);

create table especialidades (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text
);

create table desbravador_especialidade (
  id uuid primary key default uuid_generate_v4(),
  desbravador_id uuid references desbravador(id) on delete cascade,
  especialidade_id uuid references especialidades(id) on delete cascade,
  concluida boolean default false
);

create table mensalidade (
  id uuid primary key default uuid_generate_v4(),
  desbravador_id uuid references desbravador(id) on delete cascade,
  mes int check (mes >= 1 and mes <= 12),
  ano int,
  valor numeric(10,2),
  pago boolean default false
);

create table caixa (
  id uuid primary key default uuid_generate_v4(),
  tipo text check (tipo in ('entrada','saida')),
  descricao text,
  valor numeric(10,2),
  data date default now()
);

create table patrimonio (
  id uuid primary key default uuid_generate_v4(),
  item text not null,
  quantidade int default 1,
  estado text,
  unidade_id uuid references unidade(id) on delete set null
);

create table atas (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  conteudo text,
  data date default now()
);

create table atos (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  conteudo text,
  data date default now()
);

-- Dados iniciais: classes na ordem correta
insert into classe (nome, descricao) values
('Amigo','10 anos'),
('Companheiro','11 anos'),
('Pesquisador','12 anos'),
('Pioneiro','13 anos'),
('Excursionista','14 anos'),
('Guia','15-16 anos'),
('Líder','Líder de desbravadores'),
('Líder Máster',''),
('Líder Máster Avançado','');

-- RLS
alter table classe enable row level security;
alter table conselheiro enable row level security;
alter table unidade enable row level security;
alter table unidade_membro enable row level security;
alter table desbravador enable row level security;
alter table especialidades enable row level security;
alter table desbravador_especialidade enable row level security;
alter table mensalidade enable row level security;
alter table caixa enable row level security;
alter table patrimonio enable row level security;
alter table atas enable row level security;
alter table atos enable row level security;

-- Policies iniciais (substituídas na migration 002)
create policy "Authenticated full access - classe"
  on classe for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - conselheiro"
  on conselheiro for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - unidade"
  on unidade for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - unidade_membro"
  on unidade_membro for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - desbravador"
  on desbravador for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - especialidades"
  on especialidades for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - desbravador_especialidade"
  on desbravador_especialidade for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - mensalidade"
  on mensalidade for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - caixa"
  on caixa for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - patrimonio"
  on patrimonio for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - atas"
  on atas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - atos"
  on atos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');


-- =============================================================================
-- MIGRATION 002 — Sprint 5: Multitenancy + Sistema de Convites
-- Hierarquia organizacional, perfil de usuário, convites e RLS por clube
-- =============================================================================

create extension if not exists "uuid-ossp";

create table if not exists uniao (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  sigla text,
  created_at timestamptz default now()
);

create table if not exists associacao (
  id uuid primary key default uuid_generate_v4(),
  uniao_id uuid references uniao(id) on delete cascade,
  nome text not null,
  sigla text,
  created_at timestamptz default now()
);

create table if not exists clube (
  id uuid primary key default uuid_generate_v4(),
  associacao_id uuid references associacao(id) on delete cascade,
  nome text not null,
  cidade text,
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists perfil_usuario (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nome_completo text not null,
  clube_id uuid references clube(id) on delete set null,
  papel text not null check (papel in (
    'admin_sistema','regional','pastor',
    'diretor','diretor_associado','secretario','tesoureiro'
  )),
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists convite (
  id uuid primary key default uuid_generate_v4(),
  clube_id uuid not null references clube(id) on delete cascade,
  papel text not null check (papel in ('diretor','diretor_associado','secretario','tesoureiro')),
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  criado_por uuid references perfil_usuario(id) on delete set null,
  usado_por uuid references perfil_usuario(id) on delete set null,
  usado_em timestamptz,
  expira_em timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

-- Adiciona clube_id nas tabelas operacionais
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='conselheiro' and column_name='clube_id') then
    alter table conselheiro add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='unidade' and column_name='clube_id') then
    alter table unidade add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='desbravador' and column_name='clube_id') then
    alter table desbravador add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='especialidades' and column_name='clube_id') then
    alter table especialidades add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='mensalidade' and column_name='clube_id') then
    alter table mensalidade add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='caixa' and column_name='clube_id') then
    alter table caixa add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='patrimonio' and column_name='clube_id') then
    alter table patrimonio add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='atas' and column_name='clube_id') then
    alter table atas add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='atos' and column_name='clube_id') then
    alter table atos add column clube_id uuid references clube(id) on delete cascade;
  end if;
end $$;

-- Funções auxiliares RLS
create or replace function meu_clube_id()
returns uuid language sql stable as $$
  select clube_id from perfil_usuario where auth_user_id = auth.uid() limit 1;
$$;

create or replace function meu_papel()
returns text language sql stable as $$
  select papel from perfil_usuario where auth_user_id = auth.uid() limit 1;
$$;

-- Remove policies antigas
drop policy if exists "Authenticated full access - classe"                    on classe;
drop policy if exists "Authenticated full access - conselheiro"               on conselheiro;
drop policy if exists "Authenticated full access - unidade"                   on unidade;
drop policy if exists "Authenticated full access - unidade_membro"            on unidade_membro;
drop policy if exists "Authenticated full access - desbravador"               on desbravador;
drop policy if exists "Authenticated full access - especialidades"            on especialidades;
drop policy if exists "Authenticated full access - desbravador_especialidade" on desbravador_especialidade;
drop policy if exists "Authenticated full access - mensalidade"               on mensalidade;
drop policy if exists "Authenticated full access - caixa"                     on caixa;
drop policy if exists "Authenticated full access - patrimonio"                on patrimonio;
drop policy if exists "Authenticated full access - atas"                      on atas;
drop policy if exists "Authenticated full access - atos"                      on atos;

-- RLS: tabelas globais
alter table uniao      enable row level security;
alter table associacao enable row level security;
alter table clube      enable row level security;

drop policy if exists "Leitura livre - uniao"      on uniao;
drop policy if exists "Leitura livre - associacao" on associacao;
drop policy if exists "Leitura livre - clube"      on clube;

create policy "Leitura livre - uniao"
  on uniao for select using (auth.role() = 'authenticated');
create policy "Leitura livre - associacao"
  on associacao for select using (auth.role() = 'authenticated');
create policy "Leitura livre - clube"
  on clube for select using (auth.role() = 'authenticated');

-- RLS: perfil_usuario
alter table perfil_usuario enable row level security;

drop policy if exists "Ver proprio perfil"     on perfil_usuario;
drop policy if exists "Inserir proprio perfil" on perfil_usuario;
drop policy if exists "Editar proprio perfil"  on perfil_usuario;

create policy "Ver proprio perfil"
  on perfil_usuario for select
  using (auth_user_id = auth.uid() or clube_id = meu_clube_id());
create policy "Inserir proprio perfil"
  on perfil_usuario for insert with check (auth_user_id = auth.uid());
create policy "Editar proprio perfil"
  on perfil_usuario for update using (auth_user_id = auth.uid());

-- RLS: convite
alter table convite enable row level security;

drop policy if exists "Diretor gerencia convites"                on convite;
drop policy if exists "Qualquer autenticado le convite pelo token" on convite;

create policy "Diretor gerencia convites"
  on convite for all
  using (clube_id = meu_clube_id() and meu_papel() in ('diretor','admin_sistema'))
  with check (clube_id = meu_clube_id() and meu_papel() in ('diretor','admin_sistema'));
create policy "Qualquer autenticado le convite pelo token"
  on convite for select using (auth.role() = 'authenticated');

-- RLS: tabelas operacionais por clube
do $$ declare tabelas text[] := array[
  'conselheiro','unidade','desbravador','especialidades',
  'mensalidade','caixa','patrimonio','atas','atos'
];
t text;
begin
  foreach t in array tabelas loop
    execute format('drop policy if exists "Acesso por clube - %I" on %I;', t, t);
    execute format(
      'create policy "Acesso por clube - %I" on %I for all
       using (clube_id = meu_clube_id())
       with check (clube_id = meu_clube_id());', t, t
    );
  end loop;
end $$;

drop policy if exists "Leitura global - classe" on classe;
create policy "Leitura global - classe"
  on classe for select using (auth.role() = 'authenticated');

drop policy if exists "Acesso por clube - unidade_membro" on unidade_membro;
create policy "Acesso por clube - unidade_membro"
  on unidade_membro for all
  using (unidade_id in (select id from unidade where clube_id = meu_clube_id()))
  with check (unidade_id in (select id from unidade where clube_id = meu_clube_id()));

drop policy if exists "Acesso por clube - desbravador_especialidade" on desbravador_especialidade;
create policy "Acesso por clube - desbravador_especialidade"
  on desbravador_especialidade for all
  using (desbravador_id in (select id from desbravador where clube_id = meu_clube_id()))
  with check (desbravador_id in (select id from desbravador where clube_id = meu_clube_id()));

-- Dados iniciais: hierarquia DSA Brasil
insert into uniao (nome, sigla) values
  ('União Adventista Norte Brasileira',       'UANB'),
  ('União Adventista Nordeste Brasileira',     'UANEB'),
  ('União Adventista Centro-Oeste Brasileira', 'UCOB'),
  ('União Adventista Leste Brasileira',        'ULBAS'),
  ('União Adventista Sul Brasileira',          'UASB'),
  ('União Adventista Sul-Rio Grandense',       'UNASP'),
  ('União Adventista Paulista',                'UAP')
on conflict do nothing;

insert into associacao (nome, sigla, uniao_id)
select nome, sigla, u.id from (values
  ('Associação Planalto Central',              'APlaC'),
  ('Associação Centro-Oeste Brasileira',       'ABC'),
  ('Associação Brasil Central Paulista',       'ABCP'),
  ('Associação Goiana de Igrejas Adventistas', 'AGR'),
  ('Associação Mato-Grossense',                'AME'),
  ('Associação Adventista de Mato Grosso do Sul', 'AMMT'),
  ('Associação Tocantins',                     'APTC')
) as t(nome, sigla)
cross join (select id from uniao where sigla = 'UCOB') as u
on conflict do nothing;

insert into clube (nome, cidade, associacao_id)
select 'Pioneiros', 'Taguatinga Norte - DF', a.id
from associacao a where a.sigla = 'APlaC' on conflict do nothing;

insert into clube (nome, cidade, associacao_id)
select 'Bússola', 'Taguatinga Norte - DF', a.id
from associacao a where a.sigla = 'APlaC' on conflict do nothing;


-- =============================================================================
-- MIGRATION 003 — Perfis iniciais dos diretores
-- Inserção manual dos primeiros usuários
-- =============================================================================

INSERT INTO perfil_usuario (auth_user_id, nome_completo, clube_id, papel)
VALUES ('360b622e-6ab7-4869-8d4e-33279d646b58', 'Girleide de Sousa Feitosa', '7be29647-5104-49b0-8ed6-f0538e4ead9d', 'diretor');

INSERT INTO perfil_usuario (auth_user_id, nome_completo, clube_id, papel)
VALUES ('b8f1a7bb-8045-4158-9310-ac927e1f255d', 'Luiz Phillipe de Souza Santos', '7d178921-8a52-46ff-aef6-563464b9ecae', 'diretor');


-- =============================================================================
-- MIGRATION 004 — Correções na hierarquia (uniões e associações)
-- =============================================================================

update uniao set nome = 'União Leste Brasileira',    sigla = 'ULB' where sigla = 'ULBAS';
update uniao set nome = 'União Sul-Rio-Grandense',   sigla = 'USR' where sigla = 'UNASP';
update uniao set nome = 'União Sul Brasileira',      sigla = 'USB' where sigla = 'UASB';
update uniao set sigla = upper(sigla);

update associacao set sigla = 'AG'  where sigla = 'AGR';
update associacao set sigla = 'AMT' where sigla = 'AME';
update associacao set sigla = 'ASM' where sigla = 'AMMT';
update associacao set sigla = 'ATo' where sigla = 'APTC';
update associacao set nome  = 'Associação Goiana'          where sigla = 'AG';
update associacao set nome  = 'Associação Mato-Grossense'  where sigla = 'AMT';
update associacao set nome  = 'Associação Sul-Mato-Grossense' where sigla = 'ASM';
update associacao set nome  = 'Associação Tocantinense'    where sigla = 'ATo';

update uniao set nome = 'União Sudeste Brasileira', sigla = 'USeB' where sigla = 'ULB';

insert into associacao (nome, sigla, uniao_id)
select 'Associação Mineira Central', 'AMC', u.id
from uniao u where u.sigla = 'USeB' on conflict do nothing;

insert into clube (nome, cidade, associacao_id)
select 'Progresso', 'Belo Horizonte - MG', a.id
from associacao a where a.sigla = 'AMC' on conflict do nothing;


-- =============================================================================
-- MIGRATION 005 — Correção de RLS recursiva no perfil_usuario
-- Resolve o bug de "Acesso restrito — não vinculado a nenhum clube"
-- =============================================================================

-- Corrige a policy que causava loop recursivo via meu_clube_id()
drop policy if exists "Ver proprio perfil" on perfil_usuario;

create policy "Ver proprio perfil"
  on perfil_usuario for select
  using (auth_user_id = auth.uid());

-- Recria meu_clube_id() com security definer para quebrar o loop
create or replace function meu_clube_id()
returns uuid
language sql stable
security definer
as $$
  select clube_id from perfil_usuario
  where auth_user_id = auth.uid()
  limit 1;
$$;


-- =============================================================================
-- MIGRATION 006 — Especialidades oficiais: novas colunas + tabelas de requisitos
-- Prepara estrutura para importação das especialidades da ADSA
-- =============================================================================

-- Novas colunas na tabela especialidades
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS nivel text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS ano text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS instituicao text;
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS imagem_url text;

-- Constraint única no código
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'especialidades_codigo_unique'
  ) THEN
    ALTER TABLE especialidades ADD CONSTRAINT especialidades_codigo_unique UNIQUE (codigo);
  END IF;
END $$;

-- Tabela de requisitos por especialidade
CREATE TABLE IF NOT EXISTS requisito_especialidade (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialidade_id uuid REFERENCES especialidades(id) ON DELETE CASCADE,
  numero int NOT NULL,
  texto text NOT NULL,
  clube_id uuid REFERENCES clube(id) ON DELETE CASCADE
);

-- Tabela de progresso de requisitos por membro
CREATE TABLE IF NOT EXISTS membro_requisito (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  desbravador_id uuid REFERENCES desbravador(id) ON DELETE CASCADE,
  requisito_id uuid REFERENCES requisito_especialidade(id) ON DELETE CASCADE,
  concluido boolean DEFAULT false,
  clube_id uuid REFERENCES clube(id) ON DELETE CASCADE,
  UNIQUE(desbravador_id, requisito_id)
);

-- RLS
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

-- =============================================================================
-- FIM DO HISTÓRICO
-- Próximas migrations: inserção das especialidades oficiais (geradas pelo parser)
-- =============================================================================