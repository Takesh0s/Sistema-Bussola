-- =============================================================================
-- 011 · Cadastros, instruções por especialidade, brasão e convite por e-mail
-- -----------------------------------------------------------------------------
-- 1. Unidades e desbravadores: qualquer pessoa do clube podia criar, editar e
--    apagar. Agora só a secretaria (diretor, associados e secretário) grava;
--    a leitura continua para quem é do clube.
-- 2. Especialidades do desbravador: o próprio membro passa a ver as suas, e só
--    a liderança grava.
-- 3. Instrução: pode ser de uma especialidade inteira (sem escolher requisitos
--    antes) e pode ter um instrutor de fora, sem conta no app. Ao concluir uma
--    especialidade não terminada, escolhem-se os requisitos cumpridos no dia.
-- 4. Evento: marca quando não tem horário (só datas).
-- 5. Clube: brasão (imagem no Storage, bucket público "brasoes").
-- 6. Convite: e-mail de quem foi convidado; consultar_convite devolve o brasão.
-- Pode rodar mais de uma vez.
-- =============================================================================

-- ── 1. Unidades e desbravadores ─────────────────────────────────────────────
create or replace function papeis_secretaria() returns text[]
language sql immutable as $$
  select array['admin_sistema','admin_associacao','diretor','diretor_associado','secretario'];
$$;

drop policy if exists "Acesso por clube - unidade"     on unidade;
drop policy if exists "Ver unidades do clube"          on unidade;
drop policy if exists "Secretaria cadastra unidades"   on unidade;
drop policy if exists "Secretaria edita unidades"      on unidade;
drop policy if exists "Secretaria exclui unidades"     on unidade;

create policy "Ver unidades do clube" on unidade for select
  using (clube_id = clube_do_usuario() or tem_papel(clube_id, papeis_lideranca_ampla()));
create policy "Secretaria cadastra unidades" on unidade for insert
  with check (tem_papel(clube_id, papeis_secretaria()));
create policy "Secretaria edita unidades" on unidade for update
  using (tem_papel(clube_id, papeis_secretaria()))
  with check (tem_papel(clube_id, papeis_secretaria()));
create policy "Secretaria exclui unidades" on unidade for delete
  using (tem_papel(clube_id, papeis_secretaria()));

drop policy if exists "Acesso por clube - desbravador"     on desbravador;
drop policy if exists "Ver desbravadores do clube"         on desbravador;
drop policy if exists "Secretaria cadastra desbravadores"  on desbravador;
drop policy if exists "Secretaria edita desbravadores"     on desbravador;
drop policy if exists "Secretaria exclui desbravadores"    on desbravador;

create policy "Ver desbravadores do clube" on desbravador for select
  using (clube_id = meu_clube_id() or tem_papel(clube_id, papeis_lideranca_ampla()));
create policy "Secretaria cadastra desbravadores" on desbravador for insert
  with check (tem_papel(clube_id, papeis_secretaria()));
create policy "Secretaria edita desbravadores" on desbravador for update
  using (tem_papel(clube_id, papeis_secretaria()))
  with check (tem_papel(clube_id, papeis_secretaria()));
create policy "Secretaria exclui desbravadores" on desbravador for delete
  using (tem_papel(clube_id, papeis_secretaria()));

-- O vínculo com a conta (auth_user_id/perfil_id) não é editado pelo app.
revoke insert, update on desbravador from anon, authenticated;
grant insert (nome, clube_id, unidade_id, classe_id, data_nascimento, sexo, justificativa_sexo, contato)
  on desbravador to authenticated;
grant update (nome, unidade_id, classe_id, data_nascimento, sexo, justificativa_sexo, contato)
  on desbravador to authenticated;

-- A unidade precisa ser do mesmo clube do desbravador
create or replace function desbravador_validar_unidade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.unidade_id is not null and not exists (
    select 1 from unidade where id = new.unidade_id and clube_id = new.clube_id
  ) then
    raise exception 'unidade_outro_clube' using hint = 'A unidade escolhida não é deste clube.';
  end if;
  return new;
end;
$$;

drop trigger if exists desbravador_validar_unidade on desbravador;
create trigger desbravador_validar_unidade
  before insert or update of unidade_id, clube_id on desbravador
  for each row execute function desbravador_validar_unidade();

-- ── 2. Especialidades do desbravador ────────────────────────────────────────
drop policy if exists "Acesso por clube - desbravador_especialidade" on desbravador_especialidade;
drop policy if exists "Ver especialidades do clube"   on desbravador_especialidade;
drop policy if exists "Membro ve suas especialidades" on desbravador_especialidade;
drop policy if exists "Lideranca marca especialidades" on desbravador_especialidade;

create policy "Ver especialidades do clube" on desbravador_especialidade for select
  using (desbravador_id in (select id from desbravador where clube_id = meu_clube_id()));
create policy "Membro ve suas especialidades" on desbravador_especialidade for select
  using (desbravador_id = meu_desbravador_id());
create policy "Lideranca marca especialidades" on desbravador_especialidade for all
  using (exists (select 1 from desbravador d where d.id = desbravador_id and tem_papel(d.clube_id, papeis_lideranca())))
  with check (exists (select 1 from desbravador d where d.id = desbravador_id and tem_papel(d.clube_id, papeis_lideranca())));

-- ── 3. Instrução ────────────────────────────────────────────────────────────
alter table instrucao add column if not exists especialidade_id  uuid references especialidades(id) on delete restrict;
alter table instrucao add column if not exists instrutor_externo text;
alter table instrucao alter column instrutor_id drop not null;

do $$ begin
  alter table instrucao add constraint instrucao_um_instrutor
    check ((instrutor_id is not null) <> (nullif(btrim(instrutor_externo), '') is not null));
exception when duplicate_object then null; end $$;

-- Instrutor de fora não tem conta para responder: a instrução já nasce aceita
-- e quem pediu (ou a liderança) faz a chamada e conclui.
create or replace function instrucao_validar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.atribuido_por     := coalesce(meu_perfil_id(), new.atribuido_por);
  new.instrutor_externo := nullif(btrim(new.instrutor_externo), '');

  if new.instrutor_id is null then
    new.status        := 'aceita';
    new.respondido_em := now();
  else
    new.status := 'pendente';
    if not exists (select 1 from perfil_papel
                    where perfil_id = new.instrutor_id and clube_id = new.clube_id and ativo) then
      raise exception 'instrutor_sem_cargo'
        using hint = 'O instrutor precisa ter um cargo ativo no clube. Para alguém de fora, use "Instrutor de fora".';
    end if;
  end if;

  if new.especialidade_id is not null and not exists (
    select 1 from especialidades
     where id = new.especialidade_id and (clube_id is null or clube_id = new.clube_id)
  ) then
    raise exception 'especialidade_invalida' using hint = 'Especialidade não encontrada.';
  end if;

  return new;
end;
$$;

drop function if exists concluir_instrucao(uuid, uuid[]);
create or replace function concluir_instrucao(
  p_instrucao               uuid,
  p_desbravadores           uuid[],
  p_especialidade_concluida boolean default true,
  p_requisitos              uuid[]  default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_inst      instrucao%rowtype;
  v_req       instrucao_requisito%rowtype;
  v_desb      uuid;
  v_rid       uuid;
  v_eu        uuid := meu_perfil_id();
  v_avaliador uuid;
  v_total     int := 0;
begin
  select * into v_inst from instrucao where id = p_instrucao for update;

  if not found or v_inst.status <> 'aceita' or v_eu is null or not (
       v_inst.instrutor_id = v_eu
    or (v_inst.instrutor_id is null
        and (v_inst.atribuido_por = v_eu or tem_papel(v_inst.clube_id, papeis_lideranca())))
  ) then
    raise exception 'instrucao_indisponivel'
      using hint = 'Só o instrutor conclui (com instrutor de fora, quem pediu ou a liderança), e apenas uma instrução aceita.';
  end if;

  if coalesce(array_length(p_desbravadores, 1), 0) = 0 then
    raise exception 'sem_presentes' using hint = 'Marque ao menos um presente.';
  end if;

  if exists (select 1 from unnest(p_desbravadores) d
              where not exists (select 1 from desbravador
                                 where id = d and clube_id = v_inst.clube_id)) then
    raise exception 'desbravador_outro_clube' using hint = 'Há membros que não são deste clube.';
  end if;

  v_avaliador := coalesce(v_inst.instrutor_id, v_eu);

  -- Requisitos escolhidos no pedido (classe ou especialidade)
  for v_req in select * from instrucao_requisito where instrucao_id = p_instrucao loop
    foreach v_desb in array p_desbravadores loop
      update membro_requisito
         set concluido = true, avaliado_por = v_avaliador, concluido_em = now(), instrucao_id = v_inst.id
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
           true, v_inst.clube_id, v_avaliador, now(), v_inst.id);
      end if;
      v_total := v_total + 1;
    end loop;
  end loop;

  -- Especialidade inteira
  if v_inst.especialidade_id is not null then
    if not p_especialidade_concluida and exists (
      select 1 from unnest(coalesce(p_requisitos, '{}')) r
       where not exists (select 1 from requisito_especialidade
                          where id = r and especialidade_id = v_inst.especialidade_id)
    ) then
      raise exception 'requisito_invalido' using hint = 'Há requisitos que não são desta especialidade.';
    end if;

    foreach v_desb in array p_desbravadores loop
      update desbravador_especialidade
         set concluida = concluida or p_especialidade_concluida
       where desbravador_id = v_desb and especialidade_id = v_inst.especialidade_id;
      if not found then
        insert into desbravador_especialidade (desbravador_id, especialidade_id, concluida)
        values (v_desb, v_inst.especialidade_id, p_especialidade_concluida);
      end if;

      if p_especialidade_concluida then
        v_total := v_total + 1;
      else
        foreach v_rid in array coalesce(p_requisitos, '{}') loop
          update membro_requisito
             set concluido = true, avaliado_por = v_avaliador, concluido_em = now(), instrucao_id = v_inst.id
           where desbravador_id = v_desb and requisito_id = v_rid;
          if not found then
            insert into membro_requisito
              (desbravador_id, requisito_id, concluido, clube_id, avaliado_por, concluido_em, instrucao_id)
            values
              (v_desb, v_rid, true, v_inst.clube_id, v_avaliador, now(), v_inst.id);
          end if;
          v_total := v_total + 1;
        end loop;
      end if;
    end loop;
  end if;

  update instrucao set status = 'concluida', concluido_em = now() where id = p_instrucao;
  return v_total;
end;
$$;

revoke execute on function concluir_instrucao(uuid, uuid[], boolean, uuid[]) from public;
grant  execute on function concluir_instrucao(uuid, uuid[], boolean, uuid[]) to authenticated;

-- ── 4. Evento sem horário ───────────────────────────────────────────────────
alter table evento add column if not exists sem_horario boolean not null default false;

-- ── 5. Brasão do clube ──────────────────────────────────────────────────────
alter table clube add column if not exists brasao_url text;

do $$ begin
  alter table clube add constraint clube_brasao_url_check
    check (brasao_url is null
        or brasao_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brasoes/');
exception when duplicate_object then null; end $$;

-- Só diretor e associados trocam, e só essa coluna
revoke update on clube from anon, authenticated;
grant  update (brasao_url) on clube to authenticated;
drop policy if exists "Direcao troca o brasao" on clube;
create policy "Direcao troca o brasao" on clube for update
  using (tem_papel(id, array['admin_sistema','admin_associacao','diretor','diretor_associado']))
  with check (tem_papel(id, array['admin_sistema','admin_associacao','diretor','diretor_associado']));

-- Arquivo no Storage: brasoes/<clube_id>/brasao
create or replace function pode_trocar_brasao(p_objeto text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_clube uuid;
begin
  begin
    v_clube := split_part(p_objeto, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return tem_papel(v_clube, array['admin_sistema','admin_associacao','diretor','diretor_associado']);
end;
$$;

do $do$ begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schema storage ausente (banco de teste): bucket não criado.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('brasoes', 'brasoes', true, 2097152, array['image/png','image/jpeg','image/webp'])
  on conflict (id) do update
    set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "Brasao: ver" on storage.objects';
  execute 'drop policy if exists "Brasao: enviar" on storage.objects';
  execute 'drop policy if exists "Brasao: trocar" on storage.objects';
  execute 'drop policy if exists "Brasao: apagar" on storage.objects';
  execute $p$create policy "Brasao: ver" on storage.objects for select to authenticated
    using (bucket_id = 'brasoes')$p$;
  execute $p$create policy "Brasao: enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'brasoes' and public.pode_trocar_brasao(name))$p$;
  execute $p$create policy "Brasao: trocar" on storage.objects for update to authenticated
    using (bucket_id = 'brasoes' and public.pode_trocar_brasao(name))
    with check (bucket_id = 'brasoes' and public.pode_trocar_brasao(name))$p$;
  execute $p$create policy "Brasao: apagar" on storage.objects for delete to authenticated
    using (bucket_id = 'brasoes' and public.pode_trocar_brasao(name))$p$;
end $do$;

-- ── 6. Convite ──────────────────────────────────────────────────────────────
alter table convite add column if not exists email text;

do $$ begin
  alter table convite add constraint convite_email_check
    check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
exception when duplicate_object then null; end $$;

drop function if exists consultar_convite(text);
create function consultar_convite(p_token text)
returns table (clube_nome text, clube_cidade text, papel text, valido boolean, brasao_url text, unidade_nome text)
language sql stable security definer set search_path = public as $$
  select c.nome, c.cidade, cv.papel,
         (cv.usado_por is null and cv.expira_em > now()),
         c.brasao_url, u.nome
  from convite cv
  join clube c on c.id = cv.clube_id
  left join unidade u on u.id = cv.unidade_id
  where cv.token = p_token;
$$;

revoke execute on function consultar_convite(text) from public;
grant  execute on function consultar_convite(text) to anon, authenticated;
