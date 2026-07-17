import { createContext, useContext } from "react";

export type AppScreenName =
  | "Dashboard"
  | "Transacoes"
  | "Contas"
  | "ContaGlobal"
  | "Categorias"
  | "Orcamentos"
  | "Agenda"
  | "MeuMei"
  | "Configuracoes";

export type NavigationContextValue = {
  openDrawer: () => void;
  navigateTo: (screen: AppScreenName) => void;
  /** Top nav (web) ou bottom tabs (native) — oculta botão hamburger nos headers. */
  hasGlobalNav: boolean;
  /** Cadastro CNPJ / ativação: sem menu, tabs, sair ou impersonação. */
  shellLocked: boolean;
  /** Abre confirmação de sair (dialog no `SignOutProvider`). */
  requestSignOut: () => void;
};

const noop = () => {};

export const NavigationContext = createContext<NavigationContextValue>({
  openDrawer: noop,
  navigateTo: noop,
  hasGlobalNav: false,
  shellLocked: false,
  requestSignOut: noop,
});

export function useNavigationDrawer(): NavigationContextValue {
  return useContext(NavigationContext);
}
