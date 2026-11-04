// Cartão da classe: requisitos por seção (regular e avançada).
// Com ?membro=id, a liderança vê o cartão de um desbravador e pode marcar requisitos.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Colunas, Tela, useLargo } from '@/components/layout';
import { useToast } from '@/components/toast';
import {
  Botao, Capa, Cartao, Carregando, Chip, Erro, EstadoReq, Marca, Progresso, Segmentado, Selo, T, Vazio,
} from '@/components/ui';
import * as api from '@/lib/api';
import { LIDERANCA, Membro, useAuth } from '@/lib/auth';
import { capitalizar, dataCurta, diaMes, fmt } from '@/lib/datas';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

export default function CartaoClasse() {
  const params = useLocalSearchParams<{ membro?: string }>();
  const { membro: eu, clube, perfil, tem } = useAuth();
  const { cores } = useTema();
  const toast = useToast();
  const qc = useQueryClient();
  const [aba, setAba] = useState<'regular' | 'avancada'>('regular');
  const largo = useLargo();
  const lideranca = tem(LIDERANCA);

  const outro = useQuery({
    queryKey: ['membro', params.membro],
    queryFn: () => dados<Membro>(supabase.from('desbravador')
      .select('id, nome, clube_id, unidade_id, classe_id, data_nascimento, sexo, classe:classe_id(id, nome)').eq('id', params.membro!).single() as never),
    enabled: !!params.membro,
  });
  const alvo = params.membro ? outro.data : eu;

  const cartao = useQuery({
    queryKey: ['cartao', alvo?.id],
    queryFn: () => api.cartaoDoMembro(alvo!.id, alvo!.classe),
    enabled: !!alvo,
  });
  const emInstrucao = useQuery({
    queryKey: ['req-em-instrucao', clube?.id],
    queryFn: () => api.requisitosEmInstrucao(clube!.id),
    enabled: !!clube && lideranca,
  });

  const c = cartao.data;
  const lista = useMemo(() => (c?.requisitos ?? []).filter((r) => (aba === 'avancada') === r.avancada), [c, aba]);
  const secoes = useMemo(() => {
    const m = new Map<string, api.ReqClasse[]>();
    for (const r of lista.filter((x) => !x.parent_id)) {
      const s = r.secao ?? 'Requisitos';
      m.set(s, [...(m.get(s) ?? []), r]);
    }
    return [...m.entries()];
  }, [lista]);
  const filhos = useMemo(() => {
    const m = new Map<string, api.ReqClasse[]>();
    for (const r of lista.filter((x) => x.parent_id)) m.set(r.parent_id!, [...(m.get(r.parent_id!) ?? []), r]);
    return m;
  }, [lista]);

  const podeMarcar = lideranca && !!params.membro && c?.classe?.id !== 'agrupada';

  async function alternar(r: api.ReqClasse) {
    if (!podeMarcar || !alvo || !clube) return;
    try {
      const feito = !!c?.feitos[r.id];
      if (feito) {
        const { error } = await supabase.from('membro_requisito').delete().eq('desbravador_id', alvo.id).eq('requisito_classe_id', r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('membro_requisito').insert({
          desbravador_id: alvo.id, requisito_classe_id: r.id, concluido: true, clube_id: clube.id,
          avaliado_por: perfil?.id ?? null, concluido_em: new Date().toISOString(),
        });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ['cartao', alvo.id] });
      toast(feito ? 'Requisito desmarcado.' : 'Requisito marcado como concluído.');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  function estado(r: api.ReqClasse): EstadoReq {
    if (c?.feitos[r.id]) return 'ok';
    if (emInstrucao.data?.[r.id]) return 'inst';
    return 'pend';
  }

  function Requisito({ r, nivel = 0 }: { r: api.ReqClasse; nivel?: number }) {
    const st = estado(r);
    const f = c?.feitos[r.id];
    const sub = filhos.get(r.id) ?? [];
    return (
      <View style={{ marginLeft: nivel * 20, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: cores.superficie, borderWidth: 1,
          borderColor: st === 'inst' ? cores.primaria : cores.borda }}>
          <Pressable onPress={() => alternar(r)} disabled={!podeMarcar} accessibilityLabel={podeMarcar ? 'Marcar ou desmarcar' : undefined}>
            <Marca estado={st} />
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            {r.rotulo ? <T s={12} w="negrito" c="primaria">{r.rotulo}</T> : null}
            <T s={14} w="medio">{r.texto}</T>
            {st === 'ok' && f ? (
              <T s={12} w="medio" c="texto2">✓ {[f.avaliador?.nome_completo, f.concluido_em ? diaMes(f.concluido_em) : null].filter(Boolean).join(' · ') || 'Concluído'}</T>
            ) : null}
            {st === 'inst' ? <Chip texto={`Instrução ${capitalizar(dataCurta(emInstrucao.data![r.id]))}`} /> : null}
          </View>
        </View>
        {sub.map((s) => <Requisito key={s.id} r={s} nivel={nivel + 1} />)}
      </View>
    );
  }

  const titulo = c?.classe?.nome ?? 'Cartão da classe';
  if (!alvo && (params.membro ? outro.isLoading : true)) {
    return (
      <Tela titulo="Cartão da classe" voltar={!!params.membro}>
        {params.membro ? <Carregando /> : <Vazio texto="Sua conta ainda não está ligada a um cadastro de membro. Fale com a secretaria do clube." />}
      </Tela>
    );
  }

  const resumo = c ? (
    <Capa>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Selo tamanho={40} />
        <View style={{ flex: 1 }}>
          <T s={22} w="extra" c="sobreDestaque">{c.classe?.nome ?? 'Sem classe'}</T>
          <T s={13} w="medio" c="sobreDestaque">
            {params.membro ? alvo?.nome : c.inscricao?.prazo ? `Prazo: ${fmt(c.inscricao.prazo, "MMMM 'de' yyyy")}` : 'Classe do cadastro'}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T s={34} w="extra" c="sobreDestaque" style={{ lineHeight: 40 }}>{aba === 'regular' ? c.concluidos : c.concluidosAvancada}</T>
        <T s={14} w="medio" c="sobreDestaque">de {aba === 'regular' ? c.total : c.totalAvancada} requisitos</T>
      </View>
      <Progresso valor={aba === 'regular' ? (c.total ? c.concluidos / c.total : 0) : (c.totalAvancada ? c.concluidosAvancada / c.totalAvancada : 0)}
        trilho="destaqueB" cor="sobreDestaque" />
    </Capa>
  ) : null;

  const seletor = c && c.totalAvancada > 0 ? (
    <Segmentado
      opcoes={[{ valor: 'regular', rotulo: `Regular · ${c.concluidos}/${c.total}` }, { valor: 'avancada', rotulo: `Avançada · ${c.concluidosAvancada}/${c.totalAvancada}` }]}
      valor={aba} onChange={setAba} />
  ) : null;

  const porSecao = (
    <Cartao gap={14}>
      <T s={16} w="negrito">Progresso por seção</T>
      {secoes.map(([s, rs]) => {
        const feitos = rs.filter((r) => c?.feitos[r.id]).length;
        const completa = feitos === rs.length;
        return (
          <View key={s} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T s={14} w="medio" linhas={1} style={{ flex: 1 }}>{s}</T>
              <T s={13} w="negrito" c={completa ? 'sucesso' : 'texto2'}>{feitos}/{rs.length}</T>
            </View>
            <Progresso valor={rs.length ? feitos / rs.length : 0} cor={completa ? 'sucesso' : 'primaria'} altura={6} />
          </View>
        );
      })}
    </Cartao>
  );

  const legenda = (
    <Cartao gap={10}>
      <T s={14} w="negrito">Legenda</T>
      {([['ok', 'Concluído e avaliado'], ['inst', 'Em instrução agendada'], ['pend', 'Pendente']] as const).map(([s, l]) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Marca estado={s} tamanho={22} />
          <T s={13} w="medio" c="texto2">{l}</T>
        </View>
      ))}
      {podeMarcar ? <T s={12} c="texto2">Toque no círculo de um requisito para marcar ou desmarcar.</T> : null}
    </Cartao>
  );

  const requisitos = (
    <View style={{ gap: 12 }}>
      {secoes.map(([s, rs]) => (
        <View key={s} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
            <T s={16} w="negrito" style={{ flex: 1 }}>{s}</T>
            <T s={13} w="semi" c="texto2">{rs.filter((r) => c?.feitos[r.id]).length}/{rs.length}</T>
          </View>
          {rs.map((r) => <Requisito key={r.id} r={r} />)}
        </View>
      ))}
      {c && !secoes.length ? <Vazio texto={c.classe ? 'Os requisitos desta classe ainda não foram cadastrados.' : 'Nenhuma classe definida no cadastro.'} /> : null}
    </View>
  );

  return (
    <Tela titulo={params.membro ? (alvo?.nome ?? 'Cartão') : titulo} sobre="Cartão da classe" voltar={params.membro ? '/unidade' : undefined}
      aoAtualizar={() => cartao.refetch()} atualizando={cartao.isRefetching} gap={12}
      acoes={params.membro && lideranca && c?.classe ? <Botao titulo="Pedir instrução" variante="sec" pequeno onPress={() => router.push(`/instrucoes/nova?classe=${c.classe!.id}`)} /> : undefined}>
      {cartao.isLoading ? <Carregando /> : cartao.error ? <Erro erro={cartao.error} tentar={() => cartao.refetch()} /> : !largo ? (
        <>{resumo}{seletor}{requisitos}</>
      ) : (
        <Colunas
          esquerda={<>{resumo}{porSecao}{legenda}</>}
          direita={<>{seletor}{requisitos}</>}
        />
      )}
    </Tela>
  );
}
