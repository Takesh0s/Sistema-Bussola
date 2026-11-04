// Catálogo de especialidades (oficiais + do clube) com busca, filtros e progresso.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Award } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DetalheEspecialidade } from '@/components/especialidade';
import { Tela, useLargo } from '@/components/layout';
import { Botao, Campo, Cartao, Carregando, Chip, ChipFiltro, Erro, Icone, Item, Progresso, T, Vazio } from '@/components/ui';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTema } from '@/theme';

const PASSO = 60;

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Especialidades() {
  const { membro } = useAuth();
  const { cores } = useTema();
  const largo = useLargo();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<string>('Todas');
  const [limite, setLimite] = useState(PASSO);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const cat = useQuery({ queryKey: ['catalogo'], queryFn: api.catalogoEspecialidades, staleTime: 1000 * 60 * 60 });
  const prog = useQuery({ queryKey: ['progresso-esp', membro?.id], queryFn: () => api.progressoEspecialidades(membro!.id), enabled: !!membro });

  const areas = useMemo(() => [...new Set((cat.data ?? []).map((e) => e.area).filter(Boolean) as string[])].sort(), [cat.data]);
  const lista = useMemo(() => {
    const q = semAcento(busca.trim());
    return (cat.data ?? []).filter((e) => {
      const p = prog.data?.[e.id];
      if (filtro === 'Minhas' && !p) return false;
      if (filtro === 'Em andamento' && (!p || p.concluida)) return false;
      if (filtro === 'Concluídas' && !p?.concluida) return false;
      if (!['Todas', 'Minhas', 'Em andamento', 'Concluídas'].includes(filtro) && e.area !== filtro) return false;
      return !q || semAcento(e.nome).includes(q) || semAcento(e.codigo ?? '').includes(q);
    });
  }, [cat.data, prog.data, busca, filtro]);

  const concluidas = Object.values(prog.data ?? {}).filter((p) => p.concluida).length;
  const andamento = Object.keys(prog.data ?? {}).length - concluidas;

  function abrir(id: string) {
    if (largo) setSelecionada(id);
    else router.push(`/especialidades/${id}`);
  }

  function status(id: string) {
    const p = prog.data?.[id];
    if (!p) return <Chip texto="Nova" bg="superficie2" fg="texto2" />;
    if (p.concluida) return <Chip texto="Concluída" bg="sucesso" fg="superficie" />;
    return <Chip texto={`${p.feitos} de ${p.total || '?'}`} />;
  }

  const filtros = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {['Todas', ...(membro ? ['Minhas', 'Em andamento', 'Concluídas'] : []), ...areas].map((f) => (
        <ChipFiltro key={f} texto={f} ativo={filtro === f} onPress={() => { setFiltro(f); setLimite(PASSO); }} />
      ))}
    </ScrollView>
  );

  const campoBusca = <Campo value={busca} onChangeText={(v) => { setBusca(v); setLimite(PASSO); }} placeholder="Buscar por nome ou código" prefixo="⌕" autoCorrect={false} />;
  const resumo = (
    <T s={13} w="medio" c="texto2">
      {lista.length} especialidades{membro ? ` · ${concluidas} concluídas · ${andamento} em andamento` : ''}
    </T>
  );

  if (cat.isLoading) return <Tela titulo="Especialidades"><Carregando /></Tela>;
  if (cat.error) return <Tela titulo="Especialidades"><Erro erro={cat.error} tentar={() => cat.refetch()} /></Tela>;

  const mais = lista.length > limite ? <Botao titulo={`Mostrar mais (${lista.length - limite})`} variante="out" onPress={() => setLimite((l) => l + PASSO)} /> : null;

  if (largo) {
    const atual = selecionada ?? lista[0]?.id ?? null;
    return (
      <Tela titulo="Especialidades" sobre={`${cat.data?.length ?? 0} especialidades no catálogo`} acoes={<View style={{ width: 380 }}>{campoBusca}</View>}>
        <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 16 }}>
            {filtros}
            {resumo}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {lista.slice(0, limite).map((e) => {
                const p = prog.data?.[e.id];
                return (
                  <Pressable key={e.id} onPress={() => abrir(e.id)} style={{ width: '31.5%' }}>
                    <Cartao gap={10} borda={atual === e.id ? 'primaria' : 'borda'}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Icone icone={Award} bg="acentoSuave" fg="acento" tamanho={40} />
                        {status(e.id)}
                      </View>
                      <T s={16} w="negrito" linhas={1}>{e.nome}</T>
                      <T s={13} c="texto2" linhas={1}>{[e.codigo, e.area].filter(Boolean).join(' · ')}</T>
                      <Progresso valor={p ? (p.concluida ? 1 : p.total ? p.feitos / p.total : 0.05) : 0} trilho="superficie2" cor={p?.concluida ? 'sucesso' : 'primaria'} altura={6} />
                    </Cartao>
                  </Pressable>
                );
              })}
            </View>
            {mais}
            {!lista.length ? <Vazio texto="Nenhuma especialidade encontrada." icone={Award} /> : null}
          </View>
          <View style={{ width: 520 }}>{atual ? <DetalheEspecialidade key={atual} id={atual} /> : null}</View>
        </View>
      </Tela>
    );
  }

  return (
    <Tela titulo="Especialidades" gap={14} aoAtualizar={() => { cat.refetch(); prog.refetch(); }} atualizando={cat.isRefetching}>
      {campoBusca}
      {filtros}
      {resumo}
      {lista.slice(0, limite).map((e) => (
        <Item key={e.id} esquerda={<Icone icone={Award} bg="acentoSuave" fg="acento" tamanho={44} />} titulo={e.nome}
          sub={[e.codigo, e.area].filter(Boolean).join(' · ')} direita={status(e.id)} onPress={() => abrir(e.id)} />
      ))}
      {mais}
      {!lista.length ? <Vazio texto="Nenhuma especialidade encontrada." icone={Award} /> : null}
      <View style={{ height: 1, backgroundColor: cores.fundo }} />
    </Tela>
  );
}
