// Finanças (diretor, associados e tesoureiro): mensalidades do mês e caixa.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Lock, Minus, Plus, Send } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Colunas, Tela, useLargo } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Aviso, Avatar, Botao, Campo, Capa, Cartao, Carregando, Chip, Erro, Icone, Item, Numero, Progresso, Segmentado, T } from '@/components/ui';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { capitalizar, diaMes, mesAno } from '@/lib/datas';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

type Mensalidade = { id: string; mes: number; ano: number; valor: number; pago: boolean; desbravador: { id: string; nome: string } | null };
type Lancamento = { id: string; tipo: 'entrada' | 'saida'; descricao: string | null; valor: number; data: string };

export const STATUS: Record<api.StatusMensalidade, { rotulo: string; bg: 'sucesso' | 'superficie2' | 'erro' | 'container'; fg: 'superficie' | 'texto' | 'sobreContainer' }> = {
  pago: { rotulo: 'Pago', bg: 'sucesso', fg: 'superficie' },
  pendente: { rotulo: 'Pendente', bg: 'superficie2', fg: 'texto' },
  atrasado: { rotulo: 'Atrasado', bg: 'erro', fg: 'superficie' },
  isento: { rotulo: 'Isento', bg: 'container', fg: 'sobreContainer' },
};

export default function Financas() {
  const { clube } = useAuth();
  const { cores } = useTema();
  const largo = useLargo();
  const toast = useToast();
  const qc = useQueryClient();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [aba, setAba] = useState<'mensalidades' | 'caixa'>('mensalidades');
  const [valorPadrao, setValorPadrao] = useState('35,00');

  const mens = useQuery({
    queryKey: ['mensalidades', clube?.id, mes, ano],
    queryFn: () => dados<Mensalidade[]>(supabase.from('mensalidade').select('id, mes, ano, valor, pago, desbravador:desbravador_id(id, nome)')
      .eq('clube_id', clube!.id).eq('mes', mes).eq('ano', ano) as never),
    enabled: !!clube,
  });
  const atrasadasAntigas = useQuery({
    queryKey: ['mensalidades-atrasadas', clube?.id, mes, ano],
    queryFn: () => dados<Mensalidade[]>(supabase.from('mensalidade').select('id, mes, ano, valor, pago, desbravador:desbravador_id(id, nome)')
      .eq('clube_id', clube!.id).eq('pago', false).gt('valor', 0).or(`ano.lt.${ano},and(ano.eq.${ano},mes.lt.${mes})`) as never),
    enabled: !!clube,
  });
  const caixa = useQuery({
    queryKey: ['caixa', clube?.id],
    queryFn: () => dados<Lancamento[]>(supabase.from('caixa').select('id, tipo, descricao, valor, data').eq('clube_id', clube!.id).order('data', { ascending: false })),
    enabled: !!clube,
  });

  const lista = useMemo(() => (mens.data ?? []).slice().sort((a, b) => (a.desbravador?.nome ?? '').localeCompare(b.desbravador?.nome ?? '')), [mens.data]);
  const total = lista.reduce((s, m) => s + Number(m.valor), 0);
  const recebido = lista.filter((m) => m.pago).reduce((s, m) => s + Number(m.valor), 0);
  const cont = (st: api.StatusMensalidade) => lista.filter((m) => api.statusMensalidade(m) === st).length;
  const atrasadoTotal = lista.filter((m) => api.statusMensalidade(m) === 'atrasado').reduce((s, m) => s + Number(m.valor), 0)
    + (atrasadasAntigas.data ?? []).reduce((s, m) => s + Number(m.valor), 0);
  const saldo = (caixa.data ?? []).reduce((s, l) => s + (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor), 0);

  function mudarMes(d: number) {
    let m = mes + d, a = ano;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    setMes(m); setAno(a);
  }

  async function alternarPago(m: Mensalidade) {
    const { error } = await supabase.from('mensalidade').update({ pago: !m.pago }).eq('id', m.id);
    if (error) return toast(mensagemErro(error), 'erro');
    qc.invalidateQueries({ queryKey: ['mensalidades'] });
  }

  async function gerar() {
    if (!clube) return;
    const valor = Number(valorPadrao.replace('.', '').replace(',', '.'));
    if (!(valor >= 0)) return toast('Valor inválido.', 'erro');
    try {
      const membros = await api.membrosDoClube(clube.id);
      const ja = new Set(lista.map((m) => m.desbravador?.id));
      const novas = membros.filter((d) => !ja.has(d.id)).map((d) => ({ desbravador_id: d.id, clube_id: clube.id, mes, ano, valor, pago: false }));
      if (!novas.length) return toast('Todos já têm mensalidade neste mês.');
      const { error } = await supabase.from('mensalidade').insert(novas);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['mensalidades'] });
      toast(`${novas.length} mensalidades geradas.`);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  // ── Caixa ──
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  async function lancar() {
    const v = Number(valor.replace('.', '').replace(',', '.'));
    if (!descricao.trim() || !(v > 0)) return toast('Preencha descrição e valor.', 'erro');
    const { error } = await supabase.from('caixa').insert({ clube_id: clube!.id, tipo, descricao: descricao.trim(), valor: v, data: api.hojeISO() });
    if (error) return toast(mensagemErro(error), 'erro');
    setDescricao(''); setValor('');
    qc.invalidateQueries({ queryKey: ['caixa'] });
    toast('Lançamento registrado.');
  }

  const privado = <Aviso tom="neutro" icone={Lock} texto="Visível só para diretor, diretores associados e tesoureiro." />;
  const seletorMes = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable onPress={() => mudarMes(-1)} hitSlop={8}><ChevronLeft size={22} color={cores.texto} /></Pressable>
      <T s={15} w="negrito" style={{ minWidth: 150, textAlign: 'center' }}>{capitalizar(mesAno(new Date(ano, mes - 1, 15)))}</T>
      <Pressable onPress={() => mudarMes(1)} hitSlop={8}><ChevronRight size={22} color={cores.texto} /></Pressable>
    </View>
  );
  const capa = (
    <Capa>
      <T s={14} w="negrito" c="sobreDestaque">Mensalidades · {mesAno(new Date(ano, mes - 1, 15))}</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T s={34} w="extra" c="sobreDestaque" style={{ lineHeight: 40 }}>{api.brl(recebido)}</T>
        <T s={15} w="medio" c="sobreDestaque">de {api.brl(total)}</T>
      </View>
      <Progresso valor={total ? recebido / total : 0} trilho="destaqueB" cor="sobreDestaque" />
      <T s={13} w="medio" c="sobreDestaque">{cont('pago')} pagos · {cont('pendente')} pendentes · {cont('atrasado')} atrasados · {cont('isento')} isentos</T>
    </Capa>
  );

  const linhasMens = mens.isLoading ? <Carregando /> : mens.error ? <Erro erro={mens.error} /> : lista.length ? lista.map((m) => {
    const st = api.statusMensalidade(m);
    return (
      <Item key={m.id} esquerda={<Avatar nome={m.desbravador?.nome} tamanho={36} />} titulo={m.desbravador?.nome ?? '—'}
        sub={st === 'pago' ? 'Pago' : st === 'isento' ? 'Bolsa / isento' : st === 'atrasado' ? `Venceu em ${String(api.DIA_VENCIMENTO).padStart(2, '0')}/${String(m.mes).padStart(2, '0')}` : `Vence ${String(api.DIA_VENCIMENTO).padStart(2, '0')}/${String(m.mes).padStart(2, '0')}`}
        direita={<View style={{ alignItems: 'flex-end', gap: 4 }}><T s={14} w="negrito">{api.brl(m.valor)}</T><Chip texto={STATUS[st].rotulo} bg={STATUS[st].bg} fg={STATUS[st].fg} /></View>}
        onPress={st === 'isento' ? undefined : () => alternarPago(m)} style={{ padding: 12 }} />
    );
  }) : (
    <Cartao gap={12}>
      <T w="negrito">Nenhuma mensalidade neste mês</T>
      <Campo rotulo="Valor da mensalidade (R$)" value={valorPadrao} onChangeText={setValorPadrao} keyboardType="decimal-pad" />
      <Botao titulo="Gerar mensalidades para todos os membros" onPress={gerar} cheio />
    </Cartao>
  );

  const blocoCaixa = (
    <View style={{ gap: 12 }}>
      <Numero valor={api.brl(saldo)} rotulo="Saldo em caixa" cor={saldo >= 0 ? 'primaria' : 'erro'} style={{ flex: 0 }} />
      <Cartao gap={12}>
        <T s={16} w="negrito">Novo lançamento</T>
        <Segmentado opcoes={[{ valor: 'entrada', rotulo: 'Entrada' }, { valor: 'saida', rotulo: 'Saída' }]} valor={tipo} onChange={setTipo} />
        <Campo rotulo="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Ex.: Aluguel do ônibus" />
        <Campo rotulo="Valor (R$)" value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="0,00" />
        <Botao titulo="Registrar" onPress={lancar} cheio />
      </Cartao>
      <Cartao gap={12}>
        <T s={16} w="negrito">Últimos lançamentos</T>
        {(caixa.data ?? []).slice(0, 30).map((l) => (
          <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icone icone={l.tipo === 'entrada' ? Plus : Minus} bg="superficie2" fg={l.tipo === 'entrada' ? 'sucesso' : 'erro'} tamanho={32} />
            <View style={{ flex: 1 }}>
              <T s={14} w="medio" linhas={1}>{l.descricao ?? '—'}</T>
              <T s={12} c="texto2">{diaMes(l.data)}</T>
            </View>
            <T s={14} w="negrito" c={l.tipo === 'entrada' ? 'sucesso' : 'erro'}>{l.tipo === 'saida' ? '−' : '+'}{api.brl(l.valor)}</T>
          </View>
        ))}
        {!caixa.data?.length ? <T s={13} c="texto2">Nenhum lançamento.</T> : null}
      </Cartao>
    </View>
  );

  const cobrar = <Botao titulo={`Enviar cobranças do mês (${cont('pendente') + cont('atrasado') + (atrasadasAntigas.data?.length ?? 0)})`} icone={Send}
    onPress={() => router.push(`/financas/cobrancas?mes=${mes}&ano=${ano}`)} cheio={!largo} />;

  if (largo) {
    return (
      <Tela titulo="Finanças" sobre="Tesouraria" acoes={<>{seletorMes}{cobrar}</>}>
        {privado}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Numero valor={api.brl(recebido)} rotulo="Recebido" cor="sucesso" />
          <Numero valor={api.brl(total - recebido)} rotulo="A receber" cor="texto" />
          <Numero valor={api.brl(atrasadoTotal)} rotulo="Atrasado (todos os meses)" cor="erro" />
          <Numero valor={api.brl(saldo)} rotulo="Saldo em caixa" cor="primaria" />
        </View>
        <Colunas largura={460} esquerda={<>{capa}{blocoCaixa}</>} direita={<>{linhasMens}</>} />
      </Tela>
    );
  }

  return (
    <Tela titulo="Finanças" gap={12} rodape={aba === 'mensalidades' ? cobrar : undefined}
      aoAtualizar={() => { mens.refetch(); caixa.refetch(); }} atualizando={mens.isRefetching}>
      {privado}
      <Segmentado opcoes={[{ valor: 'mensalidades', rotulo: 'Mensalidades' }, { valor: 'caixa', rotulo: 'Caixa' }]} valor={aba} onChange={setAba} />
      {aba === 'mensalidades' ? <>{seletorMes}{capa}{linhasMens}{lista.length ? <T s={12} c="texto2">Toque numa mensalidade para marcar como paga ou pendente.</T> : null}</> : blocoCaixa}
    </Tela>
  );
}
