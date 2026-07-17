import { Redirect, type Href } from 'expo-router';

/** Atalho para links legados (/login) e redirect do shell autenticado. */
export default function LoginAliasRoute() {
  return <Redirect href={'/(auth)/login' as Href} />;
}
