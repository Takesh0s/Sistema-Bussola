"""Gera seeds/requisitos_classes.sql a partir do texto dos cartões copiados do MDA Wiki.

Uso: python scripts/gerar_classes.py <pasta_dos_cartoes> seeds/requisitos_classes.sql

A pasta deve ter um .txt por cartão, com o texto da página copiado do navegador
(Ctrl+A, Ctrl+C na página do cartão no MDA Wiki). A primeira linha é o título.

Formato de entrada (texto visível da página, copiado do navegador):
  - seções: "I - Geral" (classes), "Classe Avançada - Nome", "I. Título" e
    "Pré-Requisitos" (liderança);
  - requisitos indentados de 4 em 4 espaços; cada nível a mais é um subitem;
  - no cartão de Agrupadas, cada requisito termina com as faixas "11 - 12 - >=15".
"""
import re
import sys
import uuid
from pathlib import Path

NS = uuid.UUID('6f2b1c4e-8d3a-4b7e-9c1f-0a5d2e7b3c91')  # namespace fixo: mesmos ids a cada geração

CLASSES = {
    'Cartão de Amigo': 'Amigo',
    'Cartão de Companheiro': 'Companheiro',
    'Cartão de Pesquisador': 'Pesquisador',
    'Cartão de Pioneiro': 'Pioneiro',
    'Cartão de Excursionista': 'Excursionista',
    'Cartão de Guia': 'Guia',
    'Cartão de Líder': 'Líder',
    'Cartão de Líder Master': 'Líder Máster',
    'Cartão de Líder Master Avançado': 'Líder Máster Avançado',
}
AGRUPADAS = 'Cartão de Classes Agrupadas'
REVISAO_CLASSES = 'mda.wiki.br, copiado em 2026-11-02'
REVISAO_AGRUPADAS = 'cartão de março/2018 (mda.wiki.br, copiado em 2026-11-02)'

# Termos de anúncio que o site injeta no fim de algumas linhas
ANUNCIOS = re.compile(r'\s+(LerLivros|PlanosAmigos|Gruposde Jovens|Aulasde Física|'
                      r'LivrosCristãos|Cursosde Gestão|CriarFóruns)\s*$')
SECAO_REGULAR = re.compile(r'^(I|II|III|IV|V|VI|VII|VIII|IX) - (.+)$')
SECAO_AVANCADA = re.compile(r'^Classe Avançada - (.+)$')
SECAO_LIDERANCA = re.compile(r'^(I|II|III|IV)\. (.+)$')
FAIXAS = re.compile(r'\s*((?:(?:11|12|13|14|>=15)\s*-\s*)*(?:11|12|13|14|>=15))\s*$')


def limpar(texto):
    texto = texto.replace(' ', ' ')
    texto = ANUNCIOS.sub('', texto)
    return re.sub(r'\s+', ' ', texto).strip()


def sql(texto):
    return "'" + texto.replace("'", "''") + "'" if texto is not None else 'null'


def ler_cartao(caminho, lideranca, agrupada):
    """Devolve a lista de requisitos: dicts com secao, avancada, nivel, texto, faixas."""
    linhas = caminho.read_text(encoding='utf-8').splitlines()
    itens, secao, avancada, dentro = [], None, False, False

    for bruta in linhas[1:]:
        if not bruta.strip() or bruta.strip() == ' ':
            continue
        texto = limpar(bruta)
        if not texto:
            continue

        # Cabeçalhos de seção
        m_reg = SECAO_REGULAR.match(texto) if not lideranca else None
        m_ava = SECAO_AVANCADA.match(texto)
        m_lid = SECAO_LIDERANCA.match(texto) if lideranca else None
        if m_reg:
            secao, avancada, dentro = f'{m_reg.group(1)} - {m_reg.group(2)}', False, True
            continue
        if m_ava:
            secao, avancada, dentro = texto, True, True
            continue
        if m_lid:
            secao, avancada, dentro = texto, False, True
            continue
        if lideranca and texto == 'Pré-Requisitos':
            secao, avancada, dentro = 'Pré-Requisitos', False, True
            continue
        if not dentro or texto.startswith('NOTA:'):
            continue

        espacos = len(bruta) - len(bruta.lstrip(' '))
        nivel = max(0, espacos // 4 - 1)  # 4 espaços = requisito; 8 = subitem...

        faixas = None
        if agrupada:
            m_f = FAIXAS.search(texto)
            if m_f and nivel == 0:
                faixas = sorted({15 if f == '>=15' else int(f)
                                 for f in re.findall(r'11|12|13|14|>=15', m_f.group(1))})
                texto = texto[:m_f.start()].rstrip(' :') + (':' if texto[:m_f.start()].rstrip().endswith(':') else '')
                texto = texto.strip()
        itens.append({'secao': secao, 'avancada': avancada, 'nivel': nivel,
                      'texto': texto, 'faixas': faixas})
    return itens


def rotular(itens, codigo_secao):
    """Monta rótulos (II.3.a), numeração global e parentesco a partir dos níveis."""
    saida, pilha, contagem, ordem = [], [], {}, 0
    secao_atual = None
    letras = 'abcdefghijklmnopqrstuvwxyz'
    for it in itens:
        if it['secao'] != secao_atual:
            secao_atual, pilha, contagem = it['secao'], [], {}
        nivel = min(it['nivel'], len(pilha))  # nunca pula nível
        pilha = pilha[:nivel]
        chave = tuple(p['rotulo'] for p in pilha)
        contagem[chave] = contagem.get(chave, 0) + 1
        n = contagem[chave]
        if nivel == 0:
            rotulo = f"{codigo_secao(it)}.{n}"
        elif nivel % 2 == 1:
            rotulo = f"{pilha[-1]['rotulo']}.{letras[(n - 1) % 26]}"
        else:
            rotulo = f"{pilha[-1]['rotulo']}.{n}"
        ordem += 1
        reg = dict(it, rotulo=rotulo, numero=ordem,
                   parent=pilha[-1] if pilha else None)
        if reg['faixas'] is None and reg['parent'] is not None:
            reg['faixas'] = reg['parent']['faixas']
        saida.append(reg)
        pilha.append(reg)
    return saida


def codigo(it):
    s = it['secao']
    if it['avancada']:
        return 'A'
    if s == 'Pré-Requisitos':
        return 'PR'
    return re.split(r'[ .]', s)[0]


def main(pasta, destino):
    cartoes = {}
    for arq in sorted(Path(pasta).glob('*.txt')):
        titulo = arq.read_text(encoding='utf-8').splitlines()[0].strip()
        cartoes[titulo] = arq

    faltando = [t for t in list(CLASSES) + [AGRUPADAS] if t not in cartoes]
    if faltando:
        sys.exit(f'Cartões ausentes: {faltando}')

    out = [
        '-- =============================================================================',
        '-- SEED — Requisitos oficiais das classes e do cartão de Classes Agrupadas',
        '-- Gerado por scripts/gerar_classes.py a partir do texto dos cartões do MDA Wiki.',
        '-- Idempotente: ids fixos (uuid v5) + "on conflict do nothing". Pode rodar de novo.',
        '-- Requer as migrations 007 e 008.',
        '-- =============================================================================',
        '',
    ]
    resumo = []

    for titulo, nome in CLASSES.items():
        lider = nome.startswith('Líder')
        itens = rotular(ler_cartao(cartoes[titulo], lider, False), codigo)
        out.append(f'-- {nome}: {len(itens)} itens')
        for it in itens:
            rid = uuid.uuid5(NS, f'classe|{nome}|{it["rotulo"]}')
            pid = uuid.uuid5(NS, f'classe|{nome}|{it["parent"]["rotulo"]}') if it['parent'] else None
            out.append(
                'insert into requisito_classe (id, classe_id, parent_id, secao, numero, rotulo, texto, avancada, revisao) '
                f"select '{rid}', id, {sql(str(pid)) if pid else 'null'}, {sql(it['secao'])}, {it['numero']}, "
                f"{sql(it['rotulo'])}, {sql(it['texto'])}, {'true' if it['avancada'] else 'false'}, "
                f"{sql(REVISAO_CLASSES)} from classe where nome = {sql(nome)} on conflict (id) do nothing;")
        out.append('')
        principais = sum(1 for i in itens if i['parent'] is None)
        avancados = sum(1 for i in itens if i['parent'] is None and i['avancada'])
        resumo.append((nome, principais, avancados, len(itens)))

    itens = rotular(ler_cartao(cartoes[AGRUPADAS], False, True), codigo)
    sem_faixa = [i['rotulo'] for i in itens if not i['faixas']]
    if sem_faixa:
        sys.exit(f'Requisitos de Agrupadas sem faixa de idade: {sem_faixa}')
    out.append(f'-- Classes Agrupadas: {len(itens)} itens')
    for it in itens:
        rid = uuid.uuid5(NS, f'agrupada|{it["rotulo"]}')
        pid = uuid.uuid5(NS, f'agrupada|{it["parent"]["rotulo"]}') if it['parent'] else None
        faixas = '{' + ','.join(map(str, it['faixas'])) + '}'
        out.append(
            'insert into requisito_agrupada (id, parent_id, secao, numero, rotulo, texto, faixas, revisao) values '
            f"('{rid}', {sql(str(pid)) if pid else 'null'}, {sql(it['secao'])}, {it['numero']}, "
            f"{sql(it['rotulo'])}, {sql(it['texto'])}, '{faixas}', {sql(REVISAO_AGRUPADAS)}) on conflict (id) do nothing;")
    resumo.append(('Classes Agrupadas', sum(1 for i in itens if i['parent'] is None), 0, len(itens)))

    Path(destino).write_text('\n'.join(out) + '\n', encoding='utf-8')
    print(f'{"classe":24} {"principais":>10} {"avançados":>9} {"c/ subitens":>11}')
    for nome, p, a, t in resumo:
        print(f'{nome:24} {p:>10} {a:>9} {t:>11}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
