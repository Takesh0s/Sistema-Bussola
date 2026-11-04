-- =============================================================================
-- MIGRATION 009 — Eventos com seções editáveis
--
-- 1. Quem é do clube (perfil ou desbravador logado)
-- 2. Evento: rascunho até ser publicado
-- 3. Seções livres, cada uma com seu nível de visibilidade
-- 4. Modelos de seções (ex.: "Acampamento padrão")
-- 5. Chamada ligada a um evento
--
-- Visibilidade de uma seção:
--   direcao   → diretor, associados, secretário e tesoureiro
--   lideranca → direção + conselheiros, instrutores e capelão
--   todos     → todos do clube, incluindo os desbravadores
-- Só a direção cria e edita eventos, seções e modelos.
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
