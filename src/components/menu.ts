// Itens de navegação e quem vê cada um (os mesmos critérios das policies do banco).
import type { LucideIcon } from 'lucide-react-native';
import {
  Award, BookOpen, CalendarDays, ClipboardCheck, GraduationCap, Heart, House, LayoutGrid,
  Shield, User, Users, Wallet,
} from 'lucide-react-native';

import { DIRECAO, ESPIRITUAL, FINANCAS, LIDERANCA, Papel } from '@/lib/auth';

export type Acesso = { membro: boolean; tem: (p: Papel[]) => boolean };

export type ItemMenu = {
  rota: string;
  rotulo: string;
  descricao: string;
  icone: LucideIcon;
  grupo?: 'Liderança' | 'Direção' | 'Conta';
  visivel: (a: Acesso) => boolean;
};

const sempre = () => true;
const liderancaOuInstrutor = (a: Acesso) => a.tem(LIDERANCA) || a.tem(['instrutor']);

export const MENU: ItemMenu[] = [
  { rota: '/', rotulo: 'Início', descricao: 'Resumo do seu dia no clube', icone: House, visivel: sempre },
  { rota: '/classe', rotulo: 'Minha classe', descricao: 'Cartão e requisitos da classe', icone: GraduationCap, visivel: (a) => a.membro },
  { rota: '/especialidades', rotulo: 'Especialidades', descricao: 'Catálogo oficial e seu progresso', icone: Award, visivel: sempre },
  { rota: '/agenda', rotulo: 'Agenda', descricao: 'Eventos, acampamentos e reuniões', icone: CalendarDays, visivel: sempre },
  { rota: '/instrucoes', rotulo: 'Instruções', descricao: 'Pedidos, aceite e conclusão de requisitos', icone: BookOpen, grupo: 'Liderança', visivel: liderancaOuInstrutor },
  { rota: '/chamada', rotulo: 'Chamada', descricao: 'Presença por unidade e atividade', icone: ClipboardCheck, grupo: 'Liderança', visivel: liderancaOuInstrutor },
  { rota: '/unidade', rotulo: 'Unidade', descricao: 'Desbravadores, progresso e frequência', icone: Users, grupo: 'Liderança', visivel: (a) => a.tem(LIDERANCA) },
  { rota: '/espiritual', rotulo: 'Espiritual', descricao: 'Participação na Classe bíblica', icone: Heart, grupo: 'Liderança', visivel: (a) => a.tem(ESPIRITUAL) },
  { rota: '/equipe', rotulo: 'Equipe e cargos', descricao: 'Cargos, convites e concessões', icone: Shield, grupo: 'Direção', visivel: (a) => a.tem(DIRECAO) },
  { rota: '/financas', rotulo: 'Finanças', descricao: 'Mensalidades, caixa e cobranças', icone: Wallet, grupo: 'Direção', visivel: (a) => a.tem(FINANCAS) },
  { rota: '/perfil', rotulo: 'Perfil', descricao: 'Conta, tema e cor do app', icone: User, grupo: 'Conta', visivel: sempre },
];

export const CLUBE: ItemMenu = { rota: '/clube', rotulo: 'Clube', descricao: 'Tudo o que você gerencia', icone: LayoutGrid, visivel: sempre };

/** As quatro abas do celular: a segunda depende do cargo principal. */
export function abasDoCelular(a: Acesso): ItemMenu[] {
  const por = (rota: string) => MENU.find((m) => m.rota === rota)!;
  let segunda: ItemMenu;
  if (a.tem(DIRECAO)) segunda = CLUBE;
  else if (a.tem(['conselheiro', 'conselheiro_associado'])) segunda = por('/unidade');
  else if (a.tem(['instrutor'])) segunda = por('/instrucoes');
  else if (a.tem(['capelao'])) segunda = por('/espiritual');
  else if (a.membro) segunda = { ...por('/classe'), rotulo: 'Classe' };
  else segunda = por('/especialidades');
  return [por('/'), segunda, por('/agenda'), por('/perfil')];
}

export function rotaAtiva(pathname: string, rota: string) {
  if (rota === '/') return pathname === '/' || pathname === '';
  return pathname === rota || pathname.startsWith(rota + '/');
}
