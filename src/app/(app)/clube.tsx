// Atalhos para tudo o que a pessoa gerencia (segunda aba da diretoria no celular).
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { Grade, Tela } from '@/components/layout';
import { MENU } from '@/components/menu';
import { Icone, Item, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTema } from '@/theme';

export default function Clube() {
  const { membro, tem, clube } = useAuth();
  const { cores } = useTema();
  const itens = MENU.filter((m) => m.rota !== '/' && m.rota !== '/perfil' && m.visivel({ membro: !!membro, tem }));
  const grupos = ['Geral', 'Direção', 'Diretoria'] as const;

  return (
    <Tela titulo="Clube" sobre={clube?.nome}>
      {grupos.map((g) => {
        const doGrupo = itens.filter((m) => (m.grupo ?? 'Geral') === g);
        if (!doGrupo.length) return null;
        return (
          <View key={g} style={{ gap: 10 }}>
            <T s={12} w="negrito" c="texto2" caixaAlta>{g}</T>
            <Grade colunas={3} gap={10}>
              {doGrupo.map((m) => (
                <Item key={m.rota} esquerda={<Icone icone={m.icone} />} titulo={m.rotulo} sub={m.descricao}
                  direita={<ChevronRight size={18} color={cores.texto2} />} onPress={() => router.push(m.rota as never)} />
              ))}
            </Grade>
          </View>
        );
      })}
    </Tela>
  );
}
