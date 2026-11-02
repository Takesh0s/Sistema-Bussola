#!/usr/bin/env node
// =============================================================================
// importar-especialidades.mjs — Sistema Bússola
//
// Lê as páginas de especialidades de Desbravadores do MDA Wiki e gera
// seeds/especialidades_oficiais.sql (especialidades + requisitos com subitens).
//
// Uso (Node 18 ou mais novo, sem dependências):
//   node scripts/importar-especialidades.mjs
//   node scripts/importar-especialidades.mjs --conferir docs/Base_Especialidades
//   node scripts/importar-especialidades.mjs --area ADRA        (só uma área, para testar)
//
// --conferir <pasta>  compara com os .txt feitos à mão (nº de requisitos por código)
// --area <nome>       importa só a área cujo nome contém o texto
// --saida <arquivo>   caminho do SQL (padrão: seeds/especialidades_oficiais.sql)
// --dividir <n>       gera vários arquivos com n especialidades cada (pasta com o nome da saída)
//
// Páginas em que nenhum requisito foi reconhecido têm o HTML salvo em mda_problemas/.
//
// O SQL gerado é idempotente: ids fixos (uuid v5 a partir do código) e upsert.
// Rodar de novo atualiza textos que mudaram no wiki.
// =============================================================================

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE = 'https://mda.wiki.br';
const PAUSA_MS = 400; // intervalo entre requisições, para não sobrecarregar o site

export const AREAS = [
  'ADRA',
  'Artes_e_Habilidades_Manuais',
  'Atividades_Agrícolas',
  'Atividades_Missionárias_e_Comunitárias',
  'Atividades_Missionárias_e_Comunitárias_-_Ensinos_Biblicos',
  'Atividades_Profissionais',
  'Atividades_Recreativas',
  'Ciência_e_Saúde',
  'Estudos_da_Natureza',
  'Habilidades_Domésticas',
];

// ── Utilitários ──────────────────────────────────────────────────────────────

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', deg: '°',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', middot: '·', frac12: '½', frac14: '¼', sup2: '²', sup3: '³',
};
for (const [l, base] of Object.entries({ a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', c: 'c', n: 'n', y: 'y' })) {
  const acentos = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' };
  for (const [nome, marca] of Object.entries(acentos)) {
    ENTIDADES[l + nome] = (base + marca).normalize('NFC');
    ENTIDADES[l.toUpperCase() + nome] = (base.toUpperCase() + marca).normalize('NFC');
  }
}

export function decodificar(texto) {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9]+);/gi, (m, nome) => ENTIDADES[nome] ?? m);
}

export function textoLimpo(html) {
  return decodificar(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// uuid v5 (RFC 4122) — mesmo código gera sempre o mesmo id
const NAMESPACE = '3d1f5a9e-2b7c-4e6a-8f0d-9c4b1e2a7d55';
export function uuidV5(nome) {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(Buffer.concat([ns, Buffer.from(nome, 'utf8')])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const sql = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

// Só o conteúdo principal da página (o HTML repete tudo numa versão de impressão)
function conteudoPrincipal(html) {
  const ini = html.indexOf('id="page-content"');
  const fim = html.indexOf('class="sidebar_right"', ini);
  return ini >= 0 ? html.slice(ini, fim > ini ? fim : undefined) : html;
}

// ── Parsers ──────────────────────────────────────────────────────────────────

// Página de área: lista de { codigo, nome, url, imagem }
export function lerArea(html) {
  const corpo = conteudoPrincipal(html);
  const itens = [];
  const re = /<figure[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<figcaption><b>([^<]+)<\/b><br><a\s+href='([^']+)'[^>]*>([\s\S]*?)<\/a><\/figcaption><\/figure>/g;
  for (const m of corpo.matchAll(re)) {
    itens.push({
      imagem: m[1].replace(/\?.*$/, ''),
      codigo: textoLimpo(m[2]),
      url: m[3],
      nome: textoLimpo(m[4]),
    });
  }
  if (itens.length) return itens;

  // Plano B: a lista "Páginas nesta Categoria"
  const lista = corpo.match(/Páginas nesta Categoria[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/);
  for (const m of (lista?.[1] ?? '').matchAll(/<a href='([^']+)'[^>]*>([\s\S]*?)<\/a>/g)) {
    itens.push({ imagem: null, codigo: null, url: m[1], nome: textoLimpo(m[2]).replace(/^Especialidade de /, '') });
  }
  return itens;
}

// Página de especialidade: metadados + requisitos aninhados
export function lerEspecialidade(html) {
  const meta = (nome) => html.match(new RegExp(`<meta name="${nome}" content="([^"]*)"`))?.[1] ?? null;
  const corpo = conteudoPrincipal(html);
  const titulo = textoLimpo(corpo.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');

  // Tabela: Área | Código | Nível | Ano | Instituição de Origem
  const tabela = corpo.match(/class='templ_especialidade_dbv'>([\s\S]*?)<\/table>/)?.[1] ?? '';
  const linhas = [...tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((l) =>
    [...l[1].matchAll(/<td(?![^>]*rowspan)[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textoLimpo(c[1])));
  const valores = linhas[1] ?? [];
  const imagem = tabela.match(/<td rowspan=2[^>]*>(?:(?!<\/td>)[\s\S])*?<img[^>]*src="([^"]+)"(?:(?!<td)[\s\S])*?<\/td><\/tr>/)?.[1]
    ?? meta('og:image');

  const codigoBody = html.match(/data-mda-code="([^"]*)"/)?.[1] || null;
  const codigo = codigoBody || (valores[0] && valores[1] ? `${valores[0]}-${valores[1]}` : null);

  // Texto entre a tabela e a primeira lista = notas da especialidade
  const depoisTabela = corpo.split('</no_text>')[1] ?? corpo;
  const iniLista = depoisTabela.search(/<ol\b/);
  const notas = textoLimpo(iniLista >= 0 ? depoisTabela.slice(0, iniLista) : '') || null;

  // Requisitos: percorre <ol>, </ol> e <li> em ordem, controlando a profundidade
  const requisitos = [];
  const pilha = [];   // último requisito de cada nível
  const contagem = [];
  let nivel = -1;
  const lista = iniLista >= 0 ? depoisTabela.slice(iniLista) : '';
  const re = /<ol\b[^>]*>|<\/ol>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of lista.matchAll(re)) {
    const tag = m[0].slice(0, 4).toLowerCase();
    if (tag.startsWith('<ol')) { nivel++; contagem[nivel] = 0; continue; }
    if (tag === '</ol') { nivel--; continue; }
    if (nivel < 0) continue;
    const texto = textoLimpo(m[1]);
    if (!texto) continue;
    contagem[nivel] = (contagem[nivel] ?? 0) + 1;
    const n = contagem[nivel];
    const pai = nivel > 0 ? pilha[nivel - 1] : null;
    const rotulo = !pai ? String(n)
      : nivel % 2 === 1 ? `${pai.rotulo}.${'abcdefghijklmnopqrstuvwxyz'[(n - 1) % 26]}`
        : `${pai.rotulo}.${n}`;
    const req = { rotulo, texto, nivel, pai: pai?.rotulo ?? null, numero: requisitos.length + 1 };
    requisitos.push(req);
    pilha[nivel] = req;
    pilha.length = nivel + 1;
  }

  return {
    titulo,
    nome: titulo.replace(/^Especialidade de /, ''),
    codigo,
    area: valores[0] ?? null,
    nivel: valores[2] ?? null,
    ano: valores[3] ?? null,
    instituicao: valores[4] ?? null,
    imagem: imagem ? imagem.replace(/\?.*$/, '') : null,
    revisao: meta('revised'),
    notas,
    requisitos,
  };
}

// ── Geração do SQL ───────────────────────────────────────────────────────────

export function gerarSql(especialidades, dataGeracao) {
  const out = [
    '-- =============================================================================',
    '-- SEED — Especialidades oficiais de Desbravadores (MDA Wiki)',
    `-- Gerado por scripts/importar-especialidades.mjs em ${dataGeracao}`,
    '-- Idempotente: ids fixos (uuid v5 do código) + upsert. Requer migrations 006 e 007.',
    '-- clube_id nulo = especialidade oficial, visível para todos os clubes.',
    '-- =============================================================================',
    '',
  ];
  for (const e of especialidades) {
    const id = uuidV5(`especialidade|${e.codigo}`);
    out.push(`-- ${e.codigo} ${e.nome} (${e.requisitos.length} itens)`);
    out.push(
      'insert into especialidades (id, nome, codigo, area, nivel, ano, instituicao, imagem_url, descricao, revisao, fonte_url, clube_id) values ' +
      `(${sql(id)}, ${sql(e.nome)}, ${sql(e.codigo)}, ${sql(e.areaNome)}, ${sql(e.nivel)}, ${sql(e.ano)}, ${sql(e.instituicao)}, ` +
      `${sql(e.imagem)}, ${sql(e.notas)}, ${sql(e.revisao)}, ${sql(e.url)}, null) ` +
      'on conflict (codigo) do update set nome = excluded.nome, area = excluded.area, nivel = excluded.nivel, ' +
      'ano = excluded.ano, instituicao = excluded.instituicao, imagem_url = excluded.imagem_url, ' +
      'descricao = excluded.descricao, revisao = excluded.revisao, fonte_url = excluded.fonte_url;');
    for (const r of e.requisitos) {
      const rid = uuidV5(`requisito|${e.codigo}|${r.rotulo}`);
      const pid = r.pai ? uuidV5(`requisito|${e.codigo}|${r.pai}`) : null;
      out.push(
        'insert into requisito_especialidade (id, especialidade_id, parent_id, numero, rotulo, texto, revisao, clube_id) ' +
        `select ${sql(rid)}, id, ${sql(pid)}, ${r.numero}, ${sql(r.rotulo)}, ${sql(r.texto)}, ${sql(e.revisao)}, null ` +
        `from especialidades where codigo = ${sql(e.codigo)} ` +
        'on conflict (id) do update set texto = excluded.texto, numero = excluded.numero, revisao = excluded.revisao;');
    }
    out.push('');
  }
  return out.join('\n') + '\n';
}

// ── Conferência com os .txt feitos à mão ─────────────────────────────────────

export function lerTxtManuais(pasta) {
  const mapa = new Map();
  for (const arq of readdirSync(pasta).filter((f) => f.endsWith('.txt'))) {
    const texto = readFileSync(join(pasta, arq), 'utf8').replace(/\r/g, '');
    for (const bloco of texto.split(/\n"\n/)) {
      const nome = bloco.match(/Especialidade de (.+)/)?.[1]?.trim();
      const cod = bloco.match(/^\s+([A-Z]{2}(?:-[A-Z]{2})?)\s+(\d{3})\s+\d/m);
      if (!nome || !cod) continue;
      const principais = bloco.split('\n').filter((l) => /^ {0,4}\d+\.\s/.test(l)).length;
      mapa.set(`${cod[1]}-${cod[2]}`, { nome, principais });
    }
  }
  return mapa;
}

// ── Execução ─────────────────────────────────────────────────────────────────

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function baixar(url) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resp = await fetch(encodeURI(decodeURI(url)), {
        headers: { 'User-Agent': 'SistemaBussola-importador/1.0 (projeto de clube de desbravadores)' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (err) {
      if (tentativa === 3) throw err;
      await esperar(2000 * tentativa);
    }
  }
}

function argumento(nome) {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : null;
}

async function main() {
  const saida = argumento('--saida') ?? 'seeds/especialidades_oficiais.sql';
  const filtro = argumento('--area');
  const pastaConferir = argumento('--conferir');
  const areas = AREAS.filter((a) => !filtro || a.toLowerCase().includes(filtro.toLowerCase()));

  const resultado = [];
  const avisos = [];
  for (const area of areas) {
    const areaNome = decodeURIComponent(area).replace(/_/g, ' ');
    const htmlArea = await baixar(`${BASE}/${area}/`);
    const lista = lerArea(htmlArea);
    console.log(`\n${areaNome}: ${lista.length} especialidades`);
    for (const item of lista) {
      await esperar(PAUSA_MS);
      try {
        const html = await baixar(item.url);
        const e = lerEspecialidade(html);
        if (!e.requisitos.length) e.html = html;
        e.areaNome = areaNome;
        e.url = item.url;
        e.codigo ??= item.codigo;
        e.imagem ??= item.imagem;
        if (!e.codigo) { avisos.push(`sem código: ${item.url}`); continue; }
        if (!e.requisitos.length) avisos.push(`sem requisitos: ${e.codigo} ${e.nome}`);
        resultado.push(e);
        process.stdout.write(`  ${e.codigo.padEnd(10)} ${String(e.requisitos.length).padStart(3)} itens  ${e.nome}\n`);
      } catch (err) {
        avisos.push(`erro em ${item.url}: ${err.message}`);
      }
    }
  }

  // Códigos repetidos (a mesma especialidade listada em duas áreas)
  const vistos = new Set();
  const unicos = resultado.filter((e) => (vistos.has(e.codigo) ? false : vistos.add(e.codigo)));

  const hoje = new Date().toISOString().slice(0, 10);
  const total = unicos.reduce((s, e) => s + e.requisitos.length, 0);
  const porParte = Number(argumento('--dividir')) || 0;

  if (porParte > 0) {
    // Vários arquivos menores: o SQL Editor do Supabase trava com arquivos muito grandes
    const pasta = saida.replace(/\.sql$/, '');
    mkdirSync(pasta, { recursive: true });
    const partes = Math.ceil(unicos.length / porParte);
    for (let p = 0; p < partes; p++) {
      const arquivo = join(pasta, `parte_${String(p + 1).padStart(2, '0')}.sql`);
      writeFileSync(arquivo, gerarSql(unicos.slice(p * porParte, (p + 1) * porParte), hoje), 'utf8');
    }
    console.log(`\n${unicos.length} especialidades, ${total} requisitos → ${pasta}/ (${partes} partes)`);
  } else {
    mkdirSync(dirname(saida), { recursive: true });
    writeFileSync(saida, gerarSql(unicos, hoje), 'utf8');
    console.log(`\n${unicos.length} especialidades, ${total} requisitos → ${saida}`);
  }

  // Páginas sem requisitos: guarda o HTML para análise do formato
  const semRequisitos = unicos.filter((e) => !e.requisitos.length);
  if (semRequisitos.length) {
    mkdirSync('mda_problemas', { recursive: true });
    for (const e of semRequisitos) writeFileSync(join('mda_problemas', `${e.codigo}.html`), e.html, 'utf8');
    console.log(`HTML das ${semRequisitos.length} páginas sem requisitos salvo em mda_problemas/`);
  }

  if (pastaConferir) {
    const manuais = lerTxtManuais(pastaConferir);
    if (!manuais.size) console.log(`\nAtenção: nenhuma especialidade encontrada nos .txt de "${pastaConferir}".`);
    let iguais = 0;
    const diferentes = [];
    for (const [codigo, m] of manuais) {
      const e = unicos.find((x) => x.codigo === codigo);
      const principais = e?.requisitos.filter((r) => !r.pai).length;
      if (e && principais === m.principais) iguais++;
      else diferentes.push(`${codigo} ${m.nome}: txt=${m.principais}, wiki=${principais ?? 'não encontrada'}`);
    }
    console.log(`\nConferência com ${manuais.size} especialidades dos .txt: ${iguais} iguais, ${diferentes.length} diferentes`);
    diferentes.forEach((d) => console.log(`  ${d}`));
  }

  if (avisos.length) {
    console.log(`\nAvisos (${avisos.length}):`);
    avisos.forEach((a) => console.log(`  ${a}`));
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
