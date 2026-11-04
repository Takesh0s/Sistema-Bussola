// Instruções: pedidos para o instrutor responder, agendadas, concluídas e (liderança) todas do clube.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BookOpen, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { CartaoPedido, DetalheInstrucao, STATUS_INSTRUCAO } from '@/components/instrucao';
import { Tela, useLargo } from '@/components/layout';
import { Aviso, Botao, Carregando, Chip, Erro, Icone, Item, Segmentado, Vazio } from '@/components/ui';
import * as api from '@/lib/api';
import { LIDERANCA, useAuth } from '@/lib/auth';
import { capitalizar, dataCurta } from '@/lib/datas';

type Aba = 'pedidos' | 'agendadas' | 'concluidas' | 'clube';

export default function Instrucoes() {
  const { clube, perfil, tem } = useAuth();
  const largo = useLargo();
  const lideranca = tem(LIDERANCA);
  const instrutor = tem(['instrutor']);
  const [aba, setAba] = useState<Aba>(instrutor ? 'pedidos' : 'clube');
  const [sel, setSel] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['instrucoes', clube?.id], queryFn: () => api.instrucoes(clube!.id), enabled: !!clube });
  const minhas = (q.data ?? []).filter((i) => i.instrutor_id === perfil?.id);
  const pedidos = minhas.filter((i) => i.status === 'pendente');
  const lista = aba === 'pedidos' ? pedidos
    : aba === 'agendadas' ? minhas.filter((i) => i.status === 'aceita')
      : aba === 'concluidas' ? minhas.filter((i) => i.status === 'concluida').reverse()
        : (q.data ?? []).filter((i) => i.status !== 'cancelada');

  const opcoes: { valor: Aba; rotulo: string }[] = [
    ...(instrutor ? [{ valor: 'pedidos' as Aba, rotulo: `Pedidos (${pedidos.length})` }, { valor: 'agendadas' as Aba, rotulo: 'Agendadas' }, { valor: 'concluidas' as Aba, rotulo: 'Concluídas' }] : []),
    ...(lideranca ? [{ valor: 'clube' as Aba, rotulo: 'Do clube' }] : []),
  ];

  const abrir = (id: string) => (largo ? setSel(id) : router.push(`/instrucoes/${id}`));

  const coluna = (
    <View style={{ gap: 12 }}>
      {opcoes.length > 1 ? <Segmentado opcoes={opcoes} valor={aba} onChange={setAba} /> : null}
      {lideranca ? <Botao titulo="Pedir instrução" icone={Plus} onPress={() => router.push('/instrucoes/nova')} cheio /> : null}
      {q.isLoading ? <Carregando /> : q.error ? <Erro erro={q.error} tentar={() => q.refetch()} /> : lista.map((i) => (
        aba === 'pedidos'
          ? <CartaoPedido key={i.id} i={i} aoResponder={() => q.refetch()} />
          : (
            <Item key={i.id} esquerda={<Icone icone={BookOpen} />} titulo={api.tituloInstrucao(i)}
              sub={`${api.rotulosInstrucao(i)} · ${capitalizar(dataCurta(i.data))}${i.instrutor && aba === 'clube' ? ' · ' + i.instrutor.nome_completo : ''}`}
              direita={<Chip texto={STATUS_INSTRUCAO[i.status].rotulo} bg={STATUS_INSTRUCAO[i.status].bg} fg={STATUS_INSTRUCAO[i.status].fg} />}
              destaque={sel === i.id} onPress={() => abrir(i.id)} />
          )
      ))}
      {!q.isLoading && !lista.length ? <Vazio texto={aba === 'pedidos' ? 'Nenhum pedido esperando resposta.' : 'Nenhuma instrução aqui.'} icone={BookOpen} /> : null}
      {instrutor ? <Aviso tom="neutro" texto="Você vê só as turmas que atende. Ao concluir, o requisito fica marcado para todos os presentes na chamada." /> : null}
    </View>
  );

  if (largo) {
    const atual = sel ?? lista.find((i) => i.status === 'aceita')?.id ?? null;
    return (
      <Tela titulo="Instruções" sobre={clube?.nome} aoAtualizar={() => q.refetch()}>
        <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
          <View style={{ width: 440 }}>{coluna}</View>
          <View style={{ flex: 1 }}>{atual ? <DetalheInstrucao key={atual} id={atual} /> : <Vazio texto="Selecione uma instrução." icone={BookOpen} />}</View>
        </View>
      </Tela>
    );
  }

  return (
    <Tela titulo="Instruções" gap={12} aoAtualizar={() => q.refetch()} atualizando={q.isRefetching}>
      {coluna}
    </Tela>
  );
}
