# Navegação no app (Expo / React Native)

## Decisão atual

O app usa **navegação custom** em [`navigation/SimpleNavigator.tsx`](../navigation/SimpleNavigator.tsx): um estado local (`currentScreen`) alterna entre telas principais e uma barra inferior customizada, em vez de **Tab / Stack** completos do React Navigation.

**Motivo (comentado em [`AppNavigator.tsx`](../navigation/AppNavigator.tsx)):** workaround para falha no Android com **Expo SDK 54 + React 19 + react-native-screens** (`java.lang.String cannot be cast to java.lang.Boolean`).

## Limitações

- Sem histórico nativo por aba (voltar do sistema não percorre sub-telas como em um stack).
- Deep links que precisem abrir uma aba/tela interna específica exigem lógica manual (não há integração automática com um único `linking` config de tabs/stacks).
- Estado de tela é em memória; ao matar o processo, a última aba não é restaurada automaticamente (salvo persistência explícita).

## Plano de migração futura

1. Acompanhar issues do Expo / `react-native-screens` para correção do bug no Android com RN 0.81+.
2. Ao atualizar SDK, criar branch de prova com **Bottom Tabs + Stack** por aba e rodar checklist:
   - login → cada aba;
   - fluxo Google Calendar / deep link `financas-pessoais://google-callback`;
   - MEI e telas admin sem regressão de layout.
3. Se o bug persistir, manter `SimpleNavigator` e documentar aqui a versão máxima testada.

## Referência

- Deep link OAuth: [`docs/ENV.md`](./ENV.md) (scheme `financas-pessoais`).
