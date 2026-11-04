// Início: classe do membro, próximos compromissos, especialidades e atalhos.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Award, BookOpen, CalendarDays, ChevronRight, ClipboardCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { Colunas, Grade, Tela, useLargo } from '@/components/layout';
import { MENU } from '@/components/menu';
import {
  Avatar, Botao, Capa, Cartao, Chip, FaixaClasse, Icone, Item, Numero, Progresso, Secao, Selo, T, Vazio,
} from '@/components/ui';
import * as api from '@/lib/api';
import { LIDERANCA, primeiroNome, useAuth } from '@/lib/auth';
import { capitalizar, dataCurta, dataLonga, fmt } from '@/lib/datas';

export default function Inicio() {
  const { perfil, membro, clube, tem } = useAuth();
  const largo = useLargo();
  const nome = primeiroNome(perfil?.nome_completo ?? membro?.nome);

  const cartao = useQuery({
    queryKey: ['cartao', membro?.id],
    queryFn: () => api.cartaoDoMembro(membro!.id, membro!.classe),
    enabled: !!membro,
  });
  const agenda = useQuery({
    queryKey: ['eventos', clube?.id],
    queryFn: () => api.eventos(clube!.id),
    enabled: !!clube,
  });
  const verInstrucoes = tem(LIDERANCA) || tem(['instrutor']);
  const instr = useQuery({
    queryKey: ['instrucoes', clube?.id],
    queryFn: () => api.instrucoes(clube!.id),
    enabled: !!clube && verInstrucoes,
  });
  const esp = useQuery({
    queryKey: ['progresso-esp', membro?.id],
    queryFn: () => api.progressoEspecialidades(membro!.id),
    enabled: !!membro,
  });
  const catalogo = useQuery({ queryKey: ['catalogo'], queryFn: api.catalogoEspecialidades, enabled: !!membro, staleTime: 1000 * 60 * 60 });
  const freq = useQuery({
    queryKey: ['freq-propria', membro?.id],
    queryFn: () => api.marcacoesDesde([membro!.id], api.inicioTrimestreISO()),
    enabled: !!membro,
  });

  const atualizando = cartao.isFetching || agenda.isFetching;
  const atualizar = () => { cartao.refetch(); agenda.refetch(); instr.refetch(); esp.refetch(); freq.refetch(); };

  if (!clube) {
    return (
      <Tela titulo={`Olá${nome ? ', ' + nome : ''}`}>
        <Cartao>
          <T w="negrito">Sua conta ainda não está ligada a um clube</T>
          <T s={14} c="texto2">Peça à diretoria do seu clube um link de convite. Ao abrir o link, sua conta é vinculada com o cargo certo.</T>
        </Cartao>
      </Tela>
    );
  }

  const hoje = api.hojeISO();
  // Evento em andamento (acampamento que já começou) continua em "Próximos" até o último dia
  const proximosEventos = (agenda.data ?? []).filter((e) => (e.fim ?? e.inicio).slice(0, 10) >= hoje).slice(0, 3);
  const meuPerfil = perfil?.id;
  const proximasInstr = (instr.data ?? [])
    .filter((i) => i.data >= hoje && (i.status === 'aceita' || (i.status === 'pendente' && i.instrutor_id === meuPerfil)))
    .filter((i) => i.instrutor_id === meuPerfil || i.atribuido_por === meuPerfil || tem(LIDERANCA))
    .slice(0, 3);

  const saudacao = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar nome={perfil?.nome_completo ?? membro?.nome} tamanho={48} />
      <View style={{ flex: 1 }}>
        <T s={13} w="medio" c="texto2">{capitalizar(dataLonga(new Date()))}</T>
        <T s={24} w="extra">Olá, {nome || 'desbravador'}</T>
      </View>
    </View>
  );

  const c = cartao.data;
  const blocoClasse = membro && c?.classe ? (
    <Capa>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Selo tamanho={26} />
        <T s={12} w="negrito" c="sobreDestaque" caixaAlta style={{ flex: 1 }}>Minha classe</T>
        {c.inscricao?.prazo ? <Chip texto={`Prazo: ${fmt(c.inscricao.prazo, 'MMM/yyyy')}`} bg="destaqueB" fg="sobreDestaque" /> : null}
      </View>
      <FaixaClasse />
      <T s={30} w="extra" c="sobreDestaque">{c.classe.nome}</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T s={40} w="extra" c="sobreDestaque" style={{ lineHeight: 46 }}>{c.concluidos}</T>
        <T s={15} w="medio" c="sobreDestaque">de {c.total} requisitos concluídos</T>
      </View>
      <Progresso valor={c.total ? c.concluidos / c.total : 0} trilho="destaqueB" cor="sobreDestaque" altura={10} />
      <Botao titulo="Abrir cartão" variante="inverso" onPress={() => router.push('/classe')} style={{ marginTop: 4 }} />
    </Capa>
  ) : null;

  const blocoFreq = membro && freq.data?.length ? (
    <Cartao>
      <T s={18} w="negrito">Frequência no trimestre</T>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {['Reunião', 'Instrução', 'Classe bíblica', 'Evento ou acampamento'].map((tipo) => {
          const m = freq.data!.filter((x) => x.chamada.tipo?.nome === tipo);
          if (!m.length) return null;
          return <Numero key={tipo} valor={`${m.filter((x) => x.presente).length}/${m.length}`} rotulo={tipo === 'Evento ou acampamento' ? 'Eventos' : tipo} style={{ minWidth: 110 }} />;
        })}
      </View>
    </Cartao>
  ) : null;

  const blocoProximos = (
    <View style={{ gap: 10 }}>
      <Secao titulo="Próximos" acao="Ver agenda" onAcao={() => router.push('/agenda')} />
      {proximasInstr.map((i) => (
        <Item key={i.id} esquerda={<Icone icone={BookOpen} />} titulo={`Instrução · ${api.tituloInstrucao(i)}`}
          sub={`${capitalizar(dataCurta(i.data))}${i.inicio ? ', ' + api.horario(i) : ''} · ${api.nomeInstrutor(i)}`}
          direita={i.status === 'pendente' ? <Chip texto="Responder" bg="terciaria" fg="sobreTerciaria" /> : undefined}
          onPress={() => router.push(`/instrucoes/${i.id}`)} />
      ))}
      {proximosEventos.map((e) => (
        <Item key={e.id} esquerda={<Icone icone={CalendarDays} bg="acentoSuave" fg="acento" />} titulo={e.titulo}
          sub={`${capitalizar(dataCurta(e.inicio))}${e.local ? ' · ' + e.local : ''}`}
          direita={!e.publicado ? <Chip texto="Rascunho" bg="aviso" fg="superficie" /> : undefined}
          onPress={() => router.push(`/agenda/${e.id}`)} />
      ))}
      {!proximasInstr.length && !proximosEventos.length && !agenda.isLoading ? <Vazio texto="Nada marcado para os próximos dias." icone={CalendarDays} /> : null}
    </View>
  );

  const nomes = new Map((catalogo.data ?? []).map((e) => [e.id, e]));
  const emAndamento = Object.entries(esp.data ?? {}).slice(0, 4);
  const blocoEsp = membro ? (
    <View style={{ gap: 10 }}>
      <Secao titulo="Especialidades" acao="Catálogo" onAcao={() => router.push('/especialidades')} />
      {emAndamento.length ? (
        <Grade colunas={4} colunasCelular={2} gap={10}>
          {emAndamento.map(([id, p]) => {
            const e = nomes.get(id);
            return (
              <Cartao key={id} gap={8} p={14}>
                <Icone icone={Award} bg="acentoSuave" fg="acento" tamanho={36} />
                <T s={14} w="negrito" linhas={2}>{e?.nome ?? 'Especialidade'}</T>
                <T s={12} w="semi" c={p.concluida ? 'sucesso' : 'primaria'}>
                  {(e?.codigo ? e.codigo + ' · ' : '') + (p.concluida ? 'Concluída' : `${p.feitos} de ${p.total || '?'}`)}
                </T>
              </Cartao>
            );
          })}
        </Grade>
      ) : <Vazio texto="Nenhuma especialidade em andamento ainda." icone={Award} />}
    </View>
  ) : null;

  const atalhos = MENU.filter((m) => m.grupo === 'Direção' || m.grupo === 'Diretoria').filter((m) => m.visivel({ membro: !!membro, tem }));
  const blocoAtalhos = atalhos.length ? (
    <View style={{ gap: 10 }}>
      <Secao titulo="Gerenciar" />
      <Grade colunas={2} gap={10}>
        {atalhos.map((m) => (
          <Item key={m.rota} esquerda={<Icone icone={m.icone} />} titulo={m.rotulo} sub={m.descricao} linhasSub={1}
            direita={<ChevronRight size={18} color="transparent" />} onPress={() => router.push(m.rota as never)} />
        ))}
      </Grade>
    </View>
  ) : null;

  const vazioMembro = !membro && !atalhos.length ? (
    <Cartao>
      <Icone icone={ClipboardCheck} />
      <T w="negrito">Bem-vindo ao {clube.nome}</T>
      <T s={14} c="texto2">Quando a secretaria ligar seu cadastro de membro à sua conta, sua classe e suas especialidades aparecem aqui.</T>
    </Cartao>
  ) : null;

  return (
    <Tela titulo={`Olá, ${nome || 'desbravador'}`} sobre={`${capitalizar(dataLonga(new Date()))} · ${clube.nome}`}
      semCabecalhoCelular aoAtualizar={atualizar} atualizando={atualizando}>
      {largo ? null : saudacao}
      <Colunas
        largura={480}
        esquerda={<>{blocoClasse}{blocoFreq}{vazioMembro}{!blocoClasse ? blocoAtalhos : null}</>}
        direita={<>{blocoProximos}{blocoEsp}{blocoClasse ? blocoAtalhos : null}</>}
      />
    </Tela>
  );
}
