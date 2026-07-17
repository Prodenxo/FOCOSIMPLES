import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { AuthLayoutWeb } from '@/components/auth/AuthLayoutWeb';
import { AuthLayoutMobile } from '@/components/auth/AuthLayoutMobile';
import {
  AuthAlert,
  AuthButton,
  AuthInput,
  AuthLink,
} from '@/components/auth/AuthFormControls';
import { getAuthPalette } from '@/components/auth/authTokens';
import { useThemeStore } from '@/store/themeStore';
import { useInviteTokenFromDeepLink } from '@/lib/registerInviteDeepLink';
import { AuthLegalFooter } from '@/components/AuthLegalFooter';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const signIn = useAuthStore((state) => state.signIn);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const palette = getAuthPalette(isDarkMode);
  const router = useRouter();
  const inviteToken = useInviteTokenFromDeepLink();
  const hasInvite = inviteToken.length > 0;

  useEffect(() => {
    if (hasInvite) {
      router.replace('/register');
    }
  }, [hasInvite, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <AuthLayoutWeb
        title="Bem-vindo de volta"
        subtitle="Faça login para acessar sua conta"
        showIllustration
      >
        <AuthInput
          label="E-mail"
          palette={palette}
          placeholder="seu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          leftIcon="mail-outline"
        />
        <View>
          <AuthInput
            label="Senha"
            palette={palette}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            onSubmitEditing={handleLogin}
            returnKeyType="go"
            rightIconToggle={{
              iconWhenSecure: 'eye-off-outline',
              iconWhenVisible: 'eye-outline',
              isVisible: showPassword,
              onToggle: () => setShowPassword(!showPassword),
              accessibilityLabelShow: 'Mostrar senha',
              accessibilityLabelHide: 'Ocultar senha',
            }}
          />
          <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
            <AuthLink
              label="Esqueci minha senha"
              palette={palette}
              align="right"
              onPress={() => router.push('/forgot')}
            />
          </View>
        </View>
        {error ? <AuthAlert kind="error" message={error} palette={palette} /> : null}
        <AuthButton
          label="Entrar"
          loadingLabel="Entrando..."
          loading={loading}
          onPress={handleLogin}
          palette={palette}
        />
        <AuthLegalFooter />
        {hasInvite ? (
          <View style={webStyles.bottomRow}>
            <Text style={{ color: palette.subtitleText, fontSize: 14 }}>Tem um convite? </Text>
            <AuthLink
              label="Cadastre-se"
              palette={palette}
              onPress={() => router.push('/register')}
            />
          </View>
        ) : null}
      </AuthLayoutWeb>
    );
  }

  return (
    <AuthLayoutMobile
      title="Bem-vindo de volta"
      subtitle="Faça login para acessar sua conta"
    >
      <AuthInput
        label="E-mail"
        palette={palette}
        placeholder="seu@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        leftIcon="mail-outline"
      />
      <View>
        <AuthInput
          label="Senha"
          palette={palette}
          placeholder="Sua senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          onSubmitEditing={handleLogin}
          returnKeyType="go"
          rightIconToggle={{
            iconWhenSecure: 'eye-off-outline',
            iconWhenVisible: 'eye-outline',
            isVisible: showPassword,
            onToggle: () => setShowPassword(!showPassword),
            accessibilityLabelShow: 'Mostrar senha',
            accessibilityLabelHide: 'Ocultar senha',
          }}
        />
        <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
          <AuthLink
            label="Esqueci minha senha"
            palette={palette}
            align="right"
            onPress={() => router.push('/forgot')}
          />
        </View>
      </View>
      {error ? <AuthAlert kind="error" message={error} palette={palette} /> : null}
      <AuthButton
        label="Entrar"
        loadingLabel="Entrando..."
        loading={loading}
        onPress={handleLogin}
        palette={palette}
      />
      <AuthLegalFooter />
      {hasInvite ? (
        <View style={webStyles.bottomRow}>
          <Text style={{ color: palette.subtitleText, fontSize: 14 }}>Tem um convite? </Text>
          <AuthLink
            label="Cadastre-se"
            palette={palette}
            onPress={() => router.push('/register')}
          />
        </View>
      ) : null}
    </AuthLayoutMobile>
  );
}

const webStyles = StyleSheet.create({
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
});

