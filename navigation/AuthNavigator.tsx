import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  BackHandler,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { RegisterAuthForm } from '../screens/auth/RegisterAuthForm';
import { AuthLayoutWeb } from '../components/auth/AuthLayoutWeb';
import { AuthLegalFooter } from '../components/AuthLegalFooter';
import {
  AuthAlert,
  AuthButton,
  AuthInput,
  AuthLink,
} from '../components/auth/AuthFormControls';
import { AuthLayoutMobile } from '../components/auth/AuthLayoutMobile';
import { getAuthPalette } from '../components/auth/authTokens';
import { useThemeStore } from '../store/themeStore';
import { useInviteTokenFromDeepLink } from '../lib/registerInviteDeepLink';

type AuthView = 'login' | 'forgot' | 'register';

export default function AuthNavigator() {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const signIn = useAuthStore((state) => state.signIn);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const palette = getAuthPalette(isDarkMode);
  const inviteToken = useInviteTokenFromDeepLink();
  const hasInvite = inviteToken.length > 0;

  useEffect(() => {
    if (hasInvite && authView === 'login') {
      setAuthView('register');
    }
  }, [hasInvite, authView]);

  const goLogin = () => {
    setAuthView('login');
    setError('');
    setSuccessMessage('');
  };

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (authView === 'forgot' || authView === 'register') {
        goLogin();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [authView]);

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

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, informe seu e-mail');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await resetPassword(email);
      setSuccessMessage('Link de recuperação enviado! Verifique seu e-mail.');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar link de recuperação');
    } finally {
      setLoading(false);
    }
  };

  if (authView === 'register') {
    return (
      <RegisterAuthForm
        onGoToLogin={() => {
          goLogin();
          setEmail('');
          setPassword('');
        }}
      />
    );
  }

  if (Platform.OS === 'web') {
    if (authView === 'forgot') {
      return (
        <AuthLayoutWeb
          title="Recuperar Senha"
          subtitle="Digite seu e-mail para receber o link de recuperação"
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
            onSubmitEditing={handleResetPassword}
            returnKeyType="go"
          />
          {error ? (
            <AuthAlert kind="error" message={error} palette={palette} />
          ) : null}
          {successMessage ? (
            <AuthAlert kind="success" message={successMessage} palette={palette} />
          ) : null}
          <AuthButton
            label="Enviar Link de Recuperação"
            loadingLabel="Enviando..."
            loading={loading}
            onPress={handleResetPassword}
            palette={palette}
          />
          <AuthLink
            label="Voltar ao login"
            align="center"
            palette={palette}
            onPress={() => {
              goLogin();
              setEmail('');
            }}
          />
        </AuthLayoutWeb>
      );
    }

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
              onPress={() => {
                setAuthView('forgot');
                setError('');
              }}
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
            <Text style={{ color: palette.subtitleText, fontSize: 14 }}>
              Tem um convite?{' '}
            </Text>
            <AuthLink
              label="Cadastre-se"
              palette={palette}
              onPress={() => {
                setAuthView('register');
                setError('');
              }}
            />
          </View>
        ) : null}
      </AuthLayoutWeb>
    );
  }

  if (authView === 'forgot') {
    return (
      <AuthLayoutMobile
        title="Recuperar Senha"
        subtitle="Digite seu e-mail para receber o link de recuperação"
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
          onSubmitEditing={handleResetPassword}
          returnKeyType="go"
        />
        {error ? <AuthAlert kind="error" message={error} palette={palette} /> : null}
        {successMessage ? (
          <AuthAlert kind="success" message={successMessage} palette={palette} />
        ) : null}
        <AuthButton
          label="Enviar Link de Recuperação"
          loadingLabel="Enviando..."
          loading={loading}
          onPress={handleResetPassword}
          palette={palette}
        />
        <AuthLink
          label="Voltar ao login"
          align="center"
          palette={palette}
          onPress={() => {
            goLogin();
            setEmail('');
          }}
        />
      </AuthLayoutMobile>
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
            onPress={() => {
              setAuthView('forgot');
              setError('');
            }}
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
            onPress={() => {
              setAuthView('register');
              setError('');
            }}
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
