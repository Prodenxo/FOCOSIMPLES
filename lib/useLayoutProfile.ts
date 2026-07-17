import { Platform, useWindowDimensions } from 'react-native';

/** KPIs hero (saldo + lateral) e toolbar de datas em linha. */
export const LAYOUT_WIDE_MIN = 720;

/** Datas início/fim lado a lado (com "até" entre elas). */
export const LAYOUT_INLINE_MIN = 520;

export type LayoutProfile = {
  isWeb: boolean;
  isNative: boolean;
  /** Largura efetiva (container medido ou janela). */
  width: number;
  /** Painel largo — hero KPIs desktop, datas inline. */
  isWide: boolean;
  /** Cabe datas + separador na mesma linha. */
  isInline: boolean;
};

/**
 * Perfil responsivo unificado: web usa breakpoints por viewport/container;
 * native usa largura da janela (tablet landscape entra em isWide).
 */
export function useLayoutProfile(measuredWidth = 0): LayoutProfile {
  const { width: windowWidth } = useWindowDimensions();
  const width = measuredWidth > 0 ? measuredWidth : windowWidth;
  const isWeb = Platform.OS === 'web';
  const isNative = !isWeb;

  return {
    isWeb,
    isNative,
    width,
    isWide: width >= LAYOUT_WIDE_MIN,
    isInline: width >= LAYOUT_INLINE_MIN,
  };
}
