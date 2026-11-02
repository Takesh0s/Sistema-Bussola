-- =============================================================================
-- MIGRATION 008 — Inscrição em classes, instrução e chamada
--
-- 1. Cadastro único de pessoas: adultos da direção também são desbravadores
-- 2. Requisitos: Classes Avançadas e cartão de Classes Agrupadas
-- 3. Inscrição em classe (regular, avançada, agrupada) com prazo automático
-- 4. Progresso: quem pode marcar requisitos
-- 5. Instrução: atribuição ao instrutor, aceite e conclusão em lote
-- 6. Chamada por tipo de atividade (reunião, classe bíblica, instrução...)
-- 7. Participação espiritual (visão do capelão)
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
