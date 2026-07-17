import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRecorrenciaStore, type Recorrencia, type RecorrenciaInput } from '../store/recorrenciaStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme } from '../lib/theme';
import { formatCurrencyBR, formatCurrencyInput } from '../lib/numberFormat';
import { supabase } from '../lib/supabase';
import { MfScrollView } from '../components/ui/MfScrollView';

interface Categoria {
  id: number;
  nome: string;
  tipo: string;
}

function normalizarTipoParaUI(tipo: string | undefined): 'entrada' | 'saída' {
  if (!tipo) return 'saída';
  const t = String(tipo).toLowerCase().trim();
  if (t === 'entrada') return 'entrada';
  return 'saída';
}

function RecorrenciaFormModal({
  visible,
  onClose,
  recorrencia,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  recorrencia?: Recorrencia | null;
  onSave: (data: RecorrenciaInput & { id?: string }) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createModalStyles(theme), [theme]);
  const { userId } = useAuthStore();

  const [tipo, setTipo] = useState<'entrada' | 'saída'>('saída');
  const [diaMes, setDiaMes] = useState('5');
  const [valor, setValor] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [status, setStatus] = useState('pago');
  const [obs, setObs] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaDropdownVisible, setCategoriaDropdownVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTipo('saída');
      setDiaMes('5');
      setValor('');
      setClassificacao('');
      setStatus('pago');
      setObs('');
      setAtivo(true);
      setCategoriaDropdownVisible(false);
      return;
    }
    if (recorrencia) {
      setTipo(normalizarTipoParaUI(recorrencia.tipo));
      setDiaMes(String(recorrencia.dia_do_mes));
      const v =
        typeof recorrencia.valor === 'number' ? recorrencia.valor : parseFloat(String(recorrencia.valor));
      setValor(
        isNaN(v)
          ? ''
          : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );
      setClassificacao(recorrencia.classificacao);
      setStatus(recorrencia.status || 'pago');
      setObs(recorrencia.obs || '');
      setAtivo(recorrencia.ativo);
    } else {
      setTipo('saída');
      setDiaMes('5');
      setValor('');
      setClassificacao('');
      setStatus('pago');
      setObs('');
      setAtivo(true);
    }
  }, [visible, recorrencia]);

  useEffect(() => {
    if (!visible || !userId) return;
    supabase
      .from('categorias_id')
      .select('id, nome, tipo')
      .eq('user_id', userId)
      .order('nome')
      .then(({ data, error }) => {
        if (!error && data) {
          setCategorias(
            (data || []).map((c: { id: unknown; nome: unknown; tipo: unknown }) => ({
              id: Number(c.id) || 0,
              nome: String(c.nome || ''),
              tipo: String(c.tipo || ''),
            }))
          );
        } else setCategorias([]);
      });
  }, [visible, userId]);

  useEffect(() => {
    if (visible && !recorrencia) {
      setStatus(tipo === 'entrada' ? 'recebido' : 'pago');
    }
  }, [tipo, visible, recorrencia]);

  const categoriasFiltradas = categorias.filter((cat) => {
    const catTipo = cat.tipo === 'saida' ? 'saída' : cat.tipo === 'saída' ? 'saída' : cat.tipo;
    return catTipo === tipo;
  });

  const handleSave = async () => {
    const d = parseInt(diaMes, 10);
    if (isNaN(d) || d < 1 || d > 31) {
      Alert.alert('Erro', 'Informe o dia do mês entre 1 e 31');
      return;
    }
    if (!classificacao.trim()) {
      Alert.alert('Erro', 'Informe a classificação');
      return;
    }
    const cleaned = valor.replace(/[R$\s.]/g, '').replace(',', '.');
    const valorNum = parseFloat(cleaned);
    if (isNaN(valorNum) || valorNum <= 0) {
      Alert.alert('Erro', 'Informe um valor válido');
      return;
    }
    const tipoParaBanco = tipo === 'saída' ? 'saida' : 'entrada';
    const ok = await onSave({
      id: recorrencia?.id,
      dia_do_mes: d,
      valor: valorNum,
      classificacao: classificacao.trim(),
      tipo: tipoParaBanco,
      status,
      obs: obs.trim() || null,
      categoria: classificacao.trim(),
      ativo,
    });
    if (ok) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{recorrencia ? 'Editar recorrência' : 'Nova recorrência'}</Text>
            <View style={styles.iconBtn} />
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Dia do mês (1–31)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={2}
              value={diaMes}
              onChangeText={setDiaMes}
              placeholder="Ex: 5"
              placeholderTextColor={theme.placeholder}
            />

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.chip, tipo === 'entrada' && styles.chipTipoEntradaOn]}
                onPress={() => setTipo('entrada')}
              >
                <Text style={[styles.chipText, tipo === 'entrada' && styles.chipTipoEntradaTextOn]}>Entrada</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, tipo === 'saída' && styles.chipTipoSaidaOn]}
                onPress={() => setTipo('saída')}
              >
                <Text style={[styles.chipText, tipo === 'saída' && styles.chipTipoSaidaTextOn]}>Saída</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Valor</Text>
            <TextInput
              style={styles.input}
              value={valor}
              onChangeText={(t) => setValor(formatCurrencyInput(t))}
              keyboardType="decimal-pad"
              placeholder="R$ 0,00"
              placeholderTextColor={theme.placeholder}
            />

            <Text style={styles.label}>Classificação / categoria</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setCategoriaDropdownVisible(!categoriaDropdownVisible)}
            >
              <Text style={{ color: classificacao ? theme.text : theme.placeholder }}>
                {classificacao || 'Selecione ou digite abaixo'}
              </Text>
            </TouchableOpacity>
            {categoriaDropdownVisible && (
              <View style={styles.dropdown}>
                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                  {categoriasFiltradas.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setClassificacao(cat.nome);
                        setCategoriaDropdownVisible(false);
                      }}
                    >
                      <Text style={{ color: theme.text }}>{cat.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={classificacao}
              onChangeText={setClassificacao}
              placeholder="Descrição (ex: Netflix)"
              placeholderTextColor={theme.placeholder}
            />

            <Text style={styles.label}>Status padrão do lançamento</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  status === (tipo === 'entrada' ? 'recebido' : 'pago') && styles.chipOn,
                ]}
                onPress={() => setStatus(tipo === 'entrada' ? 'recebido' : 'pago')}
              >
                <Text
                  style={[
                    styles.chipText,
                    status === (tipo === 'entrada' ? 'recebido' : 'pago') && styles.chipTextOn,
                  ]}
                >
                  {tipo === 'entrada' ? 'Recebido' : 'Pago'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  status === (tipo === 'entrada' ? 'a_receber' : 'a_pagar') && styles.chipOn,
                ]}
                onPress={() => setStatus(tipo === 'entrada' ? 'a_receber' : 'a_pagar')}
              >
                <Text
                  style={[
                    styles.chipText,
                    status === (tipo === 'entrada' ? 'a_receber' : 'a_pagar') && styles.chipTextOn,
                  ]}
                >
                  {tipo === 'entrada' ? 'A receber' : 'A pagar'}
                </Text>
              </TouchableOpacity>
            </View>

            {recorrencia ? (
              <>
                <Text style={styles.label}>Ativa</Text>
                <TouchableOpacity style={styles.row} onPress={() => setAtivo(!ativo)}>
                  <Ionicons
                    name={ativo ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={theme.primary}
                  />
                  <Text style={{ marginLeft: 8, color: theme.text }}>
                    {ativo ? 'Sim — gera lançamentos' : 'Não — pausada'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={obs}
              onChangeText={setObs}
              placeholder="Opcional"
              placeholderTextColor={theme.placeholder}
              multiline
              maxLength={500}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function RecorrenciasScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { recorrencias, loading, fetchRecorrencias, addRecorrencia, updateRecorrencia, deleteRecorrencia } =
    useRecorrenciaStore();
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createListStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Recorrencia | null>(null);

  useEffect(() => {
    fetchRecorrencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecorrencias();
    setRefreshing(false);
  };

  const handleSave = async (data: RecorrenciaInput & { id?: string }) => {
    const { id, ...rest } = data;
    if (id) {
      await updateRecorrencia(id, rest);
    } else {
      await addRecorrencia(rest);
    }
    const err = useRecorrenciaStore.getState().error;
    if (err) {
      Alert.alert('Recorrências', err);
      return false;
    }
    return true;
  };

  const confirmDelete = (r: Recorrencia) => {
    const proceed = async () => {
      const result = await deleteRecorrencia(r.id);
      if (!result.ok) {
        if (Platform.OS === 'web') {
          window.alert(`Falha ao excluir: ${result.error}`);
        } else {
          Alert.alert('Erro ao excluir', result.error);
        }
        return;
      }
      if (result.mode === 'soft' && Platform.OS !== 'web') {
        Alert.alert(
          'Recorrência pausada',
          'Como já havia lançamentos vinculados, a recorrência foi marcada como inativa. Projeções futuras não serão mais geradas.',
        );
      }
    };

    const message =
      'Os lançamentos já gerados serão mantidos. As projeções futuras serão removidas.';

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Excluir recorrência?\n\n${message}`)) {
        void proceed();
      }
      return;
    }

    Alert.alert('Excluir recorrência', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void proceed();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={onClose} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Recorrências</Text>
        <TouchableOpacity
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          style={styles.addRound}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        No dia escolhido de cada mês, um lançamento será criado em Transações (fuso America/São_Paulo).
      </Text>

      <MfScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading && recorrencias.length === 0 ? (
          <Text style={styles.empty}>Carregando...</Text>
        ) : recorrencias.length === 0 ? (
          <Text style={styles.empty}>Nenhuma recorrência. Toque em + para criar.</Text>
        ) : (
          recorrencias.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  Dia {r.dia_do_mes} · {r.classificacao}
                  {!r.ativo ? ' (pausada)' : ''}
                </Text>
                <Text style={styles.cardMeta}>
                  {normalizarTipoParaUI(r.tipo) === 'entrada' ? 'Entrada' : 'Saída'} ·{' '}
                  {formatCurrencyBR(typeof r.valor === 'number' ? r.valor : parseFloat(String(r.valor)))}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditing(r);
                    setFormOpen(true);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="pencil" size={20} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(r)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </MfScrollView>

      <RecorrenciaFormModal
        visible={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        recorrencia={editing}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const createListStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerIcon: { padding: 4 },
    title: { fontSize: 20, fontWeight: '700', color: theme.text },
    addRound: {
      backgroundColor: theme.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      padding: 16,
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    empty: { textAlign: 'center', marginTop: 32, color: theme.textSecondary, paddingHorizontal: 24 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 14,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    cardMeta: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    cardActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  });

const createModalStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    modalContainer: { flex: 1, backgroundColor: theme.background },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    body: { flex: 1, padding: 16 },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 12, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    chipOn: { borderColor: theme.primary, backgroundColor: theme.primaryLight },
    chipTipoEntradaOn: { borderColor: theme.success, backgroundColor: theme.successLight },
    chipTipoSaidaOn: { borderColor: theme.error, backgroundColor: theme.errorLight },
    chipText: { color: theme.textSecondary, fontWeight: '600' },
    chipTextOn: { color: theme.primaryDark },
    chipTipoEntradaTextOn: { color: theme.success, fontWeight: '700' },
    chipTipoSaidaTextOn: { color: theme.error, fontWeight: '700' },
    dropdown: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      backgroundColor: theme.card,
      marginTop: 4,
    },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    saveBtn: {
      marginTop: 24,
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
