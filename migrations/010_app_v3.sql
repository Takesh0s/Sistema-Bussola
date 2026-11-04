-- =============================================================================
-- MIGRATION 010 — Ajustes para o app v3 (Expo)
--
-- 1. Nomes dos clubes: "Clube Bússola" e "Clube Pioneiros" (criado se faltar)
-- 2. Chamada: falta justificada
-- 3. Instrução: horário e local
-- 4. Perfil: tema (claro/escuro/sistema) e cor do app salvos na conta
-- =============================================================================


-- =============================================================================
-- 1. CLUBES
-- =============================================================================

update clube set nome = 'Clube Bússola'   where nome = 'Bússola';
update clube set nome = 'Clube Pioneiros' where nome = 'Pioneiros';

insert into clube (nome, cidade, associacao_id)
select v.nome, 'Taguatinga Norte - DF', a.id
from (values ('Clube Bússola'), ('Clube Pioneiros')) as v(nome)
cross join (select id from associacao where sigla = 'APlaC' limit 1) as a
where not exists (select 1 from clube c where c.nome = v.nome);


-- =============================================================================
-- 2. FALTA JUSTIFICADA
-- Presente (P), falta (F) ou falta justificada (J). Justificada nunca é presente.
-- =============================================================================

alter table chamada_presenca add column if not exists justificada boolean not null default false;

alter table chamada_presenca drop constraint if exists chamada_presenca_justificada;
alter table chamada_presenca add constraint chamada_presenca_justificada
  check (not (presente and justificada));


-- =============================================================================
-- 3. HORÁRIO E LOCAL DA INSTRUÇÃO
-- =============================================================================

alter table instrucao add column if not exists inicio time;
alter table instrucao add column if not exists fim    time;
alter table instrucao add column if not exists local  text;

alter table instrucao drop constraint if exists instrucao_horario;
alter table instrucao add constraint instrucao_horario
  check (fim is null or inicio is null or fim >= inicio);


-- =============================================================================
-- 4. APARÊNCIA DO APP
-- cor_classe guarda o nome da classe da paleta (ou 'Padrão'). O app só oferece
-- as cores permitidas: classe do desbravador, classe da unidade que aconselha e,
-- para quem concluiu uma classe de liderança, a classe de liderança atual.
-- =============================================================================

alter table perfil_usuario add column if not exists tema text
  check (tema in ('claro','escuro','sistema'));
alter table perfil_usuario add column if not exists cor_classe text;

-- A 007 liberou só nome e sexo; o usuário também edita a própria aparência
grant update (tema, cor_classe) on perfil_usuario to authenticated;
