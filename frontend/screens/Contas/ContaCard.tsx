import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfTechKpiCard } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { formatCurrencyBR } from '../../lib/numberFormat';
import { CONTA_TIPO_LABELS, type ContaFinanceira } from '../../lib/contaFinanceiraTypes';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { BankIcon } from '../../components/contas/BankIcon';

type Props = {
  conta: ContaFinanceira;
  saldo: number;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Carteira/conta padrão do Meu Financeiro (primeira na lista). */
  isDefault?: boolean;
  /** Quando true, divide espaço igualmente no grid (flex). */
  equalFlex?: boolean;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

export function ContaCard({
  conta,
  saldo,
  onPress,
  onEdit,
  onDelete,
  isDefault = false,
  equalFlex = false,
}: Props) {
  const { theme } = useMfTheme();
  const accent = conta.cor || theme.primary;
  const isCartao = conta.tipo === 'cartao_credito';
  const styles = useMemo(() => createStyles(theme, accent, equalFlex), [theme, accent, equalFlex]);

  return (
    <View style={styles.shell}>
      <MfTechKpiCard level="metric" style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
            <BankIcon
              instituicaoId={conta.instituicao_id}
              nome={conta.nome}
              cor={accent}
              size={36}
            />
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={onEdit}
              style={styles.actionBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Editar conta"
            >
              <Ionicons name="pencil-outline" size={17} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDelete}
              style={styles.actionBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Excluir conta"
            >
              <Ionicons name="trash-outline" size={17} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.cardBody, pressed && styles.cardBodyPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${conta.nome}, saldo ${formatCurrencyBR(saldo)}`}
        >
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {conta.nome}
            </Text>
            {isDefault ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Padrão</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardTipo}>{CONTA_TIPO_LABELS[conta.tipo]}</Text>

          <Text
            style={[
              styles.cardSaldo,
              { color: saldo >= 0 ? theme.financeReceived : theme.financeOverdue },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {formatCurrencyBR(saldo)}
          </Text>

          {isCartao && conta.limite_credito != null ? (
            <Text style={styles.cardMeta}>
              Limite {formatCurrencyBR(conta.limite_credito)}
            </Text>
          ) : null}
        </Pressable>
      </MfTechKpiCard>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  accent: string,
  equalFlex: boolean,
) {
  const isNative = Platform.OS !== 'web';

  return StyleSheet.create({
    shell: {
      flexGrow: equalFlex ? 1 : 0,
      flexShrink: equalFlex ? 1 : 0,
      flexBasis: equalFlex ? 0 : '100%',
      minWidth: equalFlex ? 200 : undefined,
      maxWidth: equalFlex ? undefined : '100%',
      width: equalFlex ? undefined : '100%',
      alignSelf: 'stretch',
      overflow: 'visible',
      marginVertical: 2,
    },
    card: {
      flex: equalFlex ? 1 : 0,
      flexGrow: equalFlex ? 1 : 0,
      alignSelf: 'stretch',
      borderLeftWidth: 3,
      borderLeftColor: accent,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: mfSpacing.sm,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardActions: {
      flexDirection: 'row',
      gap: 4,
    },
    actionBtn: {
      padding: isNative ? 8 : 6,
      borderRadius: mfRadius.sm,
      ...(Platform.OS === 'web'
        ? ({
            // @ts-expect-error web-only
            cursor: 'pointer',
          } as object)
        : {}),
    },
    cardBody: {
      flexGrow: 1,
    },
    cardBodyPressed: {
      opacity: 0.88,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.xs,
      minWidth: 0,
    },
    cardName: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    defaultBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: mfRadius.pill,
      backgroundColor: `${accent}22`,
      borderWidth: 1,
      borderColor: `${accent}44`,
    },
    defaultBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: accent,
    },
    cardTipo: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    cardSaldo: {
      fontSize: isNative ? 22 : 24,
      fontWeight: '800',
      marginTop: mfSpacing.sm,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.8,
    },
    cardMeta: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 4,
    },
  });
}
