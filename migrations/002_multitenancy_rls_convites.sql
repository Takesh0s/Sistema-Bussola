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

create or replace function meu_clube_id()
returns uuid language sql stable as $$
  select clube_id from perfil_usuario where auth_user_id = auth.uid() limit 1;
$$;

create or replace function meu_papel()
returns text language sql stable as $$
  select papel from perfil_usuario where auth_user_id = auth.uid() limit 1;
$$;

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

alter table convite enable row level security;

drop policy if exists "Diretor gerencia convites"                on convite;
drop policy if exists "Qualquer autenticado le convite pelo token" on convite;

create policy "Diretor gerencia convites"
  on convite for all
  using (clube_id = meu_clube_id() and meu_papel() in ('diretor','admin_sistema'))
  with check (clube_id = meu_clube_id() and meu_papel() in ('diretor','admin_sistema'));
create policy "Qualquer autenticado le convite pelo token"
  on convite for select using (auth.role() = 'authenticated');

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