// Ficha do desbravador para a liderança: números, requisitos pendentes e atalho para pedir instrução.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Tela } from '@/components/layout';
import { Aviso, Avatar, Botao, Carregando, Chip, Marca, Numero, Secao, T } from '@/components/ui';
import * as api from '@/lib/api';
import { Membro, SECRETARIA, useAuth } from '@/lib/auth';
import { dados, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

export default function FichaMembro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cores } = useTema();
  const { tem } = useAuth();

  const m = useQuery({
    queryKey: ['membro', id],
    queryFn: () => dados<Membro>(supabase.from('desbravador')
      .select('id, nome, clube_id, unidade_id, classe_id, data_nascimento, sexo, classe:classe_id(id, nome)').eq('id', id).single() as never),
  });
  const cartao = useQuery({ queryKey: ['cartao', id], queryFn: () => api.cartaoDoMembro(id, m.data!.classe), enabled: !!m.data });
  const esp = useQuery({ queryKey: ['progresso-esp', id], queryFn: () => api.progressoEspecialidades(id) });
  const freq = useQuery({ queryKey: ['freq', id], queryFn: () => api.marcacoesDesde([id], api.inicioTrimestreISO()) });

  if (m.isLoading) return <Tela titulo="Desbravador" voltar="/unidade"><Carregando /></Tela>;
  const d = m.data;
  const c = cartao.data;
  const fq = api.frequencia(freq.data ?? [], id);
  const pendentes = (c?.requisitos ?? []).filter((r) => !r.parent_id && !r.avancada && !c?.feitos[r.id]);
  const concluidas = Object.values(esp.data ?? {}).filter((p) => p.concluida).length;

  return (
    <Tela titulo={d?.nome.split(' ')[0] ?? 'Desbravador'} voltar="/unidade" rotuloVoltar="Unidade" gap={12}
      acoes={tem(SECRETARIA) ? <Botao titulo="Editar cadastro" variante="out" pequeno onPress={() => router.push(`/unidade/cadastro?id=${id}`)} /> : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar nome={d?.nome} tamanho={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <T s={22} w="extra">{d?.nome}</T>
          <T s={13} w="medio" c="texto2">{[c?.classe?.nome, api.idade(d?.data_nascimento ?? null) != null ? `${api.idade(d!.data_nascimento)} anos` : null].filter(Boolean).join(' · ')}</T>
          {fq != null && fq < 0.6 ? <Chip texto={`Atenção: frequência ${Math.round(fq * 100)}%`} bg="aviso" fg="superficie" /> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Numero valor={c ? `${c.concluidos}/${c.total}` : '…'} rotulo="requisitos" />
        <Numero valor={concluidas} rotulo={concluidas === 1 ? 'especialidade' : 'especialidades'} />
        <Numero valor={fq == null ? '—' : `${Math.round(fq * 100)}%`} rotulo="frequência" />
      </View>
      <Secao titulo="Requisitos pendentes" acao="Ver cartão" onAcao={() => router.push(`/classe?membro=${id}`)} />
      {cartao.isLoading ? <Carregando /> : pendentes.slice(0, 12).map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda }}>
          <Marca estado="pend" />
          <View style={{ flex: 1, gap: 4 }}>
            {r.rotulo ? <T s={12} w="negrito" c="primaria">{r.rotulo}</T> : null}
            <T s={14} w="medio">{r.texto}</T>
          </View>
          {c?.classe && c.classe.id !== 'agrupada' ? <Botao titulo="Pedir" variante="sec" pequeno onPress={() => router.push(`/instrucoes/nova?classe=${c.classe!.id}`)} /> : null}
        </View>
      ))}
      {c && !pendentes.length ? <T c="texto2">Nenhum requisito pendente na classe. 🎉</T> : null}
      <Aviso texto="Pedir instrução: escolha um instrutor; ele aceita ou recusa. Quando concluir, o requisito é marcado para todos os presentes." />
    </Tela>
  );
}
