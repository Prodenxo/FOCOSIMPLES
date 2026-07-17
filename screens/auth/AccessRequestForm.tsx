import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthLayoutWeb } from '../../components/auth/AuthLayoutWeb';
import { AuthLayoutMobile } from '../../components/auth/AuthLayoutMobile';
import { AuthSectionHeader } from '../../components/auth/AuthSectionHeader';
import {
  AuthAlert,
  AuthButton,
  AuthInput,
  AuthLink,
} from '../../components/auth/AuthFormControls';
import { AuthPhoneInput } from '../../components/auth/AuthPhoneInput';
import {
  AUTH_FORM_TWO_COL_MIN_WIDTH,
  AUTH_FORM_WIDE_PANEL_MAX_WIDTH,
  getAuthPalette,
} from '../../components/auth/authTokens';
import { mfTechInsetSurface } from '../../lib/techDesign';
import { mfSpacing } from '../../lib/theme';
import { useThemeStore } from '../../store/themeStore';
import { validateSignupEmail, validateOptionalDisplayName } from '../../lib/authValidation';
import {
  validateStrongPassword,
  strongPasswordRequirementBullets,
} from '../../lib/passwordPolicy';
import { resolveAppOrigin } from '../../lib/appOrigin';
import { useAuthStore } from '../../store/authStore';

export type AccessRequestFormProps = {
  onGoToLogin: () => void;
  onDone: () => void;
  /**
   * Após cadastro + login no fluxo self-serve (ex.: futura landing → /planos).
   * Se omitido, fica em “solicitação em análise” sem Stripe.
   */
  onRegistered?: () => void;
  /** manual_approval = sem checkout; self_serve = prontos para planos. */
  signupMode?: 'manual_approval' | 'self_serve';
};

function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length > 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length > 8) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  if (d.length > 5) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  }
  if (d.length > 2) {
    return `${d.slice(0, 2)}.${d.slice(2)}`;
  }
  return d;
}

export function AccessRequestForm({
  onGoToLogin,
  onDone,
  onRegistered,
  signupMode = 'manual_approval',
}: AccessRequestFormProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const palette = getAuthPalette(isDarkMode);
  const signIn = useAuthStore((s) => s.signIn);
  const { width } = useWindowDimensions();
  const twoCol = width >= AUTH_FORM_TWO_COL_MIN_WIDTH;
  const stackInlineFields = width < 520;

  // Dados do usuário
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Dados da empresa
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [empresaTelefone, setEmpresaTelefone] = useState('');
  const [empresaEmail, setEmpresaEmail] = useState('');
  // UI
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState('');
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const passwordPolicyInvalid =
    Boolean(password.trim()) && !validateStrongPassword(password).ok;

  const cellHalf = twoCol ? styles.cellHalf : styles.cellFull;
  const cellFull = styles.cellFull;
  const inlineRowStyle = stackInlineFields ? styles.rowStacked : styles.row;

  const lookupCnpj = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    setCnpjMessage('');
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        setCnpjMessage('Não encontramos esse CNPJ — você pode preencher os dados manualmente.');
        return;
      }
      const d = await res.json();
      if (d.razao_social) setRazaoSocial(String(d.razao_social));
      if (d.cep) setCep(String(d.cep).replace(/\D/g, ''));
      const rua = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ').trim();
      if (rua) setLogradouro(rua);
      if (d.numero) setNumero(String(d.numero));
      if (d.complemento) setComplemento(String(d.complemento));
      if (d.bairro) setBairro(String(d.bairro));
      if (d.municipio) setCidade(String(d.municipio));
      if (d.uf) setEstado(String(d.uf));
      if (d.ddd_telefone_1) setEmpresaTelefone(String(d.ddd_telefone_1));
      if (d.email) setEmpresaEmail(String(d.email));
      setCnpjMessage('Dados da empresa preenchidos automaticamente. Confira e ajuste se necessário.');
    } catch {
      setCnpjMessage('Não foi possível consultar o CNPJ agora — preencha os dados manualmente.');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setShowErrors(true);

    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      setError('Preencha todos os campos obrigatórios da seção "Seus dados".');
      return;
    }
    const eEmail = validateSignupEmail(email);
    if (eEmail) {
      setError(eEmail);
      return;
    }
    const eName = validateOptionalDisplayName(fullName);
    if (eName) {
      setError(eName);
      return;
    }
    const pwd = validateStrongPassword(password);
    if (!pwd.ok) {
      setError(pwd.message);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    if (cnpj.replace(/\D/g, '').length !== 14) {
      setError('Informe um CNPJ válido (14 dígitos).');
      return;
    }
    if (!razaoSocial.trim() && !nomeFantasia.trim()) {
      setError('Informe a razão social ou o nome fantasia.');
      return;
    }

    setLoading(true);
    try {
      const { getMeiApiBaseUrl } = await import('../../lib/runtimeEnv');
      const apiBase = getMeiApiBaseUrl().replace(/\/$/, '');
      if (!apiBase) {
        throw new Error('API não configurada. Defina EXPO_PUBLIC_MEI_API_URL_DEV=http://localhost:3333');
      }

      const res = await fetch(`${apiBase}/api/auth/register-empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            password,
          },
          empresa: {
            cnpj: cnpj.replace(/\D/g, ''),
            razaoSocial: razaoSocial.trim(),
            nomeFantasia: nomeFantasia.trim(),
            cep: cep.replace(/\D/g, ''),
            logradouro: logradouro.trim(),
            numero: numero.trim(),
            complemento: complemento.trim(),
            bairro: bairro.trim(),
            cidade: cidade.trim(),
            estado: estado.trim().toUpperCase(),
            telefone: empresaTelefone.trim(),
            email: empresaEmail.trim(),
          },
          observacao: null,
          appOrigin: resolveAppOrigin(),
          signupMode,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (typeof payload?.message === 'string' && payload.message) ||
          (typeof payload?.error === 'string' && payload.error) ||
          'Não foi possível concluir o cadastro. Tente novamente.';
        throw new Error(msg);
      }

      if (onRegistered && signupMode === 'self_serve') {
        // Self-serve: entra na conta e segue para planos / Checkout.
        await signIn(email.trim(), password);
        onRegistered();
      } else {
        // Manual: sem Stripe — conta fica em análise.
        setSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isSelfServe = signupMode === 'self_serve' && Boolean(onRegistered);

  const successContent = (
    <View style={styles.successWrap}>
      <View style={[styles.successIcon, { backgroundColor: palette.alertSuccessBg }]}>
        <Ionicons name="checkmark-circle" size={48} color={palette.alertSuccessText} />
      </View>
      <Text style={[styles.successTitle, { color: palette.titleText }]}>
        {isSelfServe ? 'Cadastro concluído!' : 'Solicitação enviada'}
      </Text>
      <Text style={[styles.successText, { color: palette.subtitleText }]}>
        {isSelfServe
          ? 'Sua conta foi criada. Escolha um plano MEI para liberar o acesso ao sistema.'
          : 'Recebemos seus dados. A CF Contabilidade vai analisar e liberar o acesso. Você pode fazer login depois para acompanhar.'}
      </Text>
      <AuthButton
        label={isSelfServe ? 'Escolher plano' : 'Ir para o login'}
        onPress={() => (isSelfServe && onRegistered ? onRegistered() : onGoToLogin())}
        palette={palette}
      />
    </View>
  );

  const formContent = (
    <View style={twoCol ? styles.gridRow : styles.gridStack}>
      <View style={cellFull}>
        <AuthSectionHeader title="Seus dados" palette={palette} />
      </View>

      <View style={cellHalf}>
        <AuthInput
          label="Nome completo"
          required
          palette={palette}
          placeholder="Seu nome completo"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          leftIcon="person-outline"
        />
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="E-mail"
          required
          palette={palette}
          placeholder="seu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          leftIcon="mail-outline"
        />
      </View>
      <View style={cellFull}>
        <AuthPhoneInput
          label="Telefone"
          required
          palette={palette}
          value={phone}
          onChange={setPhone}
          hasError={showErrors && !phone.trim()}
          isDarkMode={isDarkMode}
        />
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="Senha"
          required
          palette={palette}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          rightIconToggle={{
            iconWhenSecure: 'eye-off-outline',
            iconWhenVisible: 'eye-outline',
            isVisible: showPassword,
            onToggle: () => setShowPassword(!showPassword),
            accessibilityLabelShow: 'Mostrar senha',
            accessibilityLabelHide: 'Ocultar senha',
          }}
        />
        <View
          style={[
            styles.requirementsList,
            mfTechInsetSurface(isDarkMode),
            { marginTop: mfSpacing.sm },
          ]}
        >
          {strongPasswordRequirementBullets().map((line) => (
            <Text key={line} style={{ color: palette.subtitleText, fontSize: 12, lineHeight: 18 }}>
              • {line}
            </Text>
          ))}
        </View>
        {passwordPolicyInvalid && showErrors ? (
          <Text style={{ color: palette.alertErrorText, fontSize: 12, marginTop: 4 }}>
            {(validateStrongPassword(password) as { ok: false; message: string }).message}
          </Text>
        ) : null}
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="Confirmar senha"
          required
          palette={palette}
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirm}
          autoCapitalize="none"
          rightIconToggle={{
            iconWhenSecure: 'eye-off-outline',
            iconWhenVisible: 'eye-outline',
            isVisible: showConfirm,
            onToggle: () => setShowConfirm(!showConfirm),
            accessibilityLabelShow: 'Mostrar senha',
            accessibilityLabelHide: 'Ocultar senha',
          }}
        />
      </View>

      <View style={cellFull}>
        <AuthSectionHeader title="Dados da empresa" palette={palette} />
      </View>

      <View style={cellFull}>
        <AuthInput
          label="Nome fantasia"
          palette={palette}
          placeholder="Nome comercial da empresa"
          value={nomeFantasia}
          onChangeText={setNomeFantasia}
        />
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="CNPJ"
          required
          palette={palette}
          placeholder="00.000.000/0000-00"
          value={cnpj}
          onChangeText={(v) => setCnpj(maskCnpj(v))}
          onBlur={lookupCnpj}
          keyboardType="numeric"
          leftIcon="business-outline"
        />
        {cnpjLoading ? (
          <View style={styles.cnpjHintRow}>
            <ActivityIndicator size="small" color={palette.linkText} />
            <Text style={{ color: palette.subtitleText, fontSize: 12, marginLeft: 8 }}>
              Buscando dados do CNPJ...
            </Text>
          </View>
        ) : cnpjMessage ? (
          <Text style={{ color: palette.subtitleText, fontSize: 12, marginTop: 6 }}>
            {cnpjMessage}
          </Text>
        ) : null}
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="Razão social"
          required
          palette={palette}
          placeholder="Razão social da empresa"
          value={razaoSocial}
          onChangeText={setRazaoSocial}
        />
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="CEP"
          palette={palette}
          placeholder="Somente números"
          value={cep}
          onChangeText={(v) => setCep(v.replace(/\D/g, '').slice(0, 8))}
          keyboardType="numeric"
        />
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="Logradouro"
          palette={palette}
          placeholder="Rua, avenida..."
          value={logradouro}
          onChangeText={setLogradouro}
        />
      </View>
      <View style={cellFull}>
        <View style={inlineRowStyle}>
          <View style={stackInlineFields ? styles.rowItemStacked : styles.rowItem}>
            <AuthInput
              label="Número"
              palette={palette}
              placeholder="Nº"
              value={numero}
              onChangeText={setNumero}
            />
          </View>
          <View style={stackInlineFields ? styles.rowItemStacked : styles.rowItem}>
            <AuthInput
              label="Complemento"
              palette={palette}
              placeholder="Sala, andar..."
              value={complemento}
              onChangeText={setComplemento}
            />
          </View>
        </View>
      </View>
      <View style={cellFull}>
        <View style={inlineRowStyle}>
          <View style={stackInlineFields ? styles.rowItemStacked : styles.rowItemWide}>
            <AuthInput
              label="Bairro"
              palette={palette}
              placeholder="Bairro"
              value={bairro}
              onChangeText={setBairro}
            />
          </View>
          <View style={stackInlineFields ? styles.rowItemStacked : styles.rowItemWide}>
            <AuthInput
              label="Cidade"
              palette={palette}
              placeholder="Cidade"
              value={cidade}
              onChangeText={setCidade}
            />
          </View>
          <View style={stackInlineFields ? styles.rowItemStacked : styles.rowItemNarrow}>
            <AuthInput
              label="UF"
              palette={palette}
              placeholder="UF"
              value={estado}
              onChangeText={(v) =>
                setEstado(v.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase())
              }
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="Telefone da empresa"
          palette={palette}
          placeholder="Telefone comercial"
          value={empresaTelefone}
          onChangeText={setEmpresaTelefone}
          keyboardType="phone-pad"
        />
      </View>
      <View style={cellHalf}>
        <AuthInput
          label="E-mail da empresa"
          palette={palette}
          placeholder="contato@empresa.com"
          value={empresaEmail}
          onChangeText={setEmpresaEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {error ? (
        <View style={cellFull}>
          <AuthAlert kind="error" message={error} palette={palette} />
        </View>
      ) : null}

      <View style={cellFull}>
        <AuthButton
          label="Enviar solicitação"
          loadingLabel="Enviando..."
          loading={loading}
          onPress={handleSubmit}
          palette={palette}
        />
        <View style={styles.bottomRow}>
          <Text style={{ color: palette.subtitleText, fontSize: 14 }}>Já tem acesso? </Text>
          <AuthLink label="Fazer login" palette={palette} onPress={onGoToLogin} />
        </View>
      </View>
    </View>
  );

  const title = submitted ? 'Solicitação enviada' : 'Quero garantir meu acesso';
  const subtitle = submitted
    ? undefined
    : 'Preencha seus dados e os da sua empresa. A CF Contabilidade analisa e libera o acesso.';
  const content = submitted ? successContent : formContent;

  if (Platform.OS === 'web') {
    return (
      <AuthLayoutWeb
        title={title}
        subtitle={subtitle}
        showIllustration={false}
        formMaxWidth={AUTH_FORM_WIDE_PANEL_MAX_WIDTH}
      >
        {content}
      </AuthLayoutWeb>
    );
  }

  return (
    <AuthLayoutMobile title={title} subtitle={subtitle}>
      {content}
    </AuthLayoutMobile>
  );
}

const styles = StyleSheet.create({
  gridStack: {
    gap: mfSpacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    rowGap: mfSpacing.md,
    columnGap: mfSpacing.md,
  },
  cellHalf: {
    width: '48%',
    minWidth: 240,
    flexGrow: 1,
  },
  cellFull: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: mfSpacing.md,
  },
  rowStacked: {
    flexDirection: 'column',
    gap: mfSpacing.md,
  },
  rowItem: {
    flex: 1,
    minWidth: 0,
  },
  rowItemStacked: {
    width: '100%',
  },
  rowItemWide: {
    flex: 2,
    minWidth: 0,
  },
  rowItemNarrow: {
    flex: 1,
    minWidth: 72,
    maxWidth: 120,
  },
  requirementsList: {
    gap: mfSpacing.xs,
    paddingHorizontal: mfSpacing.md,
    paddingVertical: mfSpacing.sm,
  },
  cnpjHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: mfSpacing.md,
    gap: mfSpacing.xs,
  },
  successWrap: {
    alignItems: 'center',
    gap: mfSpacing.md,
    paddingVertical: mfSpacing.sm,
    width: '100%',
    alignSelf: 'center',
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
