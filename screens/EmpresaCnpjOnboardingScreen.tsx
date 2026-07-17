import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SitePageShell } from '../components/onboarding/SitePageShell'
import { MfScrollView } from '../components/ui/MfScrollView'
import { useMfTheme } from '../components/ui/useMfTheme'
import { useAppToastStore } from '../store/appToastStore'
import { formatEmpresaCnpj, isValidEmpresaCnpj, onlyEmpresaCnpjDigits } from '../lib/empresaCnpj'
import { humanizeCnpjLookupError } from '../lib/humanizeCnpjLookupError'
import { mapCnpjLookupToEmpresa } from '../lib/mapCnpjLookupToEmpresa'
import {
  getSiteTokens,
  mfSiteInput,
  mfSitePanel,
  mfSitePrimaryBtn,
  mfSiteNeonBtn,
  siteFieldLabelStyle,
  siteHeadingStyle,
  siteHintStyle,
  siteLeadStyle,
  sitePanelTitleStyle,
} from '../lib/siteDesign'
import { mfRadius, mfSpacing } from '../lib/theme'
import { SCREEN_TO_HREF } from '../lib/appNavConfig'
import { ACTIVATION_ROUTE } from '../lib/settingsRoutes'
import { completeEmpresaCnpjOnboarding } from '../services/empresaOnboardingService'
import { lookupEmpresaCnpj, type EmpresaFullData } from '../services/empresaService'
import { shouldRequireActivationRoute } from '../lib/authRedirect'
import { isEmpresaCnpjOnboardingRequired } from '../lib/empresaCnpjGate'
import { resetEmpresaCnpjLayoutGate } from '../lib/empresaCnpjLayoutGate'

const isValidEmail = (value: string) => {
  const trimmed = value.trim()
  return trimmed.includes('@') && trimmed.includes('.') && trimmed.length >= 6
}

function FormField ({
  label,
  value,
  onChangeText,
  required,
  keyboardType,
  autoCapitalize,
  placeholder,
  isDarkMode,
}: {
  label: string
  value: string
  onChangeText: (t: string) => void
  required?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words'
  placeholder?: string
  isDarkMode: boolean
}) {
  const tokens = getSiteTokens(isDarkMode)
  return (
    <View style={{ marginBottom: mfSpacing.sm }}>
      <Text style={[siteFieldLabelStyle, { color: tokens.textSecondary, marginBottom: mfSpacing.xs }]}>
        {label}
        {required ? <Text style={{ color: tokens.textMuted }}> *</Text> : null}
      </Text>
      <TextInput
        style={[
          fieldStyles.input,
          mfSiteInput(isDarkMode),
          { color: tokens.textPrimary },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  )
}

const fieldStyles = StyleSheet.create({
  input: {
    paddingHorizontal: mfSpacing.md,
    paddingVertical: mfSpacing.sm,
    fontSize: 15,
  },
})

export default function EmpresaCnpjOnboardingScreen () {
  const { isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getSiteTokens(isDarkMode), [isDarkMode])
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const showToast = useAppToastStore((s) => s.show)

  const [form, setForm] = useState<EmpresaFullData>({})
  const [cnpjInput, setCnpjInput] = useState('')
  const [lookupLoaded, setLookupLoaded] = useState(false)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const setField = (field: keyof EmpresaFullData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const leaveIfOnboardingDone = useCallback(async () => {
    const stillRequired = await isEmpresaCnpjOnboardingRequired()
    if (stillRequired) return
    const needsActivation = await shouldRequireActivationRoute()
    router.replace((needsActivation ? ACTIVATION_ROUTE : SCREEN_TO_HREF.MeuMei) as never)
  }, [router])

  useFocusEffect(
    useCallback(() => {
      void leaveIfOnboardingDone()
    }, [leaveIfOnboardingDone]),
  )

  const handleLookup = async () => {
    const digits = onlyEmpresaCnpjDigits(cnpjInput)
    if (digits.length !== 14) {
      setCnpjError('Informe um CNPJ com 14 dígitos.')
      return
    }
    if (!isValidEmpresaCnpj(digits)) {
      setCnpjError('CNPJ inválido. Confira os dígitos verificadores.')
      return
    }
    setCnpjLoading(true)
    setCnpjError('')
    try {
      const data = await lookupEmpresaCnpj(digits)
      setForm((prev) => mapCnpjLookupToEmpresa(data, { ...prev, cnpj: digits }))
      setLookupLoaded(true)
      setConfirmed(false)
      showToast('Dados carregados. Revise e complete o e-mail da empresa.', 'success')
    } catch (e: unknown) {
      setCnpjError(humanizeCnpjLookupError(e))
      setLookupLoaded(false)
    } finally {
      setCnpjLoading(false)
    }
  }

  const handleSubmit = async () => {
    const digits = onlyEmpresaCnpjDigits(cnpjInput)
    if (digits.length !== 14) {
      showToast('Informe um CNPJ válido com 14 dígitos.', 'info')
      return
    }
    if (!lookupLoaded || (!form.razao_social && !form.empresa)) {
      showToast('Busque o CNPJ na Receita antes de salvar.', 'info')
      return
    }
    if (!isValidEmail(form.email || '')) {
      showToast('Informe um e-mail válido da empresa.', 'info')
      return
    }
    if (!confirmed) {
      showToast('Marque a confirmação para salvar os dados.', 'info')
      return
    }
    setSubmitting(true)
    try {
      await completeEmpresaCnpjOnboarding({
        ...form,
        cnpj: digits,
        empresa: form.empresa || form.razao_social,
        razao_social: form.razao_social || form.empresa,
        confirmed: true,
      })
      resetEmpresaCnpjLayoutGate()
      showToast('CNPJ e dados da empresa salvos.', 'success')
      await leaveIfOnboardingDone()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar dados da empresa', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SitePageShell isDarkMode={isDarkMode}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <MfScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, mfSpacing.lg) + mfSpacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[siteHeadingStyle, { color: tokens.textPrimary }]}>
              Cadastro da empresa
            </Text>
            <Text style={[siteLeadStyle, { color: tokens.textSecondary }]}>
              Busque os dados na Receita, revise, informe o e-mail e confirme. Feito uma vez, não pedimos de novo.
            </Text>
          </View>

          <View style={mfSitePanel(isDarkMode)}>
            <Text style={[sitePanelTitleStyle, { color: tokens.textPrimary, marginBottom: mfSpacing.md }]}>
              CNPJ
            </Text>
            <TextInput
              style={[
                fieldStyles.input,
                mfSiteInput(isDarkMode),
                { color: tokens.textPrimary, marginBottom: mfSpacing.sm },
              ]}
              value={cnpjInput}
              onChangeText={(t) => {
                setCnpjInput(formatEmpresaCnpj(t))
                if (cnpjError) setCnpjError('')
                if (lookupLoaded) setLookupLoaded(false)
              }}
              placeholder="00.000.000/0001-00"
              placeholderTextColor={tokens.textMuted}
              keyboardType="numeric"
              maxLength={18}
              accessibilityLabel="CNPJ da empresa"
            />
            {cnpjError ? (
              <Text style={[siteHintStyle, { color: tokens.textSecondary, marginBottom: mfSpacing.sm }]}>
                {cnpjError}
              </Text>
            ) : null}
            <Pressable
              onPress={() => void handleLookup()}
              disabled={cnpjLoading || !isValidEmpresaCnpj(cnpjInput)}
              style={({ pressed }) => [
                mfSiteNeonBtn(isDarkMode),
                pressed && { opacity: 0.88 },
                (cnpjLoading || !isValidEmpresaCnpj(cnpjInput)) && { opacity: 0.45 },
              ]}
            >
              {cnpjLoading ? (
                <ActivityIndicator color={tokens.neon} />
              ) : (
                <>
                  <Ionicons name="search-outline" size={18} color={tokens.neon} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.neon }}>
                    Buscar dados na Receita
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {lookupLoaded ? (
            <View style={mfSitePanel(isDarkMode)}>
              <View style={styles.lookupHeader}>
                <Ionicons name="checkmark-circle-outline" size={20} color={tokens.neon} />
                <Text style={[sitePanelTitleStyle, { color: tokens.textPrimary }]}>
                  Dados encontrados
                </Text>
              </View>
              <Text style={[siteHintStyle, { color: tokens.textSecondary, marginBottom: mfSpacing.md }]}>
                Confira e ajuste se necessário. O e-mail não vem da Receita — informe o da empresa.
              </Text>

              <FormField
                isDarkMode={isDarkMode}
                label="Razão social"
                value={form.razao_social || form.empresa || ''}
                onChangeText={(t) => {
                  setForm((prev) => ({ ...prev, razao_social: t, empresa: t }))
                }}
                required
                placeholder="Razão social conforme Receita Federal"
              />
              <FormField
                isDarkMode={isDarkMode}
                label="Nome fantasia"
                value={form.nome_fantasia || ''}
                onChangeText={(t) => setField('nome_fantasia', t)}
                placeholder="Como a empresa é conhecida"
              />
              <FormField
                isDarkMode={isDarkMode}
                label="Inscrição estadual"
                value={form.inscricao_estadual || ''}
                onChangeText={(t) => setField('inscricao_estadual', t)}
              />
              <FormField
                isDarkMode={isDarkMode}
                label="Logradouro"
                value={form.logradouro || ''}
                onChangeText={(t) => setField('logradouro', t)}
              />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <FormField
                    isDarkMode={isDarkMode}
                    label="Número"
                    value={form.numero || ''}
                    onChangeText={(t) => setField('numero', t)}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <FormField
                    isDarkMode={isDarkMode}
                    label="Complemento"
                    value={form.complemento || ''}
                    onChangeText={(t) => setField('complemento', t)}
                  />
                </View>
              </View>
              <FormField
                isDarkMode={isDarkMode}
                label="Bairro"
                value={form.bairro || ''}
                onChangeText={(t) => setField('bairro', t)}
              />
              <View style={styles.row}>
                <View style={{ flex: 2 }}>
                  <FormField
                    isDarkMode={isDarkMode}
                    label="Cidade"
                    value={form.cidade || ''}
                    onChangeText={(t) => setField('cidade', t)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField
                    isDarkMode={isDarkMode}
                    label="UF"
                    value={form.estado || ''}
                    onChangeText={(t) => setField('estado', t.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                  />
                </View>
              </View>
              <FormField
                isDarkMode={isDarkMode}
                label="CEP"
                value={form.cep || ''}
                onChangeText={(t) => setField('cep', t)}
                keyboardType="numeric"
              />
              <FormField
                isDarkMode={isDarkMode}
                label="Telefone"
                value={form.telefone || ''}
                onChangeText={(t) => setField('telefone', t)}
                keyboardType="phone-pad"
              />
              <FormField
                isDarkMode={isDarkMode}
                label="E-mail da empresa"
                value={form.email || ''}
                onChangeText={(t) => setField('email', t)}
                required
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="contato@empresa.com.br"
              />

              <Pressable
                onPress={() => setConfirmed((v) => !v)}
                style={({ pressed }) => [
                  styles.confirmRow,
                  {
                    borderColor: confirmed ? tokens.neonBorder : tokens.inputBorder,
                    backgroundColor: confirmed ? tokens.neonDim : 'transparent',
                  },
                  pressed && { opacity: 0.92 },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: confirmed }}
              >
                <Ionicons
                  name={confirmed ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={confirmed ? tokens.neon : tokens.textMuted}
                />
                <Text style={[styles.confirmText, { color: tokens.textPrimary }]}>
                  Confirmo que os dados acima correspondem à minha empresa.
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleSubmit()}
                disabled={!confirmed || submitting}
                style={({ pressed }) => [
                  mfSitePrimaryBtn(isDarkMode, pressed),
                  { marginTop: mfSpacing.xs },
                  (!confirmed || submitting) && { opacity: 0.45 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Salvar e entrar"
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Salvar e entrar</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </MfScrollView>
      </SafeAreaView>
    </SitePageShell>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingTop: mfSpacing.lg,
    gap: mfSpacing.md,
    width: '100%',
  },
  header: {
    gap: mfSpacing.xs,
    marginBottom: mfSpacing.xs,
  },
  lookupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.sm,
    marginBottom: mfSpacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: mfSpacing.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: mfSpacing.sm,
    padding: mfSpacing.md,
    borderRadius: mfRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: mfSpacing.sm,
    marginBottom: mfSpacing.md,
  },
  confirmText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
})
