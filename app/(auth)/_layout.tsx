import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, usePathname, type Href } from 'expo-router';
import { SCREEN_TO_HREF } from '@/lib/appNavConfig';
import { useAuthStore } from '@/store/authStore';
import { resolvePostAuthHref } from '@/lib/authRedirect';
import { isPasswordRecoveryPath } from '@/lib/passwordRecoveryDeepLink';

export default function AuthLayout() {
  const { user, sessionRestored } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const isResetPasswordRoute = isPasswordRecoveryPath(pathname);

  useEffect(() => {
    if (!sessionRestored || !user || isResetPasswordRoute) return;
    void (async () => {
      const href = await resolvePostAuthHref(SCREEN_TO_HREF.MeuMei as Href);
      router.replace(href);
    })();
  }, [sessionRestored, user, router, isResetPasswordRoute]);

  if (!sessionRestored) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1 },
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});
