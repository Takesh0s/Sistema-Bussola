// Consultas ao Supabase usadas pelas telas. O RLS do banco decide o que cada
// pessoa enxerga; aqui só montamos as buscas e os cálculos de progresso.
import { dados, supabase } from './supabase';

// ── Tipos de linhas (só os campos que as telas usam) ─────────────────────────
export type ReqClasse = { id: string; parent_id: string | null; secao: string | null; numero: number; rotulo: string | null; texto: string; avancada: boolean };
export type ReqEspecialidade = { id: string; parent_id: string | null; numero: number; rotulo: string | null; texto: string; revisao: string | null };
export type Classe = { id: string; nome: string; ordem: number | null; tipo: 'regular' | 'lideranca' | null; nome_avancada: string | null };
export type Inscricao = { id: string; tipo: 'regular' | 'avancada' | 'agrupada'; prazo: string; status: string; faixa_idade: number | null; classe: Classe | null };
export type Feito = { requisito_classe_id: string | null; requisito_id: string | null; requisito_agrupada_id: string | null; concluido: boolean; concluido_em: string | null; avaliador: { nome_completo: string } | null };
export type Evento = { id: string; titulo: string; local: string | null; inicio: string; fim: string | null; publicado: boolean };
export type Secao = { id: string; evento_id: string; titulo: string; conteudo: string | null; ordem: number; visibilidade: 'todos' | 'lideranca' | 'direcao' };
export type Unidade = { id: string; nome: string; sexo: 'masculina' | 'feminina' | 'mista'; classe: { id: string; nome: string } | null };
export type MembroLinha = { id: string; nome: string; sexo: 'M' | 'F' | null; data_nascimento: string | null; unidade_id: string | null; classe: { id: string; nome: string } | null };

// ── Datas ───────────────────────────────────────────────────────────────────
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function inicioTrimestreISO() {
  const d = new Date();
  const mes = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${String(mes + 1).padStart(2, '0')}-01`;
}

export function idade(nascimento: string | null) {
  if (!nascimento) return null;
  const n = new Date(nascimento + 'T12:00:00');
  const h = new Date();
  let i = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) i--;
  return i;
}

// ── Classes e requisitos ────────────────────────────────────────────────────
export async function classes() {
  return dados<Classe[]>(supabase.from('classe').select('id, nome, ordem, tipo, nome_avancada').order('ordem'));
}

export async function inscricoesAtivas(desbravadorId: string) {
  return dados<Inscricao[]>(
    supabase.from('inscricao_classe')
      .select('id, tipo, prazo, status, faixa_idade, classe:classe_id(id, nome, ordem, tipo, nome_avancada)')
      .eq('desbravador_id', desbravadorId)
      .in('status', ['em_andamento', 'concluida'])
      .order('iniciado_em', { ascending: false }) as never,
  );
}

export async function requisitosDaClasse(classeId: string) {
  return dados<ReqClasse[]>(
    supabase.from('requisito_classe').select('id, parent_id, secao, numero, rotulo, texto, avancada').eq('classe_id', classeId).order('numero'),
  );
}

export async function requisitosAgrupada(faixa: number) {
  const linhas = await dados<(ReqClasse & { faixas: number[] })[]>(
    supabase.from('requisito_agrupada').select('id, parent_id, secao, numero, rotulo, texto, faixas').contains('faixas', [faixa]).order('numero') as never,
  );
  return linhas.map((r) => ({ ...r, avancada: false }));
}

export async function feitosDoMembro(desbravadorId: string) {
  return dados<Feito[]>(
    supabase.from('membro_requisito')
      .select('requisito_classe_id, requisito_id, requisito_agrupada_id, concluido, concluido_em, avaliador:avaliado_por(nome_completo)')
      .eq('desbravador_id', desbravadorId)
      .eq('concluido', true) as never,
  );
}

/** Requisitos com instrução marcada (pendente ou aceita). Só a liderança enxerga instruções. */
export async function requisitosEmInstrucao(clubeId: string) {
  const linhas = await dados<{ requisito_classe_id: string | null; requisito_id: string | null; instrucao: { data: string; status: string } }[]>(
    supabase.from('instrucao_requisito')
      .select('requisito_classe_id, requisito_id, instrucao:instrucao_id!inner(data, status, clube_id)')
      .eq('instrucao.clube_id', clubeId)
      .in('instrucao.status', ['pendente', 'aceita']) as never,
  ).catch(() => []);
  // Objetos simples (não Map): o cache do React Query é salvo como JSON no aparelho
  const mapa: Record<string, string> = {};
  for (const l of linhas) {
    const id = l.requisito_classe_id ?? l.requisito_id;
    if (id) mapa[id] = l.instrucao.data;
  }
  return mapa;
}

/** Classe que o cartão mostra: a inscrição em andamento ou a classe do cadastro. */
export async function cartaoDoMembro(desbravadorId: string, classeCadastro: { id: string; nome: string } | null) {
  const insc = await inscricoesAtivas(desbravadorId).catch(() => [] as Inscricao[]);
  const atual = insc.find((i) => i.status === 'em_andamento' && i.tipo !== 'avancada') ?? null;
  let classe: { id: string; nome: string } | null = atual?.classe ?? classeCadastro;
  let reqs: ReqClasse[] = [];
  if (atual?.tipo === 'agrupada' && atual.faixa_idade) {
    reqs = await requisitosAgrupada(atual.faixa_idade);
    classe = { id: 'agrupada', nome: 'Classes Agrupadas' };
  } else if (classe) {
    reqs = await requisitosDaClasse(classe.id);
  }
  const feitos = await feitosDoMembro(desbravadorId);
  const chave: keyof Feito = atual?.tipo === 'agrupada' ? 'requisito_agrupada_id' : 'requisito_classe_id';
  const feitosMap: Record<string, Feito> = Object.fromEntries(feitos.filter((f) => f[chave]).map((f) => [f[chave] as string, f]));
  const principais = reqs.filter((r) => !r.parent_id && !r.avancada);
  const avancados = reqs.filter((r) => !r.parent_id && r.avancada);
  return {
    inscricao: atual,
    classe,
    requisitos: reqs,
    feitos: feitosMap,
    total: principais.length,
    concluidos: principais.filter((r) => feitosMap[r.id]).length,
    totalAvancada: avancados.length,
    concluidosAvancada: avancados.filter((r) => feitosMap[r.id]).length,
    inscricoes: insc,
  };
}

// ── Especialidades ──────────────────────────────────────────────────────────
export type Especialidade = { id: string; nome: string; codigo: string | null; area: string | null };

export async function catalogoEspecialidades() {
  return dados<Especialidade[]>(supabase.from('especialidades').select('id, nome, codigo, area').order('nome').range(0, 1999));
}

export type ProgressoEsp = { feitos: number; total: number; concluida: boolean };

/** Progresso do membro por especialidade: { id → { feitos, total, concluida } } */
export async function progressoEspecialidades(desbravadorId: string) {
  const [feitos, marcadas] = await Promise.all([
    dados<{ requisito_id: string; req: { especialidade_id: string; parent_id: string | null } | null }[]>(
      supabase.from('membro_requisito').select('requisito_id, req:requisito_id(especialidade_id, parent_id)')
        .eq('desbravador_id', desbravadorId).eq('concluido', true).not('requisito_id', 'is', null) as never,
    ),
    dados<{ especialidade_id: string; concluida: boolean }[]>(
      supabase.from('desbravador_especialidade').select('especialidade_id, concluida').eq('desbravador_id', desbravadorId),
    ),
  ]);
  const mapa: Record<string, ProgressoEsp> = {};
  const de = (id: string) => (mapa[id] ??= { feitos: 0, total: 0, concluida: false });
  for (const f of feitos) {
    if (!f.req || f.req.parent_id) continue;
    de(f.req.especialidade_id).feitos++;
  }
  for (const d of marcadas) {
    const m = de(d.especialidade_id);
    m.concluida = m.concluida || d.concluida;
  }
  const ids = Object.keys(mapa);
  if (ids.length) {
    const reqs = await dados<{ especialidade_id: string }[]>(
      supabase.from('requisito_especialidade').select('especialidade_id').in('especialidade_id', ids).is('parent_id', null),
    );
    for (const r of reqs) if (mapa[r.especialidade_id]) mapa[r.especialidade_id].total++;
    for (const m of Object.values(mapa)) if (m.total > 0 && m.feitos >= m.total) m.concluida = true;
  }
  return mapa;
}

// ── Frequência ──────────────────────────────────────────────────────────────
export type Marcacao = { desbravador_id: string; presente: boolean; justificada: boolean; chamada: { data: string; tipo: { nome: string } | null } };

export async function marcacoesDesde(desbravadorIds: string[], desde: string) {
  if (!desbravadorIds.length) return [] as Marcacao[];
  return dados<Marcacao[]>(
    supabase.from('chamada_presenca')
      .select('desbravador_id, presente, justificada, chamada:chamada_id!inner(data, tipo:tipo_id(nome))')
      .in('desbravador_id', desbravadorIds)
      .gte('chamada.data', desde) as never,
  );
}

export function frequencia(marcacoes: Marcacao[], desbravadorId: string) {
  const m = marcacoes.filter((x) => x.desbravador_id === desbravadorId);
  if (!m.length) return null;
  return m.filter((x) => x.presente).length / m.length;
}

// ── Unidades e membros ──────────────────────────────────────────────────────
export async function unidadesDoClube(clubeId: string) {
  return dados<Unidade[]>(
    supabase.from('unidade').select('id, nome, sexo, classe:classe_id(id, nome)').eq('clube_id', clubeId).order('nome') as never,
  );
}

export async function membrosDaUnidade(unidadeId: string) {
  return dados<MembroLinha[]>(
    supabase.from('desbravador').select('id, nome, sexo, data_nascimento, unidade_id, classe:classe_id(id, nome)').eq('unidade_id', unidadeId).order('nome') as never,
  );
}

export async function membrosDoClube(clubeId: string) {
  return dados<MembroLinha[]>(
    supabase.from('desbravador').select('id, nome, sexo, data_nascimento, unidade_id, classe:classe_id(id, nome)').eq('clube_id', clubeId).order('nome') as never,
  );
}

/** Progresso na classe (requisitos principais, sem os avançados) de vários membros. */
export async function progressoNaClasse(membros: MembroLinha[]) {
  const porClasse = new Map<string, Set<string>>();
  for (const cid of new Set(membros.map((m) => m.classe?.id).filter(Boolean) as string[])) {
    const reqs = await requisitosDaClasse(cid);
    porClasse.set(cid, new Set(reqs.filter((r) => !r.parent_id && !r.avancada).map((r) => r.id)));
  }
  const ids = membros.map((m) => m.id);
  const feitos = ids.length
    ? await dados<{ desbravador_id: string; requisito_classe_id: string }[]>(
      supabase.from('membro_requisito').select('desbravador_id, requisito_classe_id').in('desbravador_id', ids).eq('concluido', true).not('requisito_classe_id', 'is', null),
    )
    : [];
  const esp = ids.length
    ? await dados<{ desbravador_id: string }[]>(supabase.from('desbravador_especialidade').select('desbravador_id').in('desbravador_id', ids).eq('concluida', true))
    : [];
  const res: Record<string, { feitos: number; total: number; especialidades: number }> = {};
  for (const m of membros) {
    const set = m.classe ? porClasse.get(m.classe.id) : undefined;
    res[m.id] = {
      total: set?.size ?? 0,
      feitos: set ? feitos.filter((f) => f.desbravador_id === m.id && set.has(f.requisito_classe_id)).length : 0,
      especialidades: esp.filter((e) => e.desbravador_id === m.id).length,
    };
  }
  return res;
}

// ── Eventos ─────────────────────────────────────────────────────────────────
export async function eventos(clubeId: string) {
  return dados<Evento[]>(supabase.from('evento').select('id, titulo, local, inicio, fim, publicado').eq('clube_id', clubeId).order('inicio'));
}

// ── Instruções ──────────────────────────────────────────────────────────────
export type ItemInstrucao = {
  id: string;
  requisito_classe: { id: string; rotulo: string | null; texto: string; classe: { id: string; nome: string } | null } | null;
  requisito: { id: string; rotulo: string | null; texto: string; esp: { nome: string; codigo: string | null } | null } | null;
  agrupada: { id: string; rotulo: string | null; texto: string } | null;
};
export type Instrucao = {
  id: string; clube_id: string; data: string; inicio: string | null; fim: string | null; local: string | null;
  status: 'pendente' | 'aceita' | 'recusada' | 'concluida' | 'cancelada'; observacao: string | null;
  instrutor_id: string; atribuido_por: string | null;
  instrutor: { nome_completo: string } | null; atribuidor: { nome_completo: string } | null;
  itens: ItemInstrucao[];
};

const CAMPOS_INSTRUCAO = `id, clube_id, data, inicio, fim, local, status, observacao, instrutor_id, atribuido_por,
  instrutor:instrutor_id(nome_completo), atribuidor:atribuido_por(nome_completo),
  itens:instrucao_requisito(id,
    requisito_classe:requisito_classe_id(id, rotulo, texto, classe:classe_id(id, nome)),
    requisito:requisito_id(id, rotulo, texto, esp:especialidade_id(nome, codigo)),
    agrupada:requisito_agrupada_id(id, rotulo, texto))`;

export async function instrucoes(clubeId: string) {
  return dados<Instrucao[]>(supabase.from('instrucao').select(CAMPOS_INSTRUCAO).eq('clube_id', clubeId).order('data') as never);
}

export async function instrucao(id: string) {
  return dados<Instrucao>(supabase.from('instrucao').select(CAMPOS_INSTRUCAO).eq('id', id).single() as never);
}

export function tituloInstrucao(i: Instrucao) {
  const nomes = new Set<string>();
  for (const it of i.itens) {
    if (it.requisito?.esp) nomes.add(it.requisito.esp.nome);
    else if (it.requisito_classe?.classe) nomes.add(it.requisito_classe.classe.nome);
    else if (it.agrupada) nomes.add('Classes Agrupadas');
  }
  return [...nomes].join(' · ') || 'Instrução';
}

export function rotulosInstrucao(i: Instrucao) {
  return i.itens.map((it) => it.requisito_classe?.rotulo ?? it.requisito?.rotulo ?? it.agrupada?.rotulo).filter(Boolean).join(', ');
}

export function horario(i: { inicio: string | null; fim: string | null }) {
  const h = (t: string | null) => {
    if (!t) return '';
    const [hh, mm] = t.split(':');
    return `${Number(hh)}h${mm && mm !== '00' ? mm : ''}`;
  };
  if (i.inicio && i.fim) return `${h(i.inicio)} às ${h(i.fim)}`;
  return h(i.inicio);
}

// ── Mensalidades ────────────────────────────────────────────────────────────
export const DIA_VENCIMENTO = 10;
export type StatusMensalidade = 'pago' | 'pendente' | 'atrasado' | 'isento';

export function statusMensalidade(m: { pago: boolean; valor: number | null; mes: number; ano: number }): StatusMensalidade {
  if (m.pago) return 'pago';
  if (!Number(m.valor)) return 'isento';
  const venc = new Date(m.ano, m.mes - 1, DIA_VENCIMENTO, 23, 59);
  return new Date() > venc ? 'atrasado' : 'pendente';
}

export function brl(v: number | string | null | undefined) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
