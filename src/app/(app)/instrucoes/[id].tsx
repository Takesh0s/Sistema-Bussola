import { useLocalSearchParams } from 'expo-router';

import { DetalheInstrucao } from '@/components/instrucao';
import { Tela } from '@/components/layout';

export default function Instrucao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Tela titulo="Instrução" voltar="/instrucoes" rotuloVoltar="Instruções" gap={12}>
      <DetalheInstrucao id={id} />
    </Tela>
  );
}
