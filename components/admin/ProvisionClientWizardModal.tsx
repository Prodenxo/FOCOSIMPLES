import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useMfTheme } from '../ui/useMfTheme'
import { cleanPhone } from '../../lib/auth-roles'
import { formatPhoneBrCell } from '../../lib/numberFormat'
import { createUser } from '../../lib/user-management'
import {
  adminCriarCatalogoFromCnaes,
  uploadAdminMeiCertificate,
  type AdminMeiCertificateStatus,
} from '../../services/adminUserDataService'
import type { CnpjLookupCnaeItem, CnpjLookupData } from '../../services/meiNotasService'
import { lookupCnpj } from '../../services/meiNotasService'
import { getWebScrollViewProps } from '../../lib/webScrollbar'
import { PasswordStrengthMeter } from '../ui/PasswordStrengthMeter'
import { validateStrongPassword } from '../../lib/passwordPolicy'

/** Steps do carrossel de provisionamento do cliente. */
type Step = 'conta' | 'certificado' | 'confirmacao' | 'catalogo'

export type ProvisionClientWizardModalProps = {
  visible: boolean
  onClose: () => void
  onCompleted: () => void
}

type PickedFile = { uri: string; name: string; type?: string }

const STEPS: Step[] = ['conta', 'certificado', 'confirmacao', 'catalogo']

function stepLabel (step: Step): string {
  switch (step) {
    case 'conta':
      return 'Conta'
    case 'certificado':
      return 'Certificado'
    case 'confirmacao':
      return 'Confirmação'
    case 'catalogo':
      return 'Catálogo'
    default:
      return ''
  }
}

/**
 * Carrossel do contador: cria cliente (1 vaga MEI) → certificado do cliente →
 * confirma dados → catálogo (pulável).
 */
export function ProvisionClientWizardModal ({
  visible,
  onClose,
  onCompleted,
}: ProvisionClientWizardModalProps) {
  const { theme, isDarkMode } = useMfTheme()
  const styles = useMemo(() => createStyles(theme, isDarkMode), [theme, isDarkMode])

  const [step, setStep] = useState<Step>('conta')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')

  const [createdUserId, setCreatedUserId] = useState<string | null>(null)
  const [certFile, setCertFile] = useState<PickedFile | null>(null)
  const [certPassword, setCertPassword] = useState('')
  const [certPasswordConfirm, setCertPasswordConfirm] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [certStatus, setCertStatus] = useState<(AdminMeiCertificateStatus & {
    cnpj?: string
    titular?: string
  }) | null>(null)

  const [cnpjData, setCnpjData] = useState<CnpjLookupData | null>(null)
  const [catalogMode, setCatalogMode] = useState<'NFE' | 'NFSE'>('NFE')
  const [selectedCnaes, setSelectedCnaes] = useState<Set<string>>(new Set())

  const stepAnim = useRef(new Animated.Value(1)).current
  const sheetAnim = useRef(new Animated.Value(0)).current

  const stepIndex = STEPS.indexOf(step)
  const clientLabel = displayName.trim() || email.trim() || 'este cliente'

  useEffect(() => {
    if (!visible) {
      sheetAnim.setValue(0)
      return
    }
    Animated.spring(sheetAnim, {
      toValue: 1,
      friction: 8,
      tension: 68,
      useNativeDriver: true,
    }).start()
  }, [visible, sheetAnim])

  useEffect(() => {
    stepAnim.setValue(0)
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [step, stepAnim])

  const reset = () => {
    setStep('conta')
    setError('')
    setBusy(false)
    setEmail('')
    setPassword('')
    setDisplayName('')
    setPhone('')
    setCreatedUserId(null)
    setCertFile(null)
    setCertPassword('')
    setCertPasswordConfirm('')
    setPasswordConfirm('')
    setCertStatus(null)
    setCnpjData(null)
    setCatalogMode('NFE')
    setSelectedCnaes(new Set())
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFinish = () => {
    reset()
    onCompleted()
    onClose()
  }

  const pickCertificate = async () => {
    setError('')
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/x-pkcs12',
          'application/pkcs12',
          'application/octet-stream',
          '*/*',
        ],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setCertFile({
        uri: asset.uri,
        name: asset.name || 'certificado.pfx',
        type: asset.mimeType || 'application/x-pkcs12',
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao selecionar arquivo.')
    }
  }

  const submitConta = async () => {
    setError('')
    const mail = email.trim().toLowerCase()
    const name = displayName.trim()
    const pass = password.trim()
    const whatsapp = cleanPhone(phone)
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError('Informe um e-mail válido.')
      return
    }
    if (!pass || pass.length < 8) {
      setError('Senha obrigatória (mínimo 8 caracteres).')
      return
    }
    const policy = validateStrongPassword(pass)
    if (!policy.ok) {
      setError(policy.message)
      return
    }
    if (pass !== passwordConfirm.trim()) {
      setError('As senhas da conta não coincidem.')
      return
    }
    if (!name) {
      setError('Nome é obrigatório.')
      return
    }
    if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) {
      setError('WhatsApp é obrigatório.')
      return
    }

    setBusy(true)
    try {
      if (createdUserId) {
        setStep('certificado')
        return
      }
      const result = await createUser({
        email: mail,
        password: pass,
        displayName: name,
        phone: whatsapp,
        role: 'usuario',
        mei: true,
      })
      setCreatedUserId(result.userId)
      setStep('certificado')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar usuário.')
    } finally {
      setBusy(false)
    }
  }

  const submitCertificado = async () => {
    setError('')
    if (!createdUserId) {
      setError('Usuário ainda não foi criado.')
      return
    }
    if (!certFile) {
      setError('Selecione o certificado .pfx deste cliente.')
      return
    }
    if (!certPassword.trim()) {
      setError('Informe a senha do certificado.')
      return
    }
    if (certPassword.trim() !== certPasswordConfirm.trim()) {
      setError('As senhas do certificado não coincidem.')
      return
    }

    setBusy(true)
    try {
      const status = await uploadAdminMeiCertificate(
        createdUserId,
        certFile,
        certPassword.trim(),
      )
      setCertStatus(status)
      setCertPassword('')
      setCertPasswordConfirm('')
      const cnpj = String(status.documento || status.cnpj || '').replace(/\D/g, '')
      if (cnpj.length === 14) {
        try {
          const lookup = await lookupCnpj(cnpj)
          setCnpjData(lookup)
          const codes = new Set(
            (lookup.cnaes || [])
              .map((c: CnpjLookupCnaeItem) => c.codigo)
              .filter(Boolean),
          )
          setSelectedCnaes(codes)
        } catch {
          setCnpjData(null)
        }
      }
      setStep('confirmacao')
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Falha ao importar certificado.'
      const friendly = /user_mei_certificates_empresa_id_ativo|duplicate key/i.test(raw)
        ? 'Não foi possível gravar o certificado (conflito no banco). Tente de novo; se persistir, avise o suporte.'
        : raw
      setError(friendly)
    } finally {
      setBusy(false)
    }
  }

  const goCatalogo = () => {
    setError('')
    setStep('catalogo')
  }

  const goBackStep = () => {
    if (busy) return
    setError('')
    if (step === 'certificado') setStep('conta')
    else if (step === 'confirmacao') setStep('certificado')
    else if (step === 'catalogo') setStep('confirmacao')
  }

  const goToStep = (target: Step) => {
    if (busy) return
    const targetIdx = STEPS.indexOf(target)
    if (targetIdx < 0 || targetIdx >= stepIndex) return
    // Só volta; não avança pelo stepper.
    if (target === 'conta' || createdUserId) {
      setError('')
      setStep(target)
    }
  }

  const toggleCnae = (codigo: string) => {
    setSelectedCnaes((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const importCatalogSelection = async () => {
    if (!createdUserId) {
      handleFinish()
      return
    }
    const items = (cnpjData?.cnaes || []).filter((c) => selectedCnaes.has(c.codigo))
    if (items.length === 0) {
      handleFinish()
      return
    }
    setBusy(true)
    setError('')
    try {
      await adminCriarCatalogoFromCnaes(createdUserId, {
        documentType: catalogMode,
        items: items.map((c) => ({
          codigo: c.codigo,
          descricao: c.descricao,
          principal: Boolean(c.principal),
        })),
      })
      handleFinish()
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Cliente criado. Catálogo pode ser preenchido depois.',
      )
      setBusy(false)
    }
  }

  const cnaes: CnpjLookupCnaeItem[] = cnpjData?.cnaes || []
  const webScroll = useMemo(
    () => (Platform.OS === 'web' ? getWebScrollViewProps(isDarkMode) : {}),
    [isDarkMode],
  )

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{
                translateY: sheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.eyebrow}>Provisionar cliente · 1 vaga</Text>
              <Text style={styles.title}>Criar novo usuário</Text>
            </View>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.stepper}>
            {STEPS.map((s, i) => {
              const active = i === stepIndex
              const done = i < stepIndex
              const canGoBack = done && !busy
              return (
                <Pressable
                  key={s}
                  style={styles.stepItem}
                  onPress={() => { if (canGoBack) goToStep(s) }}
                  disabled={!canGoBack}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !canGoBack }}
                  accessibilityLabel={`${stepLabel(s)}${done ? ', concluído, tocar para voltar' : active ? ', atual' : ''}`}
                >
                  {i > 0 ? (
                    <View
                      style={[
                        styles.stepConnector,
                        (done || active) && styles.stepConnectorActive,
                      ]}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.stepDot,
                      done && styles.stepDotDone,
                      active && styles.stepDotActive,
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : (
                      <Text style={[styles.stepDotText, (active || done) && { color: '#fff' }]}>
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepCaption,
                      active && styles.stepCaptionActive,
                      done && { color: theme.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {stepLabel(s)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <ScrollView
            style={[styles.body, webScroll.style]}
            {...(webScroll.className ? { className: webScroll.className } : {})}
            contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <Animated.View
              style={{
                opacity: stepAnim,
                transform: [{
                  translateX: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                }],
              }}
            >
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 'conta' ? (
              <>
                <View style={styles.callout}>
                  <Ionicons name="person-add-outline" size={18} color={theme.primary} />
                  <Text style={styles.hint}>
                    Conta do cliente final. Ele já nasce vinculado à sua empresa e{' '}
                    <Text style={styles.hintEm}>ocupa 1 vaga do seu sistema</Text>.
                    {createdUserId
                      ? ' Conta já criada neste fluxo — pode voltar sem duplicar.'
                      : ''}
                  </Text>
                </View>
                <Field label="E-mail" required styles={styles} theme={theme}>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="cliente@empresa.com"
                    placeholderTextColor={theme.placeholder}
                  />
                </Field>
                <Field label="Senha" required styles={styles} theme={theme}>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor={theme.placeholder}
                  />
                  <PasswordStrengthMeter password={password} />
                </Field>
                <Field label="Confirmar senha" required styles={styles} theme={theme}>
                  <TextInput
                    style={styles.input}
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    secureTextEntry
                    placeholder="Repita a senha da conta"
                    placeholderTextColor={theme.placeholder}
                  />
                </Field>
                <Field label="Nome" required styles={styles} theme={theme}>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Nome completo"
                    placeholderTextColor={theme.placeholder}
                  />
                </Field>
                <Field label="WhatsApp" required styles={styles} theme={theme}>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={(v) => setPhone(formatPhoneBrCell(v))}
                    keyboardType="phone-pad"
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={theme.placeholder}
                  />
                </Field>
              </>
            ) : null}

            {step === 'certificado' ? (
              <>
                <View style={styles.emphasisBox}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={theme.primary} />
                  <Text style={styles.emphasisText}>
                    Importe o certificado digital A1 (.pfx) de{' '}
                    <Text style={{ fontWeight: '800' }}>{clientLabel}</Text>
                    — não use o certificado do escritório.
                  </Text>
                </View>
                <Pressable
                  onPress={() => void pickCertificate()}
                  style={styles.fileBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="document-attach-outline" size={20} color={theme.primary} />
                  <Text style={styles.fileBtnText} numberOfLines={2}>
                    {certFile?.name || 'Selecionar certificado .pfx'}
                  </Text>
                </Pressable>
                <Field label="Senha do certificado" required styles={styles} theme={theme}>
                  <TextInput
                    style={styles.input}
                    value={certPassword}
                    onChangeText={setCertPassword}
                    secureTextEntry
                    placeholder="Senha do arquivo .pfx"
                    placeholderTextColor={theme.placeholder}
                  />
                </Field>
                <Field label="Confirmar senha do certificado" required styles={styles} theme={theme}>
                  <TextInput
                    style={styles.input}
                    value={certPasswordConfirm}
                    onChangeText={setCertPasswordConfirm}
                    secureTextEntry
                    placeholder="Repita a senha do .pfx"
                    placeholderTextColor={theme.placeholder}
                  />
                </Field>
              </>
            ) : null}

            {step === 'confirmacao' ? (
              <>
                <Text style={styles.hint}>Confira os dados lidos do certificado / Receita.</Text>
                <InfoRow
                  label="Cliente"
                  value={clientLabel}
                  styles={styles}
                />
                <InfoRow
                  label="CNPJ"
                  value={String(
                    certStatus?.documento
                    || certStatus?.cnpj
                    || cnpjData?.cpfCnpj
                    || '—',
                  )}
                  styles={styles}
                />
                <InfoRow
                  label="Razão social"
                  value={String(
                    certStatus?.titular
                    || cnpjData?.razaoSocial
                    || cnpjData?.nomeFantasia
                    || '—',
                  )}
                  styles={styles}
                />
                <InfoRow
                  label="CNAEs encontrados"
                  value={String(cnaes.length)}
                  styles={styles}
                />
              </>
            ) : null}

            {step === 'catalogo' ? (
              <>
                <Text style={styles.hint}>
                  Opcional: marque atividades para rascunho no catálogo. Pode pular e importar depois por planilha.
                </Text>
                <View style={styles.chipRow}>
                  {([
                    { id: 'NFE' as const, label: 'Venda (NF-e)' },
                    { id: 'NFSE' as const, label: 'Serviço (NFS-e)' },
                  ]).map((opt) => {
                    const active = catalogMode === opt.id
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setCatalogMode(opt.id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                {cnaes.length === 0 ? (
                  <Text style={styles.hint}>
                    Nenhum CNAE na confirmação. Pule e cadastre produtos/serviços depois.
                  </Text>
                ) : (
                  cnaes.map((item) => {
                    const checked = selectedCnaes.has(item.codigo)
                    return (
                      <Pressable
                        key={item.codigo}
                        onPress={() => toggleCnae(item.codigo)}
                        style={[styles.cnaeRow, checked && styles.cnaeRowActive]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={checked ? theme.primary : theme.textSecondary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cnaeCode}>
                            {item.codigo}
                            {item.principal ? ' · principal' : ''}
                          </Text>
                          {item.descricao ? (
                            <Text style={styles.cnaeDesc}>{item.descricao}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    )
                  })
                )}
              </>
            ) : null}
            </Animated.View>
          </ScrollView>

          <View style={styles.footer}>
            {step === 'conta' ? (
              <PrimaryButton
                label={busy ? 'Criando…' : (createdUserId ? 'Continuar' : 'Continuar')}
                onPress={() => void submitConta()}
                disabled={busy}
                styles={styles}
              />
            ) : null}
            {step === 'certificado' ? (
              <View style={{ gap: 10 }}>
                <View style={styles.footerRow}>
                  <SecondaryButton
                    label="Voltar"
                    onPress={goBackStep}
                    disabled={busy}
                    styles={styles}
                  />
                  <PrimaryButton
                    label={busy ? 'Enviando…' : 'Importar e continuar'}
                    onPress={() => void submitCertificado()}
                    disabled={busy}
                    styles={styles}
                  />
                </View>
                <Pressable
                  onPress={() => { if (!busy) { setError(''); setStep('confirmacao') } }}
                  disabled={busy}
                  accessibilityRole="button"
                  style={{ alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
                    Pular certificado
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {step === 'confirmacao' ? (
              <View style={styles.footerRow}>
                <SecondaryButton
                  label="Voltar"
                  onPress={goBackStep}
                  disabled={busy}
                  styles={styles}
                />
                <PrimaryButton
                  label="Continuar para catálogo"
                  onPress={goCatalogo}
                  disabled={busy}
                  styles={styles}
                />
              </View>
            ) : null}
            {step === 'catalogo' ? (
              <View style={styles.footerRow}>
                <SecondaryButton
                  label="Voltar"
                  onPress={goBackStep}
                  disabled={busy}
                  styles={styles}
                />
                <PrimaryButton
                  label={busy ? 'Salvando…' : 'Concluir'}
                  onPress={() => void importCatalogSelection()}
                  disabled={busy}
                  styles={styles}
                />
              </View>
            ) : null}
            {step === 'catalogo' ? (
              <Pressable
                onPress={() => { if (!busy) handleFinish() }}
                disabled={busy}
                accessibilityRole="button"
                style={{ alignItems: 'center', paddingTop: 10 }}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  Pular catálogo e concluir
                </Text>
              </Pressable>
            ) : null}
            {busy ? (
              <ActivityIndicator style={{ marginTop: 10 }} color={theme.primary} />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

function Field ({
  label,
  required,
  children,
  styles,
  theme,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  styles: ReturnType<typeof createStyles>
  theme: { text: string; error: string }
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: theme.error }}> *</Text> : null}
      </Text>
      {children}
    </View>
  )
}

function InfoRow ({
  label,
  value,
  styles,
}: {
  label: string
  value: string
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function PrimaryButton ({
  label,
  onPress,
  disabled,
  styles,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryBtn, disabled && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  )
}

function SecondaryButton ({
  label,
  onPress,
  disabled,
  styles,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryBtn, disabled && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  )
}

function createStyles (theme: {
  text: string
  textSecondary: string
  primary: string
  error: string
  surface: string
  border: string
  placeholder: string
  background: string
}, isDarkMode: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(2, 8, 23, 0.88)' : 'rgba(15, 23, 42, 0.62)',
      justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
      alignItems: 'center',
      padding: Platform.OS === 'web' ? 24 : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: 560,
      maxHeight: Platform.OS === 'web' ? '90%' : '94%',
      backgroundColor: isDarkMode ? '#0B1220' : (theme.surface || theme.background),
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderRadius: Platform.OS === 'web' ? 20 : undefined,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : theme.border,
      ...Platform.select({
        web: {
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        } as object,
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 16,
        },
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 10,
      backgroundColor: isDarkMode ? '#0B1220' : (theme.surface || theme.background),
    },
    eyebrow: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '600',
      letterSpacing: 0.3,
      marginBottom: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.3,
    },
    iconBtn: {
      padding: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : theme.border,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    },
    stepper: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingBottom: 12,
      gap: 0,
      backgroundColor: isDarkMode ? '#0B1220' : (theme.surface || theme.background),
    },
    stepItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      position: 'relative',
    },
    stepConnector: {
      position: 'absolute',
      left: '-50%',
      right: '50%',
      top: 13,
      height: 2,
      marginHorizontal: 18,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      zIndex: 0,
    },
    stepConnectorActive: {
      backgroundColor: theme.primary,
      opacity: 0.55,
    },
    stepDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.18)' : theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(15,23,42,0.9)' : theme.surface,
      zIndex: 1,
    },
    stepDotActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
      ...Platform.select({
        web: { boxShadow: `0 0 0 4px ${isDarkMode ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.2)'}` } as object,
        default: {},
      }),
    },
    stepDotDone: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    stepDotText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    stepCaption: {
      fontSize: 10,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    stepCaptionActive: {
      color: theme.primary,
      fontWeight: '700',
    },
    body: {
      paddingHorizontal: 18,
      flexGrow: 1,
      maxHeight: Platform.OS === 'web' ? 420 : undefined,
      backgroundColor: isDarkMode ? '#0B1220' : (theme.surface || theme.background),
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.border,
      backgroundColor: isDarkMode ? '#0B1220' : (theme.surface || theme.background),
    },
    callout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(34,197,94,0.28)' : 'rgba(34,197,94,0.22)',
      backgroundColor: isDarkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.07)',
    },
    hint: {
      flex: 1,
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 19,
    },
    hintEm: {
      color: theme.text,
      fontWeight: '700',
    },
    field: {
      marginBottom: 12,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: theme.text,
      fontSize: 15,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
    },
    emphasisBox: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.primary,
      backgroundColor: isDarkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
      marginBottom: 14,
    },
    emphasisText: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    fileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : theme.border,
      borderStyle: 'dashed',
      marginBottom: 12,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    },
    fileBtnText: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    infoRow: {
      marginBottom: 10,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    infoLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '600',
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    chip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
    },
    chipActive: {
      borderColor: theme.primary,
      backgroundColor: isDarkMode ? 'rgba(34,197,94,0.14)' : 'rgba(34,197,94,0.1)',
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    chipTextActive: {
      color: theme.primary,
    },
    cnaeRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
    },
    cnaeRowActive: {
      borderColor: theme.primary,
      backgroundColor: isDarkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)',
    },
    cnaeCode: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    cnaeDesc: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    errorBox: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
      marginBottom: 12,
    },
    errorText: {
      color: theme.error,
      fontSize: 13,
    },
    footerRow: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 13,
      borderRadius: 14,
      alignItems: 'center',
      ...Platform.select({
        web: { boxShadow: '0 8px 24px rgba(34,197,94,0.28)' } as object,
        default: {
          shadowColor: theme.primary,
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
      }),
    },
    primaryBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : theme.border,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
    },
    secondaryBtnText: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
    },
  })
}

export default ProvisionClientWizardModal
