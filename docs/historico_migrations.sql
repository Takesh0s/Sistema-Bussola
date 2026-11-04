-- =============================================================================
-- Sistema Bússola — Histórico Completo de Migrations
-- Organizado em ordem cronológica de execução
-- ⚠️ NÃO EXECUTAR
-- Este arquivo é apenas um consolidado histórico das migrations
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
-- MIGRATION 007 — Cargos, unidades por classe e catálogo oficial
-- perfil_papel com hierarquia de concessão, convites por RPC (correções de
-- segurança), regra de sexo nas unidades, finanças restritas e catálogo global
-- =============================================================================


-- =============================================================================
-- 1. FUNÇÕES AUXILIARES DE CARGO
-- =============================================================================

-- Id do perfil do usuário logado
create or replace function meu_perfil_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select id from perfil_usuario where auth_user_id = auth.uid() limit 1;
$$;

-- Unidade masculina recebendo F, ou feminina recebendo M
create or replace function sexo_incompativel(p_sexo_unidade text, p_sexo_pessoa text)
returns boolean
language sql immutable
as $$
  select coalesce(
    (p_sexo_unidade = 'masculina' and p_sexo_pessoa = 'F')
    or (p_sexo_unidade = 'feminina' and p_sexo_pessoa = 'M'),
    false
  );
$$;


-- =============================================================================
-- 2. PERFIL_PAPEL — CARGOS
-- Substitui perfil_usuario.papel: uma pessoa pode acumular cargos.
-- Para revogar um cargo, marca-se ativo = false (o histórico fica).
-- =============================================================================

create table if not exists perfil_papel (
  id                 uuid primary key default uuid_generate_v4(),
  perfil_id          uuid not null references perfil_usuario(id) on delete cascade,
  clube_id           uuid references clube(id) on delete cascade,
  associacao_id      uuid references associacao(id) on delete cascade,
  papel              text not null check (papel in (
    'admin_sistema','admin_associacao',
    'diretor','diretor_associado','secretario','tesoureiro',
    'conselheiro','conselheiro_associado','capelao','instrutor'
  )),
  unidade_id         uuid references unidade(id) on delete cascade,
  ano                int  not null default extract(year from now())::int,
  ativo              boolean not null default true,
  concedido_por      uuid references perfil_usuario(id) on delete set null,
  justificativa_sexo text,
  created_at         timestamptz default now(),

  -- admin_sistema é global; admin_associacao vale para os clubes da associação;
  -- os demais cargos pertencem a um clube
  constraint perfil_papel_escopo check (
       (papel = 'admin_sistema'    and clube_id is null and associacao_id is null)
    or (papel = 'admin_associacao' and clube_id is null and associacao_id is not null)
    or (papel not in ('admin_sistema','admin_associacao')
        and clube_id is not null and associacao_id is null)
  ),
  -- só conselheiros (e associados) são ligados a uma unidade
  constraint perfil_papel_unidade check (
    (papel in ('conselheiro','conselheiro_associado')) = (unidade_id is not null)
  )
);

-- Um diretor, um secretário e um tesoureiro ativos por clube
create unique index if not exists perfil_papel_unico_por_clube
  on perfil_papel (clube_id, papel)
  where ativo and papel in ('diretor','secretario','tesoureiro');

-- Um conselheiro ativo por unidade
create unique index if not exists perfil_papel_conselheiro_por_unidade
  on perfil_papel (unidade_id)
  where ativo and papel = 'conselheiro';

-- Uma unidade por pessoa (como conselheiro ou associado) por vez
create unique index if not exists perfil_papel_uma_unidade_por_pessoa
  on perfil_papel (perfil_id)
  where ativo and papel in ('conselheiro','conselheiro_associado');

-- Sem o mesmo cargo duplicado no mesmo clube
create unique index if not exists perfil_papel_sem_duplicata
  on perfil_papel (perfil_id, papel, clube_id)
  where ativo and clube_id is not null;

create index if not exists perfil_papel_perfil_idx on perfil_papel (perfil_id) where ativo;

-- O usuário logado tem algum destes cargos neste clube?
-- admin_sistema vale em qualquer clube; admin_associacao, nos clubes da associação.
-- security definer: lê perfil_papel sem passar pelo RLS, evitando a recursão
-- que a migration 005 precisou corrigir.
create or replace function tem_papel(p_clube uuid, p_papeis text[])
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from perfil_papel pp
    join perfil_usuario pu on pu.id = pp.perfil_id
    where pu.auth_user_id = auth.uid()
      and pp.ativo
      and pp.papel = any (p_papeis)
      and (
           pp.clube_id = p_clube
        or pp.papel = 'admin_sistema'
        or (pp.papel = 'admin_associacao'
            and pp.associacao_id = (select associacao_id from clube where id = p_clube))
      )
  );
$$;

-- Hierarquia de concessão:
--   admin_sistema         → admins
--   admins                → diretor
--   diretor               → diretor associado
--   diretor ou associados → secretário, tesoureiro, conselheiros, capelão, instrutor
create or replace function pode_conceder(p_clube uuid, p_papel text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select case
    when p_papel in ('admin_sistema','admin_associacao')
      then tem_papel(null, array['admin_sistema'])
    when p_papel = 'diretor'
      then tem_papel(p_clube, array['admin_sistema','admin_associacao'])
    when p_papel = 'diretor_associado'
      then tem_papel(p_clube, array['admin_sistema','admin_associacao','diretor'])
    else
      tem_papel(p_clube, array['admin_sistema','admin_associacao','diretor','diretor_associado'])
  end;
$$;

-- Antes de gravar um cargo: registra quem concedeu, confere se a unidade é do
-- mesmo clube e aplica a regra de sexo da unidade (exceção exige justificativa)
create or replace function perfil_papel_validar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unidade_clube uuid;
  v_unidade_sexo  text;
  v_pessoa_sexo   text;
begin
  if tg_op = 'INSERT' and new.concedido_por is null then
    new.concedido_por := meu_perfil_id();
  end if;

  if new.unidade_id is not null and new.ativo then
    select clube_id, sexo into v_unidade_clube, v_unidade_sexo
    from unidade where id = new.unidade_id;

    if v_unidade_clube is distinct from new.clube_id then
      raise exception 'unidade_outro_clube'
        using hint = 'A unidade precisa pertencer ao mesmo clube do cargo.';
    end if;

    select sexo into v_pessoa_sexo from perfil_usuario where id = new.perfil_id;

    if sexo_incompativel(v_unidade_sexo, v_pessoa_sexo)
       and coalesce(btrim(new.justificativa_sexo), '') = '' then
      raise exception 'sexo_unidade'
        using hint = 'Unidade separada por sexo: informe uma justificativa para a exceção.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists perfil_papel_validar on perfil_papel;
create trigger perfil_papel_validar
  before insert or update of unidade_id, justificativa_sexo, ativo on perfil_papel
  for each row execute function perfil_papel_validar();

-- RLS
alter table perfil_papel enable row level security;

drop policy if exists "Ver cargos do clube" on perfil_papel;
create policy "Ver cargos do clube"
  on perfil_papel for select
  using (
       perfil_id = meu_perfil_id()
    or clube_id  = meu_clube_id()
    or tem_papel(clube_id, array['admin_sistema','admin_associacao'])
  );

drop policy if exists "Conceder cargo" on perfil_papel;
create policy "Conceder cargo"
  on perfil_papel for insert
  with check (pode_conceder(clube_id, papel));

drop policy if exists "Revogar cargo" on perfil_papel;
create policy "Revogar cargo"
  on perfil_papel for update
  using      (pode_conceder(clube_id, papel))
  with check (pode_conceder(clube_id, papel));

-- O cliente não escolhe concedido_por e, depois de criado, só altera ativo e
-- justificativa (não dá para trocar a pessoa ou o cargo de uma linha existente)
revoke insert, update, delete on perfil_papel from anon, authenticated;
grant insert (perfil_id, clube_id, associacao_id, papel, unidade_id, ano, justificativa_sexo)
  on perfil_papel to authenticated;
grant update (ativo, justificativa_sexo) on perfil_papel to authenticated;

-- Novos cargos também valem em perfil_usuario.papel (lido pelo frontend v2)
do $$
declare v_nome text;
begin
  select conname into v_nome
  from pg_constraint
  where conrelid = 'perfil_usuario'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%papel%';
  if v_nome is not null then
    execute format('alter table perfil_usuario drop constraint %I', v_nome);
  end if;
end $$;

alter table perfil_usuario add constraint perfil_usuario_papel_check check (papel in (
  'admin_sistema','admin_associacao','regional','pastor',
  'diretor','diretor_associado','secretario','tesoureiro',
  'conselheiro','conselheiro_associado','capelao','instrutor'
));

-- Copia os cargos existentes (v2) para perfil_papel
insert into perfil_papel (perfil_id, clube_id, papel)
select pu.id, null, 'admin_sistema'
from perfil_usuario pu
where pu.papel = 'admin_sistema' and pu.ativo
on conflict do nothing;

insert into perfil_papel (perfil_id, clube_id, papel)
select pu.id, pu.clube_id, pu.papel
from perfil_usuario pu
where pu.papel in ('diretor','diretor_associado','secretario','tesoureiro','capelao','instrutor')
  and pu.clube_id is not null
  and pu.ativo
  and not exists (
    select 1 from perfil_papel pp
    where pp.perfil_id = pu.id and pp.papel = pu.papel and pp.clube_id = pu.clube_id
  )
on conflict do nothing;


-- =============================================================================
-- 3. CONVITES POR RPC
--
-- Falhas corrigidas do fluxo v2:
--   a) qualquer usuário logado lia TODOS os convites (e tokens) de todos os clubes;
--   b) o convidado não conseguia marcar o convite como usado (sem policy de update),
--      então o link continuava valendo;
--   c) o diretor podia convidar outro diretor.
-- Agora o convite é consultado e aceito só por funções que validam o token.
-- =============================================================================

alter table convite add column if not exists unidade_id uuid references unidade(id) on delete cascade;

do $$
declare v_nome text;
begin
  select conname into v_nome
  from pg_constraint
  where conrelid = 'convite'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%papel%';
  if v_nome is not null then
    execute format('alter table convite drop constraint %I', v_nome);
  end if;
end $$;

alter table convite add constraint convite_papel_check check (papel in (
  'diretor','diretor_associado','secretario','tesoureiro',
  'conselheiro','conselheiro_associado','capelao','instrutor'
));

alter table convite drop constraint if exists convite_unidade_check;
alter table convite add constraint convite_unidade_check check (
  (papel in ('conselheiro','conselheiro_associado')) = (unidade_id is not null)
);

-- criado_por é sempre quem está logado
create or replace function convite_definir_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.criado_por := coalesce(meu_perfil_id(), new.criado_por);
  return new;
end;
$$;

drop trigger if exists convite_definir_autor on convite;
create trigger convite_definir_autor
  before insert on convite
  for each row execute function convite_definir_autor();

drop policy if exists "Diretor gerencia convites"                  on convite;
drop policy if exists "Qualquer autenticado le convite pelo token" on convite;
drop policy if exists "Ver convites do clube"                      on convite;
drop policy if exists "Criar convite"                              on convite;
drop policy if exists "Excluir convite"                            on convite;

create policy "Ver convites do clube"
  on convite for select
  using (tem_papel(clube_id, array['admin_sistema','admin_associacao','diretor','diretor_associado']));

-- Só convida para um cargo quem pode concedê-lo
create policy "Criar convite"
  on convite for insert
  with check (pode_conceder(clube_id, papel));

create policy "Excluir convite"
  on convite for delete
  using (tem_papel(clube_id, array['admin_sistema','admin_associacao','diretor','diretor_associado']));

-- Consulta pública de um convite pelo token (tela de cadastro, antes do login)
create or replace function consultar_convite(p_token text)
returns table (clube_nome text, clube_cidade text, papel text, valido boolean)
language sql stable
security definer
set search_path = public
as $$
  select c.nome, c.cidade, cv.papel,
         (cv.usado_por is null and cv.expira_em > now())
  from convite cv
  join clube c on c.id = cv.clube_id
  where cv.token = p_token;
$$;

-- Aceita o convite: cria (ou completa) o perfil, concede o cargo e queima o token
create or replace function aceitar_convite(p_token text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_conv   convite%rowtype;
  v_perfil perfil_usuario%rowtype;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using hint = 'Faça login antes de aceitar o convite.';
  end if;

  select * into v_conv
  from convite
  where token = p_token and usado_por is null and expira_em > now()
  for update;

  if not found then
    raise exception 'convite_invalido' using hint = 'O convite não existe, já foi usado ou expirou.';
  end if;

  select * into v_perfil from perfil_usuario where auth_user_id = v_uid;

  if not found then
    if coalesce(btrim(p_nome), '') = '' then
      raise exception 'nome_obrigatorio' using hint = 'Informe seu nome completo.';
    end if;
    insert into perfil_usuario (auth_user_id, nome_completo, clube_id, papel)
    values (v_uid, btrim(p_nome), v_conv.clube_id, v_conv.papel)
    returning * into v_perfil;
  elsif v_perfil.clube_id is null then
    update perfil_usuario set clube_id = v_conv.clube_id
    where id = v_perfil.id
    returning * into v_perfil;
  elsif v_perfil.clube_id <> v_conv.clube_id then
    raise exception 'perfil_outro_clube'
      using hint = 'Sua conta já está vinculada a outro clube.';
  end if;

  -- Se a pessoa já tem o cargo, só queima o convite. Se o cargo é único e já
  -- está ocupado por outra pessoa, a função inteira é desfeita (perfil incluso).
  if not exists (
    select 1 from perfil_papel
    where perfil_id = v_perfil.id and papel = v_conv.papel
      and clube_id = v_conv.clube_id and ativo
  ) then
    begin
      insert into perfil_papel (perfil_id, clube_id, papel, unidade_id, concedido_por)
      values (v_perfil.id, v_conv.clube_id, v_conv.papel, v_conv.unidade_id, v_conv.criado_por);
    exception when unique_violation then
      raise exception 'cargo_ocupado'
        using hint = 'Esse cargo já está ocupado no clube. A direção precisa liberá-lo antes.';
    end;
  end if;

  update convite set usado_por = v_perfil.id, usado_em = now() where id = v_conv.id;

  return v_perfil.id;
end;
$$;

revoke execute on function consultar_convite(text)     from public;
revoke execute on function aceitar_convite(text, text) from public;
grant  execute on function consultar_convite(text)     to anon, authenticated;
grant  execute on function aceitar_convite(text, text) to authenticated;


-- =============================================================================
-- 4. PERFIL_USUARIO
--
-- Falhas corrigidas do fluxo v2:
--   a) qualquer usuário logado podia inserir o próprio perfil com qualquer clube
--      e papel (inclusive diretor) — agora o perfil nasce só por aceitar_convite;
--   b) o usuário podia editar o próprio papel e clube — agora só o nome e o sexo;
--   c) a tela Equipe só mostrava o próprio usuário (a 005 restringiu demais).
-- =============================================================================

alter table perfil_usuario add column if not exists sexo text check (sexo in ('M','F'));

drop policy if exists "Inserir proprio perfil" on perfil_usuario;
revoke insert on perfil_usuario from anon, authenticated;

revoke update on perfil_usuario from anon, authenticated;
grant  update (nome_completo, sexo) on perfil_usuario to authenticated;

drop policy if exists "Ver perfis do clube" on perfil_usuario;
create policy "Ver perfis do clube"
  on perfil_usuario for select
  using (clube_id = meu_clube_id());


-- =============================================================================
-- 5. UNIDADES POR CLASSE E REGRA DE SEXO
-- Classe sem divisão = uma unidade; classe dividida = várias unidades.
-- =============================================================================

alter table unidade add column if not exists classe_id uuid references classe(id) on delete set null;
alter table unidade add column if not exists sexo text not null default 'mista'
  check (sexo in ('masculina','feminina','mista'));

alter table desbravador add column if not exists sexo text check (sexo in ('M','F'));
alter table desbravador add column if not exists justificativa_sexo text;

create or replace function desbravador_validar_sexo()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_unidade_sexo text;
begin
  if new.unidade_id is not null then
    select sexo into v_unidade_sexo from unidade where id = new.unidade_id;
    if sexo_incompativel(v_unidade_sexo, new.sexo)
       and coalesce(btrim(new.justificativa_sexo), '') = '' then
      raise exception 'sexo_unidade'
        using hint = 'Unidade separada por sexo: informe uma justificativa para a exceção.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists desbravador_validar_sexo on desbravador;
create trigger desbravador_validar_sexo
  before insert or update of unidade_id, sexo, justificativa_sexo on desbravador
  for each row execute function desbravador_validar_sexo();


-- =============================================================================
-- 6. DESBRAVADOR: DADOS PESSOAIS E ACESSO PRÓPRIO
-- CPF e e-mail do responsável ficam numa tabela à parte, que só a diretoria lê.
-- =============================================================================

alter table desbravador add column if not exists auth_user_id uuid unique
  references auth.users(id) on delete set null;

create table if not exists desbravador_privado (
  desbravador_id              uuid primary key references desbravador(id) on delete cascade,
  clube_id                    uuid not null references clube(id) on delete cascade,
  cpf                         text unique check (cpf ~ '^[0-9]{11}$'),
  email_responsavel           text,
  consentimento_responsavel_em timestamptz
);

alter table desbravador_privado enable row level security;

drop policy if exists "Secretaria gerencia dados privados" on desbravador_privado;
create policy "Secretaria gerencia dados privados"
  on desbravador_privado for all
  using      (tem_papel(clube_id, array['admin_sistema','diretor','diretor_associado','secretario']))
  with check (tem_papel(clube_id, array['admin_sistema','diretor','diretor_associado','secretario']));

-- O tesoureiro lê (para enviar cobranças ao responsável), sem editar
drop policy if exists "Tesoureiro le dados privados" on desbravador_privado;
create policy "Tesoureiro le dados privados"
  on desbravador_privado for select
  using (tem_papel(clube_id, array['tesoureiro']));

-- O desbravador logado vê o próprio cadastro
drop policy if exists "Desbravador ve o proprio cadastro" on desbravador;
create policy "Desbravador ve o proprio cadastro"
  on desbravador for select
  using (auth_user_id = auth.uid());


-- =============================================================================
-- 7. FINANÇAS RESTRITAS
-- Mesmo critério do frontend (PAPEL_FINANCEIRO em utils.js): o secretário não
-- vê caixa nem mensalidades.
-- =============================================================================

drop policy if exists "Acesso por clube - caixa"       on caixa;
drop policy if exists "Acesso por clube - mensalidade" on mensalidade;
drop policy if exists "Financeiro - caixa"             on caixa;
drop policy if exists "Financeiro - mensalidade"       on mensalidade;

create policy "Financeiro - caixa"
  on caixa for all
  using      (tem_papel(clube_id, array['admin_sistema','diretor','diretor_associado','tesoureiro']))
  with check (tem_papel(clube_id, array['admin_sistema','diretor','diretor_associado','tesoureiro']));

create policy "Financeiro - mensalidade"
  on mensalidade for all
  using      (tem_papel(clube_id, array['admin_sistema','diretor','diretor_associado','tesoureiro']))
  with check (tem_papel(clube_id, array['admin_sistema','diretor','diretor_associado','tesoureiro']));


-- =============================================================================
-- 8. CATÁLOGO OFICIAL
-- clube_id nulo = oficial (importado do MDA Wiki), visível para todos;
-- clube_id preenchido = criado pelo clube, visível só para ele.
-- =============================================================================

-- Especialidades
alter table especialidades add column if not exists revisao   text;
alter table especialidades add column if not exists fonte_url text;

drop policy if exists "Acesso por clube - especialidades" on especialidades;
drop policy if exists "Ler especialidades"     on especialidades;
drop policy if exists "Criar especialidade"    on especialidades;
drop policy if exists "Editar especialidade"   on especialidades;
drop policy if exists "Excluir especialidade"  on especialidades;

create policy "Ler especialidades"
  on especialidades for select
  using (auth.role() = 'authenticated' and (clube_id is null or clube_id = meu_clube_id()));
create policy "Criar especialidade"
  on especialidades for insert
  with check (clube_id = meu_clube_id());
create policy "Editar especialidade"
  on especialidades for update
  using (clube_id = meu_clube_id()) with check (clube_id = meu_clube_id());
create policy "Excluir especialidade"
  on especialidades for delete
  using (clube_id = meu_clube_id());

-- Requisitos de especialidade: subitens (a, b, c) e revisão de origem
alter table requisito_especialidade add column if not exists parent_id uuid
  references requisito_especialidade(id) on delete cascade;
alter table requisito_especialidade add column if not exists rotulo  text;  -- ex.: '4.b'
alter table requisito_especialidade add column if not exists revisao text;

create index if not exists requisito_especialidade_espec_idx
  on requisito_especialidade (especialidade_id, numero);

drop policy if exists "Leitura global - requisito_especialidade" on requisito_especialidade;
drop policy if exists "Ler requisitos de especialidade"   on requisito_especialidade;
drop policy if exists "Gerir requisitos do clube"         on requisito_especialidade;

create policy "Ler requisitos de especialidade"
  on requisito_especialidade for select
  using (auth.role() = 'authenticated' and (clube_id is null or clube_id = meu_clube_id()));
create policy "Gerir requisitos do clube"
  on requisito_especialidade for all
  using (clube_id = meu_clube_id()) with check (clube_id = meu_clube_id());

-- Requisitos de classe (Amigo a Guia, Agrupadas, Líder...)
create table if not exists requisito_classe (
  id        uuid primary key default uuid_generate_v4(),
  classe_id uuid not null references classe(id) on delete cascade,
  parent_id uuid references requisito_classe(id) on delete cascade,
  secao     text,           -- ex.: 'Gerais', 'Descoberta espiritual'
  numero    int  not null,
  rotulo    text,
  texto     text not null,
  revisao   text
);

create index if not exists requisito_classe_classe_idx on requisito_classe (classe_id, numero);

alter table requisito_classe enable row level security;

drop policy if exists "Ler requisitos de classe" on requisito_classe;
create policy "Ler requisitos de classe"
  on requisito_classe for select
  using (auth.role() = 'authenticated');

-- Progresso: um requisito de especialidade OU de classe, com quem avaliou e quando
alter table membro_requisito add column if not exists requisito_classe_id uuid
  references requisito_classe(id) on delete cascade;
alter table membro_requisito add column if not exists avaliado_por uuid
  references perfil_usuario(id) on delete set null;
alter table membro_requisito add column if not exists concluido_em timestamptz;

alter table membro_requisito drop constraint if exists membro_requisito_um_requisito;
alter table membro_requisito add constraint membro_requisito_um_requisito
  check (num_nonnulls(requisito_id, requisito_classe_id) = 1);

create unique index if not exists membro_requisito_classe_unico
  on membro_requisito (desbravador_id, requisito_classe_id)
  where requisito_classe_id is not null;

-- O desbravador logado vê o próprio progresso
drop policy if exists "Desbravador ve o proprio progresso" on membro_requisito;
create policy "Desbravador ve o proprio progresso"
  on membro_requisito for select
  using (desbravador_id in (select id from desbravador where auth_user_id = auth.uid()));

-- =============================================================================
-- MIGRATION 008 — Inscrição em classes, instrução e chamada
-- Cadastro único de membros, Classes Avançadas e Agrupadas, prazos automáticos,
-- fluxo do instrutor, chamada por tipo de atividade e visão do capelão
-- =============================================================================


-- =============================================================================
-- 1. CADASTRO ÚNICO DE PESSOAS
-- A tabela desbravador passa a guardar todos os membros do clube, crianças ou
-- adultos. Quem é da direção tem, além disso, um perfil com login e cargos.
-- Assim classes, especialidades e chamada funcionam igual para todos.
-- =============================================================================

alter table desbravador add column if not exists perfil_id uuid unique
  references perfil_usuario(id) on delete set null;

comment on table desbravador is
  'Membros do clube (crianças e adultos). Adultos da direção também têm perfil_id.';

-- Atalho: o cadastro de membro do usuário logado
create or replace function meu_desbravador_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select d.id
  from desbravador d
  left join perfil_usuario pu on pu.id = d.perfil_id
  where d.auth_user_id = auth.uid() or pu.auth_user_id = auth.uid()
  limit 1;
$$;

-- Grupos de cargos usados nas policies abaixo
create or replace function papeis_direcao()
returns text[] language sql immutable as $$
  select array['admin_sistema','admin_associacao','diretor','diretor_associado','secretario','tesoureiro'];
$$;

create or replace function papeis_lideranca()
returns text[] language sql immutable as $$
  select papeis_direcao() || array['conselheiro','conselheiro_associado'];
$$;

-- O adulto vê o próprio cadastro de membro (o desbravador logado já via na 007)
drop policy if exists "Membro ve o proprio cadastro" on desbravador;
create policy "Membro ve o proprio cadastro"
  on desbravador for select
  using (id = meu_desbravador_id());


-- =============================================================================
-- 2. REQUISITOS: CLASSES AVANÇADAS E CLASSES AGRUPADAS
-- =============================================================================

-- A Classe Avançada é a seção final de cada cartão (ex.: "Amigo da Natureza")
alter table requisito_classe add column if not exists avancada boolean not null default false;

-- Ordem e tipo das classes (regulares de Amigo a Guia; liderança depois)
alter table classe add column if not exists ordem int;
alter table classe add column if not exists tipo  text check (tipo in ('regular','lideranca'));
alter table classe add column if not exists nome_avancada text;

update classe c set ordem = v.ordem, tipo = v.tipo, nome_avancada = v.avancada
from (values
  ('Amigo',                 1, 'regular',   'Amigo da Natureza'),
  ('Companheiro',           2, 'regular',   'Companheiro de Excursionismo'),
  ('Pesquisador',           3, 'regular',   'Pesquisador de Campo e Bosque'),
  ('Pioneiro',              4, 'regular',   'Pioneiro de Novas Fronteiras'),
  ('Excursionista',         5, 'regular',   'Excursionista na Mata'),
  ('Guia',                  6, 'regular',   'Guia de Exploração'),
  ('Líder',                 7, 'lideranca', null),
  ('Líder Máster',          8, 'lideranca', null),
  ('Líder Máster Avançado', 9, 'lideranca', null)
) as v(nome, ordem, tipo, avancada)
where c.nome = v.nome;

-- Cartão de Classes Agrupadas: lista consolidada das classes regulares.
-- Cada requisito traz as faixas de idade que cobre (11, 12, 13, 14 e 15 = ">= 15").
-- A pessoa cumpre só os requisitos da sua faixa.
create table if not exists requisito_agrupada (
  id        uuid primary key default uuid_generate_v4(),
  parent_id uuid references requisito_agrupada(id) on delete cascade,
  secao     text,
  numero    int  not null,
  rotulo    text,
  texto     text not null,
  faixas    int[] not null check (faixas <@ array[11,12,13,14,15] and cardinality(faixas) > 0),
  revisao   text
);

alter table requisito_agrupada enable row level security;

drop policy if exists "Ler requisitos de agrupada" on requisito_agrupada;
create policy "Ler requisitos de agrupada"
  on requisito_agrupada for select
  using (auth.role() = 'authenticated');

-- O progresso passa a aceitar também requisitos da agrupada
alter table membro_requisito add column if not exists requisito_agrupada_id uuid
  references requisito_agrupada(id) on delete cascade;

alter table membro_requisito drop constraint if exists membro_requisito_um_requisito;
alter table membro_requisito add constraint membro_requisito_um_requisito
  check (num_nonnulls(requisito_id, requisito_classe_id, requisito_agrupada_id) = 1);

create unique index if not exists membro_requisito_agrupada_unico
  on membro_requisito (desbravador_id, requisito_agrupada_id)
  where requisito_agrupada_id is not null;


-- =============================================================================
-- 3. INSCRIÇÃO EM CLASSE
--   regular   → uma classe, prazo até 31/12 do ano de início
--   avancada  → a seção avançada de uma classe, mesmo prazo
--   agrupada  → as classes regulares que faltam; prazo pela tabela oficial:
--               faixas 11 a 13 = 18 meses; 14 e 15 (>= 15) = 24 meses
-- =============================================================================

create table if not exists inscricao_classe (
  id             uuid primary key default uuid_generate_v4(),
  clube_id       uuid not null references clube(id) on delete cascade,
  desbravador_id uuid not null references desbravador(id) on delete cascade,
  tipo           text not null check (tipo in ('regular','avancada','agrupada')),
  classe_id      uuid references classe(id) on delete restrict,
  faixa_idade    int  check (faixa_idade between 11 and 15),
  iniciado_em    date not null default current_date,
  prazo          date not null,
  status         text not null default 'em_andamento'
                 check (status in ('em_andamento','concluida','vencida','cancelada')),
  concluido_em   date,
  created_at     timestamptz default now(),

  constraint inscricao_classe_forma check (
       (tipo in ('regular','avancada') and classe_id is not null and faixa_idade is null)
    or (tipo = 'agrupada' and classe_id is null and faixa_idade is not null)
  )
);

-- Uma inscrição em andamento por classe (ou uma agrupada) por pessoa
create unique index if not exists inscricao_classe_uma_ativa
  on inscricao_classe (desbravador_id, tipo, coalesce(classe_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'em_andamento';

-- Classes cobertas por uma agrupada
create table if not exists inscricao_classe_item (
  inscricao_id uuid not null references inscricao_classe(id) on delete cascade,
  classe_id    uuid not null references classe(id) on delete restrict,
  primary key (inscricao_id, classe_id)
);

create or replace function prazo_inscricao(p_tipo text, p_inicio date, p_faixa int)
returns date
language sql immutable
as $$
  select case
    when p_tipo = 'agrupada'
      then (p_inicio + make_interval(months => case when p_faixa >= 14 then 24 else 18 end))::date
    else make_date(extract(year from p_inicio)::int, 12, 31)
  end;
$$;

-- O prazo é sempre calculado; o cliente não escolhe
create or replace function inscricao_classe_definir_prazo()
returns trigger
language plpgsql
as $$
begin
  new.prazo := prazo_inscricao(new.tipo, new.iniciado_em, new.faixa_idade);
  if new.status = 'concluida' and new.concluido_em is null then
    new.concluido_em := current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists inscricao_classe_definir_prazo on inscricao_classe;
create trigger inscricao_classe_definir_prazo
  before insert or update of tipo, iniciado_em, faixa_idade, status on inscricao_classe
  for each row execute function inscricao_classe_definir_prazo();

-- Só classes regulares entram numa agrupada
create or replace function inscricao_item_validar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from inscricao_classe where id = new.inscricao_id and tipo = 'agrupada') then
    raise exception 'inscricao_nao_agrupada' using hint = 'Itens só existem em inscrições agrupadas.';
  end if;
  if not exists (select 1 from classe where id = new.classe_id and tipo = 'regular') then
    raise exception 'classe_nao_regular' using hint = 'A agrupada cobre apenas classes regulares (Amigo a Guia).';
  end if;
  return new;
end;
$$;

drop trigger if exists inscricao_item_validar on inscricao_classe_item;
create trigger inscricao_item_validar
  before insert or update on inscricao_classe_item
  for each row execute function inscricao_item_validar();

-- Marca como vencidas as inscrições com prazo passado (rodar periodicamente;
-- no Supabase, pelo pg_cron ou chamada no carregamento do app)
create or replace function vencer_inscricoes()
returns int
language sql
security definer
set search_path = public
as $$
  with v as (
    update inscricao_classe set status = 'vencida'
    where status = 'em_andamento' and prazo < current_date
    returning 1
  )
  select count(*)::int from v;
$$;

-- Cartão de Líder liberado: as 6 classes regulares concluídas ou uma agrupada em andamento
create or replace function pode_fazer_lider(p_desbravador uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select
    (select count(distinct c.id)
       from classe c
      where c.tipo = 'regular'
        and (
          exists (select 1 from inscricao_classe i
                   where i.desbravador_id = p_desbravador and i.tipo = 'regular'
                     and i.classe_id = c.id and i.status = 'concluida')
          or exists (select 1 from inscricao_classe i
                     join inscricao_classe_item it on it.inscricao_id = i.id
                    where i.desbravador_id = p_desbravador and i.tipo = 'agrupada'
                      and it.classe_id = c.id and i.status = 'concluida')
        )) = 6
    or exists (select 1 from inscricao_classe i
                where i.desbravador_id = p_desbravador and i.tipo = 'agrupada'
                  and i.status = 'em_andamento');
$$;

-- RLS
alter table inscricao_classe      enable row level security;
alter table inscricao_classe_item enable row level security;

drop policy if exists "Ver inscricoes" on inscricao_classe;
create policy "Ver inscricoes"
  on inscricao_classe for select
  using (clube_id = meu_clube_id() or desbravador_id = meu_desbravador_id());

drop policy if exists "Gerir inscricoes" on inscricao_classe;
create policy "Gerir inscricoes"
  on inscricao_classe for all
  using      (tem_papel(clube_id, papeis_lideranca()))
  with check (tem_papel(clube_id, papeis_lideranca()));

drop policy if exists "Ver itens de inscricao" on inscricao_classe_item;
create policy "Ver itens de inscricao"
  on inscricao_classe_item for select
  using (inscricao_id in (select id from inscricao_classe));  -- herda o RLS da inscrição

drop policy if exists "Gerir itens de inscricao" on inscricao_classe_item;
create policy "Gerir itens de inscricao"
  on inscricao_classe_item for all
  using (exists (select 1 from inscricao_classe i
                  where i.id = inscricao_id and tem_papel(i.clube_id, papeis_lideranca())))
  with check (exists (select 1 from inscricao_classe i
                       where i.id = inscricao_id and tem_papel(i.clube_id, papeis_lideranca())));


-- =============================================================================
-- 4. PROGRESSO: QUEM MARCA REQUISITOS
-- Antes (006) qualquer perfil do clube escrevia. Agora: direção e conselheiros
-- marcam direto; o instrutor marca pela função concluir_instrucao.
-- =============================================================================

alter table membro_requisito add column if not exists instrucao_id uuid;  -- FK criada após a tabela instrucao

drop policy if exists "Acesso por clube - membro_requisito" on membro_requisito;
drop policy if exists "Ver progresso do clube"  on membro_requisito;
drop policy if exists "Marcar progresso"        on membro_requisito;

create policy "Ver progresso do clube"
  on membro_requisito for select
  using (clube_id = meu_clube_id());

create policy "Marcar progresso"
  on membro_requisito for all
  using      (tem_papel(clube_id, papeis_lideranca()))
  with check (tem_papel(clube_id, papeis_lideranca()));


-- =============================================================================
-- 5. INSTRUÇÃO
-- A direção ou os conselheiros atribuem requisitos a um instrutor para um dia.
-- O instrutor aceita ou recusa. Na conclusão, ele confirma quem cumpriu e o
-- requisito é marcado para essas pessoas, com o nome dele como avaliador.
-- =============================================================================

create table if not exists instrucao (
  id            uuid primary key default uuid_generate_v4(),
  clube_id      uuid not null references clube(id) on delete cascade,
  data          date not null,
  instrutor_id  uuid not null references perfil_usuario(id) on delete restrict,
  atribuido_por uuid references perfil_usuario(id) on delete set null,
  status        text not null default 'pendente'
                check (status in ('pendente','aceita','recusada','concluida','cancelada')),
  observacao    text,
  respondido_em timestamptz,
  concluido_em  timestamptz,
  created_at    timestamptz default now()
);

create index if not exists instrucao_instrutor_idx on instrucao (instrutor_id, status);

create table if not exists instrucao_requisito (
  id                    uuid primary key default uuid_generate_v4(),
  instrucao_id          uuid not null references instrucao(id) on delete cascade,
  requisito_id          uuid references requisito_especialidade(id) on delete cascade,
  requisito_classe_id   uuid references requisito_classe(id) on delete cascade,
  requisito_agrupada_id uuid references requisito_agrupada(id) on delete cascade,
  constraint instrucao_requisito_um check (
    num_nonnulls(requisito_id, requisito_classe_id, requisito_agrupada_id) = 1
  )
);

alter table membro_requisito drop constraint if exists membro_requisito_instrucao_fk;
alter table membro_requisito add constraint membro_requisito_instrucao_fk
  foreign key (instrucao_id) references instrucao(id) on delete set null;

-- Na criação: registra quem atribuiu e exige que o instrutor tenha cargo no clube
create or replace function instrucao_validar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.atribuido_por := coalesce(meu_perfil_id(), new.atribuido_por);
  new.status := 'pendente';
  if not exists (select 1 from perfil_papel
                  where perfil_id = new.instrutor_id and clube_id = new.clube_id and ativo) then
    raise exception 'instrutor_sem_cargo'
      using hint = 'O instrutor precisa ter um cargo ativo no clube (ex.: instrutor convidado).';
  end if;
  return new;
end;
$$;

drop trigger if exists instrucao_validar on instrucao;
create trigger instrucao_validar
  before insert on instrucao
  for each row execute function instrucao_validar();

alter table instrucao           enable row level security;
alter table instrucao_requisito enable row level security;

drop policy if exists "Ver instrucoes"     on instrucao;
drop policy if exists "Atribuir instrucao" on instrucao;

create policy "Ver instrucoes"
  on instrucao for select
  using (instrutor_id = meu_perfil_id() or tem_papel(clube_id, papeis_lideranca()));

create policy "Atribuir instrucao"
  on instrucao for insert
  with check (tem_papel(clube_id, papeis_lideranca()));

-- Status só muda pelas funções abaixo
revoke update, delete on instrucao from anon, authenticated;

drop policy if exists "Ver requisitos da instrucao"  on instrucao_requisito;
drop policy if exists "Gerir requisitos da instrucao" on instrucao_requisito;

create policy "Ver requisitos da instrucao"
  on instrucao_requisito for select
  using (instrucao_id in (select id from instrucao));  -- herda o RLS da instrução

create policy "Gerir requisitos da instrucao"
  on instrucao_requisito for all
  using (exists (select 1 from instrucao i where i.id = instrucao_id
                  and i.status = 'pendente' and tem_papel(i.clube_id, papeis_lideranca())))
  with check (exists (select 1 from instrucao i where i.id = instrucao_id
                       and i.status = 'pendente' and tem_papel(i.clube_id, papeis_lideranca())));

-- O instrutor aceita ou recusa
create or replace function responder_instrucao(p_instrucao uuid, p_aceitar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update instrucao
     set status = case when p_aceitar then 'aceita' else 'recusada' end,
         respondido_em = now()
   where id = p_instrucao and instrutor_id = meu_perfil_id() and status = 'pendente';
  if not found then
    raise exception 'instrucao_indisponivel'
      using hint = 'A instrução não existe, não é sua ou já foi respondida.';
  end if;
end;
$$;

-- Quem atribuiu (ou a direção) cancela
create or replace function cancelar_instrucao(p_instrucao uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update instrucao set status = 'cancelada'
   where id = p_instrucao
     and status in ('pendente','aceita','recusada')
     and (atribuido_por = meu_perfil_id() or tem_papel(clube_id, papeis_direcao()));
  if not found then
    raise exception 'instrucao_indisponivel'
      using hint = 'A instrução não existe, já foi concluída ou você não pode cancelá-la.';
  end if;
end;
$$;

-- O instrutor conclui: marca os requisitos para quem ele confirmou
create or replace function concluir_instrucao(p_instrucao uuid, p_desbravadores uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst  instrucao%rowtype;
  v_req   instrucao_requisito%rowtype;
  v_desb  uuid;
  v_total int := 0;
begin
  select * into v_inst from instrucao where id = p_instrucao for update;

  if not found or v_inst.status <> 'aceita'
     or v_inst.instrutor_id is distinct from meu_perfil_id() then
    raise exception 'instrucao_indisponivel'
      using hint = 'Só o instrutor pode concluir, e apenas uma instrução aceita.';
  end if;

  if exists (select 1 from unnest(p_desbravadores) d
              where not exists (select 1 from desbravador
                                 where id = d and clube_id = v_inst.clube_id)) then
    raise exception 'desbravador_outro_clube' using hint = 'Há membros que não são deste clube.';
  end if;

  for v_req in select * from instrucao_requisito where instrucao_id = p_instrucao loop
    foreach v_desb in array p_desbravadores loop
      update membro_requisito
         set concluido = true, avaliado_por = v_inst.instrutor_id,
             concluido_em = now(), instrucao_id = v_inst.id
       where desbravador_id = v_desb
         and requisito_id          is not distinct from v_req.requisito_id
         and requisito_classe_id   is not distinct from v_req.requisito_classe_id
         and requisito_agrupada_id is not distinct from v_req.requisito_agrupada_id;

      if not found then
        insert into membro_requisito
          (desbravador_id, requisito_id, requisito_classe_id, requisito_agrupada_id,
           concluido, clube_id, avaliado_por, concluido_em, instrucao_id)
        values
          (v_desb, v_req.requisito_id, v_req.requisito_classe_id, v_req.requisito_agrupada_id,
           true, v_inst.clube_id, v_inst.instrutor_id, now(), v_inst.id);
      end if;
      v_total := v_total + 1;
    end loop;
  end loop;

  update instrucao set status = 'concluida', concluido_em = now() where id = p_instrucao;
  return v_total;
end;
$$;

revoke execute on function responder_instrucao(uuid, boolean) from public;
revoke execute on function cancelar_instrucao(uuid)           from public;
revoke execute on function concluir_instrucao(uuid, uuid[])   from public;
grant  execute on function responder_instrucao(uuid, boolean) to authenticated;
grant  execute on function cancelar_instrucao(uuid)           to authenticated;
grant  execute on function concluir_instrucao(uuid, uuid[])   to authenticated;


-- =============================================================================
-- 6. CHAMADA
-- O tipo é definido sozinho quando envolve instrução:
--   - ligada a uma instrução agendada → Instrução, com o instrutor dela;
--   - feita por alguém que é só instrutor no clube → Instrução, com ele;
--   - nos demais casos, o tipo escolhido (padrão: Reunião).
-- =============================================================================

create table if not exists atividade_tipo (
  id         uuid primary key default uuid_generate_v4(),
  clube_id   uuid references clube(id) on delete cascade,  -- nulo = tipo padrão do sistema
  nome       text not null,
  espiritual boolean not null default false
);

create unique index if not exists atividade_tipo_nome
  on atividade_tipo (coalesce(clube_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

insert into atividade_tipo (clube_id, nome, espiritual) values
  (null, 'Reunião',                false),
  (null, 'Classe bíblica',         true),
  (null, 'Instrução',              false),
  (null, 'Evento ou acampamento',  false)
on conflict do nothing;

create table if not exists chamada (
  id           uuid primary key default uuid_generate_v4(),
  clube_id     uuid not null references clube(id) on delete cascade,
  unidade_id   uuid references unidade(id) on delete set null,
  tipo_id      uuid references atividade_tipo(id) on delete restrict,
  data         date not null default current_date,
  instrucao_id uuid references instrucao(id) on delete set null,
  instrutor_id uuid references perfil_usuario(id) on delete set null,
  feita_por    uuid references perfil_usuario(id) on delete set null,
  created_at   timestamptz default now()
);

create index if not exists chamada_clube_data_idx on chamada (clube_id, data);

create table if not exists chamada_presenca (
  chamada_id     uuid not null references chamada(id) on delete cascade,
  desbravador_id uuid not null references desbravador(id) on delete cascade,
  presente       boolean not null default true,
  primary key (chamada_id, desbravador_id)
);

create or replace function chamada_definir_tipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instrucao   uuid := (select id from atividade_tipo where clube_id is null and nome = 'Instrução');
  v_reuniao     uuid := (select id from atividade_tipo where clube_id is null and nome = 'Reunião');
  v_so_instrutor boolean;
begin
  new.feita_por := coalesce(meu_perfil_id(), new.feita_por);

  if new.instrucao_id is not null then
    select instrutor_id into new.instrutor_id from instrucao where id = new.instrucao_id;
    new.tipo_id := v_instrucao;
  else
    select exists (select 1 from perfil_papel where perfil_id = new.feita_por
                     and clube_id = new.clube_id and ativo and papel = 'instrutor')
       and not exists (select 1 from perfil_papel where perfil_id = new.feita_por
                         and clube_id = new.clube_id and ativo and papel <> 'instrutor')
      into v_so_instrutor;

    if v_so_instrutor then
      new.tipo_id := v_instrucao;
      new.instrutor_id := new.feita_por;
    elsif new.tipo_id is null then
      new.tipo_id := v_reuniao;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists chamada_definir_tipo on chamada;
create trigger chamada_definir_tipo
  before insert on chamada
  for each row execute function chamada_definir_tipo();

alter table atividade_tipo   enable row level security;
alter table chamada          enable row level security;
alter table chamada_presenca enable row level security;

drop policy if exists "Ver tipos de atividade"   on atividade_tipo;
drop policy if exists "Gerir tipos de atividade" on atividade_tipo;
create policy "Ver tipos de atividade"
  on atividade_tipo for select
  using (clube_id is null or clube_id = meu_clube_id());
create policy "Gerir tipos de atividade"
  on atividade_tipo for all
  using      (clube_id is not null and tem_papel(clube_id, papeis_direcao()))
  with check (clube_id is not null and tem_papel(clube_id, papeis_direcao()));

-- Ver: liderança e capelão veem todas; o instrutor vê as dele
drop policy if exists "Ver chamadas"   on chamada;
drop policy if exists "Fazer chamada"  on chamada;
drop policy if exists "Editar chamada" on chamada;
create policy "Ver chamadas"
  on chamada for select
  using (tem_papel(clube_id, papeis_lideranca() || array['capelao'])
         or instrutor_id = meu_perfil_id() or feita_por = meu_perfil_id());
create policy "Fazer chamada"
  on chamada for insert
  with check (tem_papel(clube_id, papeis_lideranca() || array['instrutor']));
create policy "Editar chamada"
  on chamada for delete
  using (feita_por = meu_perfil_id() or tem_papel(clube_id, papeis_direcao()));

drop policy if exists "Ver presencas"     on chamada_presenca;
drop policy if exists "Marcar presencas"  on chamada_presenca;
drop policy if exists "Ver a propria presenca" on chamada_presenca;
create policy "Ver presencas"
  on chamada_presenca for select
  using (chamada_id in (select id from chamada));  -- herda o RLS da chamada
create policy "Ver a propria presenca"
  on chamada_presenca for select
  using (desbravador_id = meu_desbravador_id());
create policy "Marcar presencas"
  on chamada_presenca for all
  using (exists (select 1 from chamada c where c.id = chamada_id
                  and (c.feita_por = meu_perfil_id() or tem_papel(c.clube_id, papeis_lideranca()))))
  with check (exists (select 1 from chamada c where c.id = chamada_id
                       and (c.feita_por = meu_perfil_id() or tem_papel(c.clube_id, papeis_lideranca()))));


-- =============================================================================
-- 7. PARTICIPAÇÃO ESPIRITUAL (VISÃO DO CAPELÃO)
-- Por membro: chamadas espirituais no ano, presenças e faltas seguidas mais
-- recentes. security_invoker: quem consulta só vê o que o RLS já permite.
-- =============================================================================

create or replace view participacao_espiritual
with (security_invoker = true)
as
with marcacoes as (
  select c.clube_id, p.desbravador_id, c.data, p.presente,
         row_number() over (partition by p.desbravador_id order by c.data desc, c.created_at desc) as recente
  from chamada c
  join chamada_presenca p on p.chamada_id = c.id
  join atividade_tipo t   on t.id = c.tipo_id and t.espiritual
  where c.data >= date_trunc('year', current_date)
)
select
  d.clube_id,
  d.id         as desbravador_id,
  d.nome,
  d.unidade_id,
  count(m.*)                              as chamadas,
  count(m.*) filter (where m.presente)    as presencas,
  coalesce(min(m.recente) filter (where m.presente), count(m.*) + 1) - 1 as faltas_seguidas,
  max(m.data) filter (where m.presente)   as ultima_presenca
from desbravador d
left join marcacoes m on m.desbravador_id = d.id
group by d.clube_id, d.id, d.nome, d.unidade_id;

-- =============================================================================
-- MIGRATION 009 — Eventos com seções editáveis
-- Rascunho e publicação, seções com visibilidade por cargo, modelos de seções
-- e chamada ligada a um evento
-- =============================================================================


-- =============================================================================
-- 1. QUEM É DO CLUBE
-- O adulto tem perfil (meu_clube_id); o desbravador logado só tem cadastro de
-- membro. Esta função devolve o clube em qualquer um dos dois casos.
-- =============================================================================

create or replace function clube_do_usuario()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select coalesce(
    meu_clube_id(),
    (select clube_id from desbravador where id = meu_desbravador_id())
  );
$$;

create or replace function papeis_lideranca_ampla()
returns text[] language sql immutable as $$
  select papeis_lideranca() || array['instrutor','capelao'];
$$;

-- O usuário logado pode ver uma seção com esta visibilidade neste clube?
create or replace function pode_ver_visibilidade(p_clube uuid, p_visibilidade text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select case p_visibilidade
    when 'todos'     then clube_do_usuario() = p_clube or tem_papel(p_clube, papeis_lideranca_ampla())
    when 'lideranca' then tem_papel(p_clube, papeis_lideranca_ampla())
    when 'direcao'   then tem_papel(p_clube, papeis_direcao())
    else false
  end;
$$;


-- =============================================================================
-- 2. EVENTO
-- =============================================================================

create table if not exists evento (
  id           uuid primary key default uuid_generate_v4(),
  clube_id     uuid not null references clube(id) on delete cascade,
  titulo       text not null,
  local        text,
  inicio       timestamptz not null,
  fim          timestamptz,
  publicado    boolean not null default false,
  publicado_em timestamptz,
  criado_por   uuid references perfil_usuario(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint evento_periodo check (fim is null or fim >= inicio)
);

create index if not exists evento_clube_inicio_idx on evento (clube_id, inicio);

create or replace function evento_antes_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(meu_perfil_id(), new.criado_por);
  end if;
  new.updated_at := now();
  -- Registra o momento da publicação (e limpa se voltar a rascunho)
  if new.publicado and (tg_op = 'INSERT' or not old.publicado) then
    new.publicado_em := now();
  elsif not new.publicado then
    new.publicado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists evento_antes_gravar on evento;
create trigger evento_antes_gravar
  before insert or update on evento
  for each row execute function evento_antes_gravar();

alter table evento enable row level security;

drop policy if exists "Ver eventos"   on evento;
drop policy if exists "Gerir eventos" on evento;

-- Publicado: todos do clube veem. Rascunho: só a direção.
create policy "Ver eventos"
  on evento for select
  using ((publicado and clube_do_usuario() = clube_id) or tem_papel(clube_id, papeis_direcao())
         or (publicado and tem_papel(clube_id, papeis_lideranca_ampla())));

create policy "Gerir eventos"
  on evento for all
  using      (tem_papel(clube_id, papeis_direcao()))
  with check (tem_papel(clube_id, papeis_direcao()));


-- =============================================================================
-- 3. SEÇÕES DO EVENTO
-- =============================================================================

create table if not exists evento_secao (
  id           uuid primary key default uuid_generate_v4(),
  evento_id    uuid not null references evento(id) on delete cascade,
  titulo       text not null,
  conteudo     text,
  ordem        int  not null default 0,
  visibilidade text not null default 'todos'
               check (visibilidade in ('direcao','lideranca','todos')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists evento_secao_ordem_idx on evento_secao (evento_id, ordem);

create or replace function evento_secao_antes_gravar()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists evento_secao_antes_gravar on evento_secao;
create trigger evento_secao_antes_gravar
  before insert or update on evento_secao
  for each row execute function evento_secao_antes_gravar();

alter table evento_secao enable row level security;

drop policy if exists "Ver secoes"   on evento_secao;
drop policy if exists "Gerir secoes" on evento_secao;

-- Só aparece se o evento é visível para a pessoa E a visibilidade da seção permite
create policy "Ver secoes"
  on evento_secao for select
  using (exists (select 1 from evento e
                  where e.id = evento_id
                    and (tem_papel(e.clube_id, papeis_direcao())
                         or (e.publicado and pode_ver_visibilidade(e.clube_id, visibilidade)))));

create policy "Gerir secoes"
  on evento_secao for all
  using (exists (select 1 from evento e where e.id = evento_id
                  and tem_papel(e.clube_id, papeis_direcao())))
  with check (exists (select 1 from evento e where e.id = evento_id
                       and tem_papel(e.clube_id, papeis_direcao())));


-- =============================================================================
-- 4. MODELOS DE SEÇÕES
-- =============================================================================

create table if not exists evento_modelo (
  id         uuid primary key default uuid_generate_v4(),
  clube_id   uuid not null references clube(id) on delete cascade,
  nome       text not null,
  created_at timestamptz default now()
);

create unique index if not exists evento_modelo_nome on evento_modelo (clube_id, lower(nome));

create table if not exists evento_modelo_secao (
  id           uuid primary key default uuid_generate_v4(),
  modelo_id    uuid not null references evento_modelo(id) on delete cascade,
  titulo       text not null,
  conteudo     text,
  ordem        int  not null default 0,
  visibilidade text not null default 'todos'
               check (visibilidade in ('direcao','lideranca','todos'))
);

alter table evento_modelo       enable row level security;
alter table evento_modelo_secao enable row level security;

drop policy if exists "Direcao gerencia modelos"       on evento_modelo;
drop policy if exists "Direcao gerencia secoes modelo" on evento_modelo_secao;

create policy "Direcao gerencia modelos"
  on evento_modelo for all
  using      (tem_papel(clube_id, papeis_direcao()))
  with check (tem_papel(clube_id, papeis_direcao()));

create policy "Direcao gerencia secoes modelo"
  on evento_modelo_secao for all
  using (exists (select 1 from evento_modelo m where m.id = modelo_id
                  and tem_papel(m.clube_id, papeis_direcao())))
  with check (exists (select 1 from evento_modelo m where m.id = modelo_id
                       and tem_papel(m.clube_id, papeis_direcao())));

-- Copia as seções de um evento para um modelo novo (ou substitui as de um existente)
create or replace function salvar_como_modelo(p_evento uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clube  uuid;
  v_modelo uuid;
begin
  select clube_id into v_clube from evento where id = p_evento;
  if v_clube is null or not tem_papel(v_clube, papeis_direcao()) then
    raise exception 'sem_permissao' using hint = 'Só a direção do clube pode salvar modelos.';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome_obrigatorio' using hint = 'Dê um nome ao modelo.';
  end if;

  select id into v_modelo from evento_modelo
   where clube_id = v_clube and lower(nome) = lower(btrim(p_nome));

  if v_modelo is null then
    insert into evento_modelo (clube_id, nome) values (v_clube, btrim(p_nome))
    returning id into v_modelo;
  else
    delete from evento_modelo_secao where modelo_id = v_modelo;
  end if;

  insert into evento_modelo_secao (modelo_id, titulo, conteudo, ordem, visibilidade)
  select v_modelo, titulo, conteudo, ordem, visibilidade
    from evento_secao where evento_id = p_evento;

  return v_modelo;
end;
$$;

-- Acrescenta ao evento as seções de um modelo, depois das que ele já tem
create or replace function aplicar_modelo(p_evento uuid, p_modelo uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clube uuid;
  v_base  int;
  v_total int;
begin
  select clube_id into v_clube from evento where id = p_evento;
  if v_clube is null or not tem_papel(v_clube, papeis_direcao())
     or not exists (select 1 from evento_modelo where id = p_modelo and clube_id = v_clube) then
    raise exception 'sem_permissao' using hint = 'Evento ou modelo indisponível para você.';
  end if;

  select coalesce(max(ordem), 0) into v_base from evento_secao where evento_id = p_evento;

  insert into evento_secao (evento_id, titulo, conteudo, ordem, visibilidade)
  select p_evento, titulo, conteudo, v_base + ordem, visibilidade
    from evento_modelo_secao where modelo_id = p_modelo;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke execute on function salvar_como_modelo(uuid, text) from public;
revoke execute on function aplicar_modelo(uuid, uuid)     from public;
grant  execute on function salvar_como_modelo(uuid, text) to authenticated;
grant  execute on function aplicar_modelo(uuid, uuid)     to authenticated;


-- =============================================================================
-- 5. CHAMADA LIGADA A UM EVENTO
-- =============================================================================

alter table chamada add column if not exists evento_id uuid references evento(id) on delete set null;

-- Chamada ligada a um evento é presença no evento: vira "Evento ou acampamento",
-- mesmo que feita por um instrutor. Só continua "Instrução" se estiver ligada a uma
-- instrução agendada. Um tipo escolhido de propósito (ex.: Classe bíblica) é mantido.
create or replace function chamada_tipo_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.evento_id is not null and new.instrucao_id is null then
    if not exists (select 1 from evento where id = new.evento_id and clube_id = new.clube_id) then
      raise exception 'evento_outro_clube' using hint = 'O evento precisa ser do mesmo clube da chamada.';
    end if;
    if new.tipo_id is null or new.tipo_id in (
         select id from atividade_tipo where clube_id is null and nome in ('Reunião','Instrução')) then
      new.tipo_id := (select id from atividade_tipo where clube_id is null and nome = 'Evento ou acampamento');
      new.instrutor_id := null;
    end if;
  end if;
  return new;
end;
$$;

-- Roda depois do trigger da 008 (ordem alfabética: chamada_definir_tipo < chamada_tipo_evento)
drop trigger if exists chamada_tipo_evento on chamada;
create trigger chamada_tipo_evento
  before insert on chamada
  for each row execute function chamada_tipo_evento();

-- =============================================================================
-- FIM DO HISTÓRICO
-- Próximas migrations: telas do frontend para cargos, instrução, chamada e eventos
-- =============================================================================