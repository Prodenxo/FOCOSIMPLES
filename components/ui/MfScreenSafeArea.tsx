import React from 'react';
import { SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';

type Props = SafeAreaViewProps & {
  children: React.ReactNode;
};

/**
 * Safe area padrão das telas do app (topo + rodapé).
 * Use em telas com header mobile; evite `edges={['bottom']}` isolado.
 */
export function MfScreenSafeArea({ children, edges = ['top', 'bottom'], style, ...rest }: Props) {
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={edges} {...rest}>
      {children}
    </SafeAreaView>
  );
}
