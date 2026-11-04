// Cartão de classe de quem tem cargo: adultos também fazem classes (Líder,
// Líder Máster...). Quem ainda não tem cadastro de membro ativa o próprio aqui.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Award, GraduationCap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mensagemErro, supabase } from '@/lib/supabase';

import { CampoData, dataISO } from './campos';
import { useToast } from './toast';
import { Botao, Cartao, ChipFiltro, Segmentado, T } from './ui';

/** Atalhos para o próprio cartão ou, se ainda não existe, o formulário para ativar. */
export function MeuCartao() {
  const { membro } = useAuth();
  if (membro) {
    return (
      <Cartao gap={10}>
        <T s={16} w="negrito">Meu cartão de classe</T>
        <T s={13} c="texto2">{membro.classe ? `Classe: ${membro.classe.nome}` : 'Classe ainda não definida pela secretaria.'}</T>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Botao titulo="Abrir meu cartão" icone={GraduationCap} pequeno onPress={() => router.push('/classe')} />
          <Botao titulo="Minhas especialidades" icone={Award} variante="out" pequeno onPress={() => router.push('/especialidades')} />
        </View>
      </Cartao>
    );
  }
  return <AtivarCartao />;
}

export function AtivarCartao() {
  const { perfil, recarregar } = useAuth();
  const toast = useToast();
  const classes = useQuery({ queryKey: ['classes'], queryFn: api.classes, staleTime: Infinity });
  const [classeId, setClasseId] = useState<string | null>(null);
  const [nascimento, setNascimento] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | null>(perfil?.sexo ?? null);
  const [enviando, setEnviando] = useState(false);

  // Quem tem cargo costuma estar nas classes de liderança: começa sugerindo Líder
  useEffect(() => {
    if (!classeId && classes.data) setClasseId(classes.data.find((c) => c.tipo === 'lideranca')?.id ?? null);
  }, [classes.data, classeId]);

  if (!perfil) return null;

  async function ativar() {
    const nasc = nascimento ? dataISO(nascimento) : null;
    if (nascimento && !nasc) return toast('Confira a data de nascimento (DD/MM/AAAA).', 'erro');
    if (!sexo) return toast('Escolha o sexo.', 'erro');
    setEnviando(true);
    try {
      const { error } = await supabase.rpc('criar_meu_cartao', { p_classe: classeId, p_data_nascimento: nasc, p_sexo: sexo });
      if (error) throw error;
      await recarregar();
      toast('Cartão ativado.');
      router.push('/classe');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao gap={12}>
      <T s={16} w="negrito">Meu cartão de classe</T>
      <T s={13} c="texto2">Você ainda não tem cartão. Se está fazendo uma classe (por exemplo, Líder), ative o seu para acompanhar requisitos e especialidades. Quem marca seus requisitos é outra pessoa da liderança.</T>
      <T s={13} w="semi" c="texto2">Classe</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(classes.data ?? []).map((c) => <ChipFiltro key={c.id} texto={c.nome} ativo={classeId === c.id} onPress={() => setClasseId(c.id)} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <CampoData rotulo="Data de nascimento" valor={nascimento} aoMudar={setNascimento} style={{ flex: 1, minWidth: 140 }} />
      </View>
      <Segmentado opcoes={[{ valor: 'M', rotulo: 'Masculino' }, { valor: 'F', rotulo: 'Feminino' }]} valor={sexo ?? ('' as 'M')} onChange={setSexo} />
      <Botao titulo="Ativar meu cartão" onPress={ativar} carregando={enviando} cheio />
      <T s={12} c="texto2">Se a secretaria já tinha cadastrado você como membro, peça para ela ligar o cadastro à sua conta em vez de criar outro.</T>
    </Cartao>
  );
}
