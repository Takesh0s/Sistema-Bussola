import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DetalheEvento, EditorEvento } from '@/components/evento';
import { Tela } from '@/components/layout';
import { DIRECAO, useAuth } from '@/lib/auth';

export default function Evento() {
  const { id, editar } = useLocalSearchParams<{ id: string; editar?: string }>();
  const { tem } = useAuth();
  const [editando, setEditando] = useState(editar === '1' && tem(DIRECAO));

  return (
    <Tela titulo={editando ? 'Editar evento' : 'Evento'} voltar="/agenda" rotuloVoltar="Agenda" gap={12}>
      {editando
        ? <EditorEvento id={id} aoSair={() => setEditando(false)} />
        : <DetalheEvento id={id} aoEditar={() => setEditando(true)} />}
    </Tela>
  );
}
