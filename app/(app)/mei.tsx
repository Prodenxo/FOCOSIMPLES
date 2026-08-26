import { Redirect } from 'expo-router';

/** Compatibilidade: links antigos `/mei` → `/notas`. */
export default function MeiLegacyRedirect() {
  return <Redirect href="/(app)/notas" />;
}
