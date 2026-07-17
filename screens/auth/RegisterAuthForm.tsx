import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { getSupabaseAuthMessagePt } from '../../lib/authErrors';
import {
  validateSignupEmail,
  validateOptionalDisplayName,
} from '../../lib/authValidation';
import {
  validateStrongPassword,
  strongPasswordRequirementBullets,
} from '../../lib/passwordPolicy';
import {
  validateInviteTokenPublic,
  type InviteValidationStatus,
} from '../../services/invitesService';
import { inviteStatusUserMessage } from '../../utils/registerInviteQuery';
import { useInviteTokenFromDeepLink } from '../../lib/registerInviteDeepLink';
import { AuthLayoutWeb } from '../../components/auth/AuthLayoutWeb';
import { AuthLayoutMobile } from '../../components/auth/AuthLayoutMobile';
import {
  AuthAlert,
  AuthButton,
  AuthInput,
  AuthLink,
} from '../../components/auth/AuthFormControls';
import { AuthPhoneInput } from '../../components/auth/AuthPhoneInput';
import { getAuthPalette } from '../../components/auth/authTokens';
import { useThemeStore } from '../../store/themeStore';

export type RegisterAuthFormProps = {
  onGoToLogin: () => void;
};

type InvitePhase = 'idle' | 'loading' | InviteValidationStatus | 'network_error' | 'no_invite';

/**
 * Cadastro fechado por convite (mirror de Site/pages/Register.tsx).
 * Detecta token de convite via:
 *  - web: window.location.search?convite=xxx
 *  - native: deep link financas-pessoais://register?convite=xxx
 *
 * Sem convite → "Acesso Restrito".
 * Com convite → valida via /api/invites/validate antes de mostrar formulário.
 * Após signUp → chama /api/invites/accept para vincular à empresa.
 */
export function RegisterAuthForm({ onGoToLogin }: RegisterAuthFormProps) {
  const inviteToken = useInviteTokenFromDeepLink();
  const hasInviteQuery = inviteToken.length > 0;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invitedByEmpresa, setInvitedByEmpresa] = useState<string | null>(null);
  const [invitePhase, setInvitePhase] = useState<InvitePhase>(() =>
    hasInviteQuery ? 'loading' : 'no_invite'
  );

  const signUp = useAuthStore((s) => s.signUp);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const palette = getAuthPalette(isDarkMode);

  useEffect(() => {
    if (!hasInviteQuery) {
      setInvitePhase('no_invite');
      return;
    }
    let cancelled = false;
    setInvitePhase('loading');
    void validateInviteTokenPublic(inviteToken).then(
      (r) => {
        if (cancelled) return;
        setInvitePhase(r.status);
        if (r.status === 'valid' && r.empresaName) {
          setInvitedByEmpresa(r.empresaName);
        }
      },
      () => {
        if (!cancelled) setInvitePhase('network_error');
      }
    );
    return () => {
      cancelled = true;
    };
  }, [hasInviteQuery, inviteToken]);

  const passwordPolicyInvalid =
    Boolean(password.trim()) && !validateStrongPassword(password).ok;

  const showForm = invitePhase === 'valid';
  const showRestricted = invitePhase === 'no_invite';
  const showLoading = invitePhase === 'loading';
  const showInviteError =
    hasInviteQuery &&
    invitePhase !== 'loading' &&
    invitePhase !== 'valid' &&
    invitePhase !== 'idle';

  const handleSubmit = async () => {
    setError('');
    setShowErrors(true);
    if (!email.trim() || !password.trim() || !displayName.trim() || !phone.trim()) {
      setError(
        'Todos os campos são obrigatórios. Por favor, preencha Nome, E-mail, Telefone e Senha.'
      );
      return;
    }

    const eEmail = validateSignupEmail(email);
    if (eEmail) {
      setError(eEmail);
      return;
    }
    const eName = validateOptionalDisplayName(displayName);
    if (eName) {
      setError(eName);
      return;
    }
    const pwd = validateStrongPassword(password);
    if (!pwd.ok) {
      setError(pwd.message);
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(
        email.trim(),
        password,
        phone.trim() || null,
        displayName.trim() || null,
        inviteToken || null
      );
      if (result.needsEmailConfirmation) {
        setError(
          `Verifique seu e-mail (${result.email}) para confirmar a conta. Depois faça login.`
        );
      }
    } catch (err: unknown) {
      setError(getSupabaseAuthMessagePt(err));
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      {showLoading ? (
        <View
          style={[
            inlineStyles.box,
            { backgroundColor: palette.alertSuccessBg, borderColor: palette.alertSuccessBorder },
          ]}
        >
          <ActivityIndicator size="small" color={palette.linkText} />
          <Text
            style={{
              color: palette.subtitleText,
              fontSize: 14,
              marginLeft: 10,
            }}
          >
            Verificando convite...
          </Text>
        </View>
      ) : null}

      {showInviteError ? (
        <>
          <AuthAlert
            kind="error"
            message={inviteStatusUserMessage(invitePhase as string)}
            palette={palette}
          />
          <Text
            style={{
              color: palette.subtitleText,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            Esta plataforma é exclusiva para convidados. Solicite um link ao administrador da sua
            empresa.
          </Text>
          <AuthLink
            label="Voltar ao login"
            align="center"
            palette={palette}
            onPress={onGoToLogin}
          />
        </>
      ) : null}

      {showRestricted ? (
        <>
          <AuthAlert
            kind="error"
            message="Nenhum convite detectado."
            palette={palette}
          />
          <Text
            style={{
              color: palette.subtitleText,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            Você precisa de um link de convite válido para criar uma conta nesta plataforma.
          </Text>
          <AuthLink
            label="Voltar ao login"
            align="center"
            palette={palette}
            onPress={onGoToLogin}
          />
        </>
      ) : null}

      {showForm ? (
        <>
          {invitedByEmpresa ? (
            <View
              style={[
                inlineStyles.empresaBanner,
                {
                  backgroundColor: palette.alertSuccessBg,
                  borderColor: palette.alertSuccessBorder,
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={palette.alertSuccessText}
                style={{ marginRight: 10 }}
              />
              <Text
                style={{
                  color: palette.alertSuccessText,
                  fontSize: 14,
                  lineHeight: 20,
                  flex: 1,
                }}
              >
                Você foi convidado pela empresa{' '}
                <Text style={{ fontWeight: '700' }}>{invitedByEmpresa}</Text> para o sistema.
              </Text>
            </View>
          ) : null}

          <AuthInput
            label="E-mail *"
            palette={palette}
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="mail-outline"
          />
          <AuthInput
            label="Nome Completo *"
            palette={palette}
            placeholder="Seu nome completo"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            leftIcon="person-outline"
          />
          <AuthPhoneInput
            label="Telefone *"
            palette={palette}
            value={phone}
            onChange={setPhone}
            hasError={showErrors && !phone.trim()}
            isDarkMode={isDarkMode}
          />
          <View>
            <AuthInput
              label="Senha *"
              palette={palette}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              onSubmitEditing={handleSubmit}
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
            <View style={inlineStyles.requirementsList}>
              {strongPasswordRequirementBullets().map((line) => (
                <Text
                  key={line}
                  style={{
                    color: palette.subtitleText,
                    fontSize: 12,
                    lineHeight: 18,
                  }}
                >
                  • {line}
                </Text>
              ))}
            </View>
            {passwordPolicyInvalid && showErrors ? (
              <Text
                style={{
                  color: palette.alertErrorText,
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {(validateStrongPassword(password) as { ok: false; message: string }).message}
              </Text>
            ) : null}
          </View>

          {error ? <AuthAlert kind="error" message={error} palette={palette} /> : null}

          <AuthButton
            label="Cadastrar"
            loadingLabel="Cadastrando..."
            loading={loading}
            onPress={handleSubmit}
            palette={palette}
          />
          <View style={inlineStyles.bottomRow}>
            <Text style={{ color: palette.subtitleText, fontSize: 14 }}>
              Já tem uma conta?{' '}
            </Text>
            <AuthLink label="Faça login" palette={palette} onPress={onGoToLogin} />
          </View>
        </>
      ) : null}
    </>
  );

  const title = hasInviteQuery ? 'Criar conta com convite' : 'Acesso Restrito';
  const subtitle = hasInviteQuery
    ? 'Use o link enviado pelo administrador da empresa'
    : 'Esta plataforma é exclusiva para convidados';

  if (Platform.OS === 'web') {
    return (
      <AuthLayoutWeb title={title} subtitle={subtitle} showIllustration>
        {content}
      </AuthLayoutWeb>
    );
  }

  return (
    <AuthLayoutMobile title={title} subtitle={subtitle}>
      <View style={{ gap: 16 }}>{content}</View>
    </AuthLayoutMobile>
  );
}

const inlineStyles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  empresaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  requirementsList: {
    marginTop: 8,
    gap: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
});

