// Cobranças do mês: monta um e-mail para os responsáveis de quem está pendente ou atrasado
// e abre no app de e-mail do aparelho (destinatários em cópia oculta).
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { Tela } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Aviso, Botao, Campo, Cartao, Carregando, Interruptor, T } from '@/components/ui';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mesAno } from '@/lib/datas';
import { dados, supabase } from '@/lib/supabase';

type Linha = { desbravador_id: string; valor: number; mes: number; ano: number; pago: boolean };

export default function Cobrancas() {
  const p = useLocalSearchParams<{ mes?: string; ano?: string }>();
  const { clube } = useAuth();
  const toast = useToast();
  const mes = Number(p.mes ?? new Date().getMonth() + 1);
  const ano = Number(p.ano ?? new Date().getFullYear());
  const nomeMes = mesAno(new Date(ano, mes - 1, 15));

  const devedores = useQuery({
    queryKey: ['devedores', clube?.id, mes, ano],
    queryFn: async () => {
      const ms = await dados<Linha[]>(supabase.from('mensalidade').select('desbravador_id, valor, mes, ano, pago')
        .eq('clube_id', clube!.id).eq('pago', false).gt('valor', 0).or(`ano.lt.${ano},and(ano.eq.${ano},mes.lte.${mes})`));
      const ids = [...new Set(ms.map((m) => m.desbravador_id))];
      const emails = ids.length
        ? await dados<{ desbravador_id: string; email_responsavel: string | null }[]>(supabase.from('desbravador_privado').select('desbravador_id, email_responsavel').in('desbravador_id', ids))
        : [];
      return { ids, emails: [...new Set(emails.map((e) => e.email_responsavel).filter(Boolean) as string[])], semEmail: ids.length - emails.filter((e) => e.email_responsavel).length };
    },
    enabled: !!clube,
  });

  const [assunto, setAssunto] = useState(`Mensalidade de ${nomeMes} — ${clube?.nome ?? 'Clube'}`);
  const [mensagem, setMensagem] = useState(
    `Olá! A mensalidade do clube referente a ${nomeMes} vence no dia ${api.DIA_VENCIMENTO}. ` +
    'Se já pagou, desconsidere esta mensagem. Em caso de dúvida, responda este e-mail. Obrigado!',
  );
  const [pix, setPix] = useState(true);
  const [chavePix, setChavePix] = useState('');
  const corpo = useMemo(() => (pix && chavePix.trim() ? `${mensagem}\n\nChave Pix do clube: ${chavePix.trim()}` : mensagem), [mensagem, pix, chavePix]);

  async function enviar() {
    const d = devedores.data;
    if (!d?.emails.length) return toast('Nenhum responsável com e-mail cadastrado.', 'erro');
    const url = `mailto:?bcc=${encodeURIComponent(d.emails.join(','))}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast('Não foi possível abrir o app de e-mail.', 'erro');
    }
  }

  return (
    <Tela titulo="Enviar cobranças" voltar="/financas" rotuloVoltar="Finanças" gap={12}
      rodape={<Botao titulo={`Abrir e-mail para ${devedores.data?.emails.length ?? 0} responsáveis`} onPress={enviar} cheio />}>
      {devedores.isLoading ? <Carregando /> : (
        <Cartao gap={4}>
          <T s={13} w="semi" c="texto2">Para (cópia oculta)</T>
          <T s={15} w="negrito">Responsáveis de {devedores.data?.ids.length ?? 0} desbravadores com mensalidade em aberto</T>
          {devedores.data?.semEmail ? <T s={13} c="aviso">{devedores.data.semEmail} sem e-mail do responsável cadastrado.</T> : null}
        </Cartao>
      )}
      <Campo rotulo="Assunto" value={assunto} onChangeText={setAssunto} />
      <Campo rotulo="Mensagem" value={mensagem} onChangeText={setMensagem} multiline />
      <Cartao gap={12}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T s={15} w="semi">Incluir chave Pix do clube</T>
          <Interruptor valor={pix} onChange={setPix} />
        </View>
        {pix ? <Campo value={chavePix} onChangeText={setChavePix} placeholder="Chave Pix (e-mail, CPF/CNPJ ou aleatória)" /> : null}
      </Cartao>
      <Aviso tom="neutro" texto="O e-mail abre no seu app de e-mail com os responsáveis em cópia oculta; revise e envie de lá." />
    </Tela>
  );
}
