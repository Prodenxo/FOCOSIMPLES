import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../../lib/theme';
import type { ManagedUser } from '../../lib/user-management';

interface Props {
  users: ManagedUser[];
  selectedUserId: string;
  onSelect: (userId: string) => void;
  theme: Theme;
}

const getInitial = (user: ManagedUser): string => {
  const source = user.displayName || user.email || '?';
  return source.charAt(0).toUpperCase();
};

const getDisplay = (user: ManagedUser): string =>
  user.displayName || user.email || user.id;

const avatarColor = (id: string): string => {
  const palette = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
};

export function UserPicker({ users, selectedUserId, onSelect, theme }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const styles = useMemo(() => createStyles(theme), [theme]);

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = `${u.displayName || ''} ${u.email || ''} ${u.empresaName || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Selecionar usuário"
      >
        <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedUser ? getDisplay(selectedUser) : 'Selecione um usuário'}
        </Text>
        <Text style={styles.triggerCount}>{users.length}</Text>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar usuário</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                hitSlop={10}
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome, e-mail ou empresa…"
                placeholderTextColor={theme.placeholder}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filteredUsers.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
              ) : (
                filteredUsers.map((item) => {
                  const isActive = item.id === selectedUserId;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.userRow, isActive && styles.userRowActive]}
                      onPress={() => handleSelect(item.id)}
                    >
                      <View style={[styles.avatar, { backgroundColor: avatarColor(item.id) }]}>
                        <Text style={styles.avatarText}>{getInitial(item)}</Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName} numberOfLines={1}>
                          {item.displayName || item.email || item.id}
                        </Text>
                        <Text style={styles.userMeta} numberOfLines={1}>
                          {item.email ? item.email : ''}
                          {item.empresaName ? ` · ${item.empresaName}` : ''}
                        </Text>
                      </View>
                      {isActive ? (
                        <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export { getInitial, getDisplay, avatarColor };

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minHeight: 44,
    },
    triggerText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      fontWeight: '500',
    },
    triggerCount: {
      fontSize: 12,
      color: theme.textSecondary,
      backgroundColor: theme.background,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '80%',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    searchWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      padding: 0,
    },
    list: {
      maxHeight: 480,
    },
    emptyText: {
      padding: 24,
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: 14,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    userRowActive: {
      backgroundColor: theme.primaryLight,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    userInfo: {
      flex: 1,
      minWidth: 0,
    },
    userName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    userMeta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
  });
