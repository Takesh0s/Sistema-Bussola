drop policy if exists "Ver proprio perfil" on perfil_usuario;

create policy "Ver proprio perfil"
  on perfil_usuario for select
  using (auth_user_id = auth.uid());

create or replace function meu_clube_id()
returns uuid
language sql stable
security definer
as $$
  select clube_id from perfil_usuario
  where auth_user_id = auth.uid()
  limit 1;
$$;