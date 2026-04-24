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