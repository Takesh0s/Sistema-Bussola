-- =============================================================================
-- Sistema Bússola — Sprint 5: Multitenancy + Sistema de Convites
-- Execute este SQL inteiro no Supabase SQL Editor
-- =============================================================================

-- Extensão UUID (já deve existir, mas garantindo)
create extension if not exists "uuid-ossp";

-- =============================================================================
-- HIERARQUIA ORGANIZACIONAL (dados globais — sem RLS por clube)
-- =============================================================================

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

-- =============================================================================
-- PERFIL DE USUÁRIO (liga auth.users ao clube + papel)
-- =============================================================================

-- Papéis possíveis no sistema
-- admin_sistema: pode criar unioes, associacoes e clubes (só via SQL/service_role)
-- regional / pastor: acesso de leitura em todos os clubes de sua associacao
-- diretor: acesso total ao seu clube; aprova convites e gerencia papéis
-- diretor_associado: acesso operacional completo
-- secretario: acesso a cadastros, atas, patrimônio
-- tesoureiro: acesso a caixa e mensalidades

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

-- =============================================================================
-- SISTEMA DE CONVITES
-- =============================================================================

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

-- =============================================================================
-- ADICIONA clube_id NAS TABELAS OPERACIONAIS
-- =============================================================================

-- Se as tabelas já existem, adiciona a coluna; se não existem, cria do zero.
-- Tabelas que precisam de clube_id: conselheiro, unidade, desbravador,
-- especialidades, mensalidade, caixa, patrimonio, atas, atos

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

-- =============================================================================
-- FUNÇÃO AUXILIAR: retorna o clube_id do usuário logado
-- Usada nas policies RLS para não fazer subquery a cada linha
-- =============================================================================

create or replace function meu_clube_id()
returns uuid
language sql stable
as $$
  select clube_id from perfil_usuario
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function meu_papel()
returns text
language sql stable
as $$
  select papel from perfil_usuario
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- =============================================================================
-- RLS — Ativa e cria políticas
-- =============================================================================

-- ── Tabelas globais (uniao, associacao, clube): leitura livre p/ autenticados
alter table uniao       enable row level security;
alter table associacao  enable row level security;
alter table clube       enable row level security;

create policy "Leitura livre - uniao"
  on uniao for select using (auth.role() = 'authenticated');

create policy "Leitura livre - associacao"
  on associacao for select using (auth.role() = 'authenticated');

create policy "Leitura livre - clube"
  on clube for select using (auth.role() = 'authenticated');

-- ── perfil_usuario: cada um vê e edita apenas o próprio; diretor vê do clube
alter table perfil_usuario enable row level security;

create policy "Ver proprio perfil"
  on perfil_usuario for select
  using (auth_user_id = auth.uid() or clube_id = meu_clube_id());

create policy "Inserir proprio perfil"
  on perfil_usuario for insert
  with check (auth_user_id = auth.uid());

create policy "Editar proprio perfil"
  on perfil_usuario for update
  using (auth_user_id = auth.uid());

-- ── convite: diretor do clube gerencia; qualquer autenticado pode ler pelo token
alter table convite enable row level security;

create policy "Diretor gerencia convites"
  on convite for all
  using (
    clube_id = meu_clube_id()
    and meu_papel() in ('diretor','admin_sistema')
  )
  with check (
    clube_id = meu_clube_id()
    and meu_papel() in ('diretor','admin_sistema')
  );

create policy "Qualquer autenticado le convite pelo token"
  on convite for select
  using (auth.role() = 'authenticated');

-- ── Tabelas operacionais: filtro por clube_id
alter table conselheiro enable row level security;
alter table unidade      enable row level security;
alter table desbravador  enable row level security;
alter table especialidades enable row level security;
alter table mensalidade  enable row level security;
alter table caixa        enable row level security;
alter table patrimonio   enable row level security;
alter table atas         enable row level security;
alter table atos         enable row level security;

-- Macro para criar policy padrão por clube
do $$ declare tabelas text[] := array[
  'conselheiro','unidade','desbravador','especialidades',
  'mensalidade','caixa','patrimonio','atas','atos'
];
t text;
begin
  foreach t in array tabelas loop
    execute format(
      'create policy "Acesso por clube - %I" on %I for all
       using (clube_id = meu_clube_id())
       with check (clube_id = meu_clube_id());', t, t
    );
  end loop;
end $$;

-- unidade_membro: acesso via unidade do clube
alter table unidade_membro enable row level security;

create policy "Acesso por clube - unidade_membro"
  on unidade_membro for all
  using (
    unidade_id in (
      select id from unidade where clube_id = meu_clube_id()
    )
  )
  with check (
    unidade_id in (
      select id from unidade where clube_id = meu_clube_id()
    )
  );

-- desbravador_especialidade: acesso via desbravador do clube
alter table desbravador_especialidade enable row level security;

create policy "Acesso por clube - desbravador_especialidade"
  on desbravador_especialidade for all
  using (
    desbravador_id in (
      select id from desbravador where clube_id = meu_clube_id()
    )
  )
  with check (
    desbravador_id in (
      select id from desbravador where clube_id = meu_clube_id()
    )
  );

-- classe: leitura global (são dados compartilhados), escrita só admin
alter table classe enable row level security;

create policy "Leitura global - classe"
  on classe for select using (auth.role() = 'authenticated');

-- =============================================================================
-- DADOS INICIAIS — Hierarquia da DSA Brasil
-- =============================================================================

-- Divisões / Uniões principais do Brasil (Divisão Sul Americana)
insert into uniao (nome, sigla) values
  ('União Adventista Norte Brasileira', 'UANB'),
  ('União Adventista Nordeste Brasileira', 'UANEB'),
  ('União Adventista Centro-Oeste Brasileira', 'UCOB'),
  ('União Adventista Leste Brasileira', 'ULBAS'),
  ('União Adventista Sul Brasileira', 'UASB'),
  ('União Adventista Sul-Rio Grandense', 'UNASP'),
  ('União Adventista Paulista', 'UAP')
on conflict do nothing;

-- UCOB — Associações do Centro-Oeste
insert into associacao (nome, sigla, uniao_id)
select nome, sigla, u.id from (values
  ('Associação Planalto Central', 'APlaC'),
  ('Associação Centro-Oeste Brasileira', 'ABC'),
  ('Associação Brasil Central Paulista', 'ABCP'),
  ('Associação Goiana de Igrejas Adventistas', 'AGR'),
  ('Associação Mato-Grossense', 'AME'),
  ('Associação Adventista de Mato Grosso do Sul', 'AMMT'),
  ('Associação Tocantins', 'APTC')
) as t(nome, sigla)
cross join (select id from uniao where sigla = 'UCOB') as u
on conflict do nothing;

-- =============================================================================
-- DADOS DE EXEMPLO — 1 clube para você testar
-- (O admin do sistema cria clubes via SQL ou futura interface admin)
-- =============================================================================

insert into clube (nome, cidade, associacao_id)
select 'Clube Bússola (Teste)', 'Taguatinga - DF', a.id
from associacao a where a.sigla = 'APlaC'
on conflict do nothing;

-- =============================================================================
-- FIM — Próximos passos:
-- 1. Copie o ID do clube criado: SELECT id, nome FROM clube;
-- 2. Cole no .env.local: CLUBE_ADMIN_ID=<uuid>
-- 3. Acesse o sistema e faça login — o onboarding vai aparecer
-- =============================================================================
