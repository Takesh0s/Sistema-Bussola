-- =============================================================================
-- 012 · Cartão de classe de quem tem cargo
-- -----------------------------------------------------------------------------
-- Adultos com cargo (diretor, conselheiro...) também fazem classes (Líder, Líder
-- Máster...) e precisam do próprio cartão. O cartão é um cadastro em
-- desbravador ligado ao perfil (perfil_id).
-- 1. criar_meu_cartao: a pessoa cria o próprio cadastro de membro.
-- 2. vincular_conta_membro: a secretaria liga um cadastro já existente a uma
--    conta do clube (ou desliga), para não duplicar.
-- 3. Ninguém avalia a si mesmo: quem tem cargo não marca requisitos nem
--    especialidades no próprio cartão, nem se inclui ao concluir instrução.
-- Pode rodar mais de uma vez.
-- =============================================================================

-- ── 1. Criar o próprio cartão ───────────────────────────────────────────────
create or replace function criar_meu_cartao(p_classe uuid, p_data_nascimento date, p_sexo text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_perfil perfil_usuario%rowtype;
  v_id     uuid;
begin
  select * into v_perfil from perfil_usuario where auth_user_id = auth.uid();
  if not found or v_perfil.clube_id is null then
    raise exception 'sem_clube' using hint = 'Sua conta precisa estar ligada a um clube.';
  end if;
  if meu_desbravador_id() is not null then
    raise exception 'cartao_existente' using hint = 'Você já tem um cartão de classe.';
  end if;
  if p_sexo is null or p_sexo not in ('M','F') then
    raise exception 'sexo_obrigatorio' using hint = 'Escolha o sexo.';
  end if;
  if p_data_nascimento is not null and p_data_nascimento > current_date then
    raise exception 'nascimento_futuro' using hint = 'A data de nascimento está no futuro.';
  end if;

  insert into desbravador (nome, clube_id, classe_id, data_nascimento, sexo, perfil_id)
  values (v_perfil.nome_completo, v_perfil.clube_id, p_classe, p_data_nascimento, p_sexo, v_perfil.id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function criar_meu_cartao(uuid, date, text) from public;
grant  execute on function criar_meu_cartao(uuid, date, text) to authenticated;

-- ── 2. Secretaria liga (ou desliga) um cadastro a uma conta do clube ────────
create or replace function vincular_conta_membro(p_desbravador uuid, p_perfil uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_clube uuid;
begin
  select clube_id into v_clube from desbravador where id = p_desbravador;
  if v_clube is null or not tem_papel(v_clube, papeis_secretaria()) then
    raise exception 'sem_permissao' using hint = 'Só a secretaria do clube liga cadastros a contas.';
  end if;

  if p_perfil is not null then
    if not exists (select 1 from perfil_usuario where id = p_perfil and clube_id = v_clube) then
      raise exception 'perfil_outro_clube' using hint = 'Essa conta não é deste clube.';
    end if;
    if exists (select 1 from desbravador where perfil_id = p_perfil and id <> p_desbravador) then
      raise exception 'perfil_ja_vinculado' using hint = 'Essa conta já tem um cartão de classe.';
    end if;
  end if;

  update desbravador set perfil_id = p_perfil where id = p_desbravador;
end;
$$;

revoke execute on function vincular_conta_membro(uuid, uuid) from public;
grant  execute on function vincular_conta_membro(uuid, uuid) to authenticated;

-- ── 3. Ninguém avalia a si mesmo ────────────────────────────────────────────
drop policy if exists "Desbravador ve o proprio progresso" on membro_requisito;
create policy "Desbravador ve o proprio progresso" on membro_requisito for select
  using (desbravador_id = meu_desbravador_id());

drop policy if exists "Marcar progresso" on membro_requisito;
create policy "Marcar progresso" on membro_requisito for all
  using (tem_papel(clube_id, papeis_lideranca()) and desbravador_id is distinct from meu_desbravador_id())
  with check (tem_papel(clube_id, papeis_lideranca()) and desbravador_id is distinct from meu_desbravador_id());

drop policy if exists "Lideranca marca especialidades" on desbravador_especialidade;
create policy "Lideranca marca especialidades" on desbravador_especialidade for all
  using (desbravador_id is distinct from meu_desbravador_id()
         and exists (select 1 from desbravador d where d.id = desbravador_id and tem_papel(d.clube_id, papeis_lideranca())))
  with check (desbravador_id is distinct from meu_desbravador_id()
              and exists (select 1 from desbravador d where d.id = desbravador_id and tem_papel(d.clube_id, papeis_lideranca())));

drop policy if exists "Gerir inscricoes" on inscricao_classe;
create policy "Gerir inscricoes" on inscricao_classe for all
  using (tem_papel(clube_id, papeis_lideranca()) and desbravador_id is distinct from meu_desbravador_id())
  with check (tem_papel(clube_id, papeis_lideranca()) and desbravador_id is distinct from meu_desbravador_id());

-- concluir_instrucao (da 011) com a mesma regra
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

  if meu_desbravador_id() = any (p_desbravadores) then
    raise exception 'autoavaliacao' using hint = 'Você não pode concluir requisitos no seu próprio cartão. Peça a outra pessoa da liderança.';
  end if;

  if exists (select 1 from unnest(p_desbravadores) d
              where not exists (select 1 from desbravador
                                 where id = d and clube_id = v_inst.clube_id)) then
    raise exception 'desbravador_outro_clube' using hint = 'Há membros que não são deste clube.';
  end if;

  v_avaliador := coalesce(v_inst.instrutor_id, v_eu);

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
