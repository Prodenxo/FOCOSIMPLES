import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../../lib/theme';
import type { ManagedUser } from '../../lib/user-management';
import { getInitial, avatarColor } from './UserPicker';

interface Props {
  user: ManagedUser | null;
  meiCnpj?: string | null;
  meiValidityLabel?: string | null;
  certificateLabel?: string;
  theme: Theme;
}

const formatCnpj = (raw: string): string => {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export function UserContextHeader({
  user,
  meiCnpj,
  meiValidityLabel,
  certificateLabel,
  theme,
}: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!user) return null;

  const display = user.displayName || user.email || user.id;
  const meta = [user.email, user.role, user.empresaName].filter(Boolean).join(' · ');
  const meiAvailable = Boolean(meiCnpj);

  return (
    <View style={styles.container}>
      <View style={[styles.avatar, { backgroundColor: avatarColor(user.id) }]}>
        <Text style={styles.avatarText}>{getInitial(user)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {display}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {meiAvailable ? (
          <View style={styles.meiBadge}>
            <Ionicons name="business" size={12} color={theme.primary} />
            <Text style={styles.meiText}>
              MEI · CNPJ {formatCnpj(meiCnpj || '')}
              {certificateLabel ? ` · Certificado: ${certificateLabel}` : ''}
              {meiValidityLabel ? ` · ${meiValidityLabel}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    meta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    meiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.primaryLight,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    meiText: {
      fontSize: 11,
      color: theme.primaryDark,
      fontWeight: '500',
      flexShrink: 1,
    },
  });
