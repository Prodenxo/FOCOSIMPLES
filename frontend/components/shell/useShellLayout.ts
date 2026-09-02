import { Platform, useWindowDimensions } from 'react-native';
import { SHELL_BREAKPOINT_MD } from './shellTokens';

/**
 * Web desktop (≥768px): navbar flutuante com links.
 * App nativo + web mobile: drawer (☰) — sem tab bar, sem top nav do shell.
 */
export function useShellLayout() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWebDesktop = isWeb && width >= SHELL_BREAKPOINT_MD;
  const usesDrawerNav = !isWebDesktop;

  return {
    isWeb,
    isWebDesktop,
    usesDrawerNav,
    width,
  };
}
