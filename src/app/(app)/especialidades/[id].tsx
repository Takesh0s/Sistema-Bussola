import { useLocalSearchParams } from 'expo-router';

import { DetalheEspecialidade } from '@/components/especialidade';
import { Tela } from '@/components/layout';

export default function Especialidade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Tela titulo="Especialidade" voltar="/especialidades" rotuloVoltar="Catálogo" gap={12}>
      <DetalheEspecialidade id={id} />
    </Tela>
  );
}
