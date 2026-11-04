import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { Shell } from '@/components/layout';
import { useTema } from '@/theme';

export default function LayoutApp() {
  const { cores } = useTema();
  return (
    <Shell>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: cores.fundo },
          animation: Platform.OS === 'web' ? 'none' : 'default',
        }}
      />
    </Shell>
  );
}
