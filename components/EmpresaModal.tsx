import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { getTheme } from '../lib/theme';
import {
  createEmpresa,
  lookupEmpresaCnpj,
  updateEmpresa,
  type EmpresaFullData,
} from '../services/empresaService';
import { Ionicons } from '@expo/vector-icons';

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'];

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const normalizeCnpjInput = (value: string) => onlyDigits(value).slice(0, 14);
const formatCnpj = (value: string) => {
  const digits = normalizeCnpjInput(value);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};


export type EmpresaData = EmpresaFullData;

interface EmpresaModalProps {
  visible: boolean;
  initial?: EmpresaFullData | null;
  onClose: () => void;
  onSuccess: (empresa: EmpresaFullData) => void;
}

export default function EmpresaModal({ visible, initial, onClose, onSuccess }: EmpresaModalProps) {
  const { isDarkMode } = useThemeStore();
  const theme = getTheme(isDarkMode);
  const styles = createStyles(theme);

  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<EmpresaFullData>({});
  const [errors, setErrors] = useState<Partial<Record<keyof EmpresaFullData, string>>>({});
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  /** Estado separado para a chave MEI — não depende do valor numérico do input. */
  const [meiEnabled, setMeiEnabled] = useState(false);
  const [meiSlotsText, setMeiSlotsText] = useState('1');

  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) return;
    wasVisibleRef.current = true;

    const base = initial || {};
    const maxMeiStored =
      base.max_mei === null || base.max_mei === undefined ? 0 : Number(base.max_mei) || 0;
    const isMeiOn = maxMeiStored > 0;

    setForm({
      ...base,
      max_mei: maxMeiStored,
    });
    setMeiEnabled(isMeiOn);
    setMeiSlotsText(isMeiOn ? String(Math.trunc(maxMeiStored)) : '1');
    setErrors({});
    setCnpjError('');
    setSubmitError('');
  }, [visible, initial]);

  const setField = (field: keyof EmpresaFullData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const setNumField = (field: keyof EmpresaFullData, value: number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const meiSlots = (() => {
    if (!meiEnabled) return 0;
    const n = parseInt(meiSlotsText, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  })();

  const toggleMeiModule = () => {
    if (meiEnabled) {
      setMeiEnabled(false);
      setNumField('max_mei', 0);
    } else {
      setMeiEnabled(true);
      const current = parseInt(meiSlotsText, 10);
      const val = Number.isFinite(current) && current >= 1 ? current : 1;
      setMeiSlotsText(String(val));
      setNumField('max_mei', val);
    }
  };

  // Clientes PF/Outros: null = ilimitado (padrão); número > 0 = limite explícito.
  const naoMeiUnlimited =
    form.max_usuarios_nao_mei === null
    || form.max_usuarios_nao_mei === undefined
    || form.max_usuarios_nao_mei === 0;
  const toggleNaoMeiUnlimited = () => {
    if (naoMeiUnlimited) {
      setNumField('max_usuarios_nao_mei', 1);
    } else {
      setNumField('max_usuarios_nao_mei', null);
    }
  };

  const handleCnpjBlur = async () => {
    const digits = onlyDigits(form.cnpj || '');
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    setCnpjError('');
    try {
      const data = await lookupEmpresaCnpj(digits);
      const telefoneStr = data.telefone
        ? `${data.telefone.ddd || ''}${data.telefone.numero || ''}`
        : '';
      setForm((prev) => ({
        ...prev,
        empresa: data.razaoSocial || prev.empresa || '',
        razao_social: data.razaoSocial || prev.razao_social || '',
        inscricao_estadual: data.inscricaoEstadual || prev.inscricao_estadual || '',
        logradouro: data.endereco?.logradouro || prev.logradouro || '',
        numero: data.endereco?.numero || prev.numero || '',
        complemento: data.endereco?.complemento || prev.complemento || '',
        bairro: data.endereco?.bairro || prev.bairro || '',
        cidade: data.endereco?.descricaoCidade || prev.cidade || '',
        estado: data.endereco?.estado || prev.estado || '',
        cep: data.endereco?.cep || prev.cep || '',
        telefone: telefoneStr || prev.telefone || '',
        email: data.email || prev.email || '',
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar CNPJ.';
      setCnpjError(msg);
    } finally {
      setCnpjLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof EmpresaFullData, string>> = {};
    const cnpjDigits = onlyDigits(form.cnpj || '');
    if (cnpjDigits && cnpjDigits.length !== 14) {
      newErrors.cnpj = 'CNPJ deve ter 14 dígitos ou fique em branco';
    }
    if (meiEnabled) {
      const n = parseInt(meiSlotsText, 10);
      if (!Number.isFinite(n) || n < 1) {
        setSubmitError('Informe ao menos 1 vaga MEI (módulo não pode ficar zerado).');
        return false;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload: EmpresaFullData = {
        ...form,
        cnpj: onlyDigits(form.cnpj || '') || undefined,
        max_mei: meiSlots,
      };
      let result: EmpresaFullData;
      if (isEdit && initial?.id) {
        result = await updateEmpresa(initial.id, payload);
      } else {
        result = await createEmpresa(payload);
      }
      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar empresa');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'Editar Empresa' : 'Cadastrar Empresa'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            <View style={Platform.OS === 'web' ? styles.webColumns : undefined}>

              {/* Coluna esquerda — identificação */}
              <View style={Platform.OS === 'web' ? styles.webCol : undefined}>
                <Text style={styles.sectionLabel}>Identificação</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>CNPJ (opcional)</Text>
                  {cnpjLoading ? <ActivityIndicator size="small" color={theme.primary} /> : null}
                  <TextInput
                    style={[styles.input, errors.cnpj ? styles.inputError : null]}
                    value={form.cnpj || ''}
                    onChangeText={(t) => setField('cnpj', formatCnpj(t))}
                    onBlur={handleCnpjBlur}
                    placeholder="00.000.000/0001-00"
                    placeholderTextColor={theme.placeholder}
                    maxLength={18}
                  />
                  {errors.cnpj ? <Text style={styles.errorText}>{errors.cnpj}</Text> : null}
                  {cnpjError ? <Text style={styles.warnText}>{cnpjError}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Nome da Empresa</Text>
                  <TextInput
                    style={styles.input}
                    value={form.nome_fantasia || ''}
                    onChangeText={(t) => setField('nome_fantasia', t)}
                    placeholder="Como chamamos essa empresa no sistema"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Razão Social</Text>
                  <TextInput
                    style={styles.input}
                    value={form.empresa || ''}
                    onChangeText={(t) => setField('empresa', t)}
                    placeholder="Razão Social"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Inscrição Estadual</Text>
                  <TextInput
                    style={styles.input}
                    value={form.inscricao_estadual || ''}
                    onChangeText={(t) => setField('inscricao_estadual', t)}
                    placeholder="Inscrição Estadual"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Regime Tributário</Text>
                  <View style={styles.regimeRow}>
                    {REGIMES.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.regimeChip, form.regime_tributario === r && styles.regimeChipActive]}
                        onPress={() => setField('regime_tributario', r)}
                      >
                        <Text style={[styles.regimeChipText, form.regime_tributario === r && styles.regimeChipTextActive]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {Platform.OS === 'web' ? <View style={styles.webDivider} /> : null}

              {/* Coluna direita — endereço + contato */}
              <View style={Platform.OS === 'web' ? styles.webCol : undefined}>
                <Text style={styles.sectionLabel}>Endereço</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Logradouro</Text>
                  <TextInput
                    style={styles.input}
                    value={form.logradouro || ''}
                    onChangeText={(t) => setField('logradouro', t)}
                    placeholder="Rua, Avenida..."
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Número</Text>
                    <TextInput
                      style={styles.input}
                      value={form.numero || ''}
                      onChangeText={(t) => setField('numero', t)}
                      placeholder="Número"
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Complemento</Text>
                    <TextInput
                      style={styles.input}
                      value={form.complemento || ''}
                      onChangeText={(t) => setField('complemento', t)}
                      placeholder="Apto, Sala..."
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Bairro</Text>
                  <TextInput
                    style={styles.input}
                    value={form.bairro || ''}
                    onChangeText={(t) => setField('bairro', t)}
                    placeholder="Bairro"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
                <View style={styles.row}>
                  <View style={[styles.field, { flex: 2 }]}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      style={styles.input}
                      value={form.cidade || ''}
                      onChangeText={(t) => setField('cidade', t)}
                      placeholder="Cidade"
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>UF</Text>
                    <TextInput
                      style={styles.input}
                      value={form.estado || ''}
                      onChangeText={(t) => setField('estado', t.toUpperCase().slice(0, 2))}
                      placeholder="UF"
                      placeholderTextColor={theme.placeholder}
                      maxLength={2}
                    />
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>CEP</Text>
                  <TextInput
                    style={styles.input}
                    value={form.cep || ''}
                    onChangeText={(t) => setField('cep', t.replace(/\D/g, '').slice(0, 8))}
                    placeholder="00000000"
                    placeholderTextColor={theme.placeholder}
                    maxLength={8}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.sectionDivider} />
                <Text style={styles.sectionLabel}>Contato</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Telefone</Text>
                  <TextInput
                    style={styles.input}
                    value={form.telefone || ''}
                    onChangeText={(t) => setField('telefone', t)}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={styles.input}
                    value={form.email || ''}
                    onChangeText={(t) => setField('email', t)}
                    placeholder="contato@empresa.com"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="email-address"
                  />
                </View>
              </View>

            </View>

            <Text style={styles.sectionLabel}>Limites de usuários</Text>
            <View style={[styles.field, styles.limitsBox]}>
              <View style={styles.limitsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Módulo MEI</Text>
                  <Text style={styles.helpText}>
                    {meiEnabled
                      ? 'Defina quantas vagas MEI (CNPJ) esta empresa pode ter.'
                      : 'Desativado — esta empresa não pode ter clientes MEI.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, meiEnabled && styles.toggleOn]}
                  onPress={toggleMeiModule}
                  accessibilityLabel={meiEnabled ? 'Desativar módulo MEI' : 'Ativar módulo MEI'}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: meiEnabled }}
                >
                  <View style={[styles.toggleKnob, meiEnabled && styles.toggleKnobOn]} />
                </TouchableOpacity>
              </View>
              {meiEnabled ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.label}>Quantidade de vagas MEI</Text>
                  <TextInput
                    style={styles.input}
                    value={meiSlotsText}
                    onChangeText={(t) => {
                      const digits = t.replace(/\D/g, '').slice(0, 4);
                      setMeiSlotsText(digits);
                      if (!digits) return;
                      const n = Math.min(9999, Math.max(1, parseInt(digits, 10)));
                      if (Number.isFinite(n)) setNumField('max_mei', n);
                    }}
                    onBlur={() => {
                      if (!meiSlotsText || parseInt(meiSlotsText, 10) < 1) {
                        setMeiSlotsText('1');
                        setNumField('max_mei', 1);
                      }
                    }}
                    placeholder="Ex.: 1, 3, 10"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="number-pad"
                    accessibilityLabel="Quantidade de vagas MEI"
                  />
                </View>
              ) : null}
            </View>
            <View style={[styles.field, styles.limitsBox]}>
              <View style={styles.limitsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Acesso ilimitado ao APP</Text>
                  <Text style={styles.helpText}>
                    {naoMeiUnlimited
                      ? 'Esta empresa pode ter clientes ilimitados vinculados.'
                      : 'Define um limite máximo de clientes.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, naoMeiUnlimited && styles.toggleOn]}
                  onPress={toggleNaoMeiUnlimited}
                  accessibilityLabel={naoMeiUnlimited ? 'Definir limite' : 'Tornar ilimitado'}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: naoMeiUnlimited }}
                >
                  <View style={[styles.toggleKnob, naoMeiUnlimited && styles.toggleKnobOn]} />
                </TouchableOpacity>
              </View>
              {!naoMeiUnlimited && (
                <View>
                  <Text style={styles.label}>Quantidade máxima de clientes</Text>
                  <TextInput
                    style={styles.input}
                    value={
                      form.max_usuarios_nao_mei === null || form.max_usuarios_nao_mei === undefined
                        ? ''
                        : String(form.max_usuarios_nao_mei)
                    }
                    onChangeText={(t) => {
                      if (t === '') {
                        setNumField('max_usuarios_nao_mei', 1);
                      } else {
                        const n = Number(t.replace(/\D/g, ''));
                        setNumField('max_usuarios_nao_mei', Number.isFinite(n) && n >= 1 ? n : 1);
                      }
                    }}
                    placeholder="Ex.: 10"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnPrimaryText}>{isEdit ? 'Salvar alterações' : 'Cadastrar empresa'}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    box: {
      width: '100%',
      maxWidth: Platform.OS === 'web' ? 780 : 480,
      maxHeight: Platform.OS === 'web' ? '92%' : '90%',
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? { display: 'flex' as const, flexDirection: 'column' as const } : {}),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    closeBtn: {
      padding: 8,
    },
    submitError: {
      backgroundColor: 'rgba(239,68,68,0.15)',
      color: theme.error,
      padding: 12,
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 8,
      fontSize: 14,
    },
    body: {
      ...(Platform.OS === 'web' ? { flex: 1 } : { maxHeight: 400 }),
    },
    bodyContent: {
      padding: 16,
      paddingBottom: 24,
    },
    field: {
      marginBottom: 14,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 6,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      marginTop: 16,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },
    inputError: {
      borderColor: theme.error,
    },
    errorText: {
      fontSize: 12,
      color: theme.error,
      marginTop: 4,
    },
    warnText: {
      fontSize: 12,
      color: '#b45309',
      marginTop: 4,
    },
    regimeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    regimeChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    regimeChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    regimeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    regimeChipTextActive: {
      color: '#FFFFFF',
    },
    webColumns: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'flex-start',
    },
    webCol: {
      flex: 1,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 12,
    },
    webDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: theme.border,
      marginHorizontal: 4,
    },
    actions: {
      marginTop: 20,
      gap: 10,
    },
    btn: {
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    btnPrimary: {
      backgroundColor: theme.primary,
    },
    btnPrimaryText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    btnSecondary: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnSecondaryText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
    limitsBox: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 12,
    },
    limitsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    helpText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    toggle: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleOn: {
      backgroundColor: theme.primary,
    },
    toggleKnob: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#FFFFFF',
    },
    toggleKnobOn: {
      transform: [{ translateX: 20 }],
    },
  });
