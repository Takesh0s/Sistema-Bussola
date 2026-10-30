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
-- FIM DO HISTÓRICO
-- Próximas migrations: aulas e chamada (008); especialidades oficiais (script de importação)
-- =============================================================================