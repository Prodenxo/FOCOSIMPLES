import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MfScrollView } from '../components/ui/MfScrollView';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfSpacing, type Theme } from '../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../lib/techDesign';
import { cleanPhone, hasRole } from '../lib/auth-roles';
import { getMeiUserStatusShort, getMeiUserTypeLabel, isMeiSlotUser } from '../lib/meiUserSlot';
import { filterFocoMeiAdminEmpresas, filterFocoMeiAdminUsers, listEmpresaMembersForMeiAdmin } from '../lib/focomeiAdminFilters';
import { resolveAppOrigin } from '../lib/appOrigin';
import { isFocoMeiProductLine, productLineLabel, resolveEmpresaProductLine, resolveUserProductLine } from '../lib/productLine';
import { getManagedUserActions } from '../lib/managedUserActions';
import { formatPhoneBrCell } from '../lib/numberFormat';
import {
  banUser,
  createUser,
  deleteUser,
  formatManageUserError,
  listUsers,
  resetUserPassword,
  unbanUser,
  updateUser,
  type ManagedUser,
} from '../lib/user-management';
import { matchManagedUserSearch } from '../lib/matchManagedUserSearch';
import {
  deleteEmpresa,
  getEmpresaById,
  listEmpresas,
  type EmpresaFullData,
  type EmpresaOption,
} from '../services/empresaService';
import EmpresaModal from '../components/EmpresaModal';
import { EmpresaStripeMeiBillingModal } from '../components/EmpresaStripeMeiBillingModal';
import { InvitesTab } from '../components/admin/InvitesTab';
import { ManageUsersPageChrome } from '../components/admin/ManageUsersPageChrome';
import {
  fetchAdminMeiCertificateStatus,
  patchAdminMeiDocumentosAtivos,
} from '../services/adminUserDataService';

type RoleOption = 'admin' | 'usuario' | 'outsider';
type TabKey = 'users' | 'invites' | 'empresas';
type EmpresaMeiFilter = 'all' | 'active' | 'inactive';
type ClipboardModule = typeof import('expo-clipboard');

interface Props {
  onBack: () => void;
  /** Após impersonar com sucesso (ex.: voltar ao app como o usuário alvo). */
  onImpersonateSuccess?: () => void;
}

type Styles = ReturnType<typeof createStyles>;

// =======================================================================
// Helpers
// =======================================================================

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  usuario: 'Usuário',
  outsider: 'Convidado',
};

const ROLE_DESCRIPTION: Record<RoleOption, string> = {
  admin: 'Acesso total ao painel administrativo da empresa.',
  usuario: 'Acesso padrão ao Foco Simples.',
  outsider: 'Acesso temporário ou externo, com escopo restrito.',
};

function getRoleTone(role: string, theme: Theme): { bg: string; fg: string } {
  switch (role) {
    case 'superadmin':
      return { bg: theme.errorLight, fg: theme.error };
    case 'admin':
      return { bg: theme.primaryLight, fg: theme.primary };
    case 'outsider':
      return { bg: '#FEF3C7', fg: theme.warning };
    case 'usuario':
    default:
      return { bg: theme.successLight, fg: theme.success };
  }
}

function getInitials(name: string, email: string): string {
  const base = (name || '').trim() || (email || '').trim();
  if (!base) return '?';
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return base.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarColor(seed: string, theme: Theme): string {
  const palette = [
    theme.primary,
    theme.success,
    theme.warning,
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function formatExpiration(isoDate: string): { label: string; expired: boolean } {
  const exp = new Date(isoDate);
  const expired = exp.getTime() <= Date.now();
  const dd = exp.getDate().toString().padStart(2, '0');
  const mm = (exp.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = exp.getFullYear();
  return {
    label: expired ? 'Expirado' : `Expira ${dd}/${mm}/${yyyy}`,
    expired,
  };
}

// =======================================================================
// Sub-components
// =======================================================================

interface BadgeProps {
  label: string;
  bg: string;
  fg: string;
  dot?: boolean;
  styles: Styles;
}

const Badge = React.memo(function Badge({ label, bg, fg, dot, styles }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
  styles: Styles;
  compact?: boolean;
}

const IconButton = React.memo(function IconButton({
  icon,
  label,
  color,
  bg,
  onPress,
  styles,
  compact = false,
}: IconButtonProps) {
  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.iconActionCompact, { backgroundColor: bg }]}
        onPress={onPress}
        accessibilityLabel={label}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={17} color={color} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.iconAction, { backgroundColor: bg }]}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.iconActionLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// =======================================================================
// Skeleton loaders
// =======================================================================

interface SkeletonBoxProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  theme: Theme;
}

function SkeletonBox({ width, height, radius = 6, theme }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const AnimatedView = Animated.View as any;
  return (
    <AnimatedView
      style={{
        width,
        height,
        backgroundColor: theme.border,
        borderRadius: radius,
        opacity,
      }}
    />
  );
}

function UserCardSkeleton({ styles, theme }: { styles: Styles; theme: Theme }) {
  return (
    <View style={styles.userCard}>
      <View style={styles.userCardHeader}>
        <SkeletonBox width={44} height={44} radius={22} theme={theme} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width="60%" height={14} theme={theme} />
          <SkeletonBox width="80%" height={11} theme={theme} />
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          <SkeletonBox width={60} height={18} radius={9} theme={theme} />
          <SkeletonBox width={70} height={18} radius={9} theme={theme} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <SkeletonBox width={90} height={12} theme={theme} />
        <SkeletonBox width={120} height={12} theme={theme} />
        <SkeletonBox width={80} height={12} theme={theme} />
      </View>
    </View>
  );
}

function EmpresaCardSkeleton({ styles, theme }: { styles: Styles; theme: Theme }) {
  return (
    <View style={styles.empresaCard}>
      <View style={styles.empresaCardLeft}>
        <SkeletonBox width={40} height={40} radius={10} theme={theme} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="55%" height={14} theme={theme} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SkeletonBox width={70} height={20} radius={8} theme={theme} />
            <SkeletonBox width={90} height={20} radius={8} theme={theme} />
          </View>
        </View>
      </View>
    </View>
  );
}

function ListSkeleton({
  count,
  variant,
  styles,
  theme,
}: {
  count: number;
  variant: 'user' | 'empresa';
  styles: Styles;
  theme: Theme;
}) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) =>
        variant === 'user' ? (
          <UserCardSkeleton key={i} styles={styles} theme={theme} />
        ) : (
          <EmpresaCardSkeleton key={i} styles={styles} theme={theme} />
        ),
      )}
    </View>
  );
}

interface ManageUsersListBlockProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T) => React.ReactNode;
  styles: Styles;
  ListEmptyComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
}

function ManageUsersListBlock<T>({
  data,
  keyExtractor,
  renderItem,
  styles,
  ListEmptyComponent,
  ListFooterComponent,
}: ManageUsersListBlockProps<T>) {
  if (data.length === 0) {
    return <View style={styles.listBlock}>{ListEmptyComponent}</View>;
  }

  return (
    <View style={styles.listBlock}>
      {data.map((item, index) => (
        <View key={keyExtractor(item, index)} style={styles.listItemShell}>
          {renderItem(item)}
        </View>
      ))}
      {ListFooterComponent}
    </View>
  );
}

interface UserCardProps {
  user: ManagedUser;
  canEdit: boolean;
  canImpersonate: boolean;
  canBan: boolean;
  canDelete: boolean;
  canViewCompanyMembers: boolean;
  isBlocked: boolean;
  isDesktop: boolean;
  lastPassword?: string;
  theme: Theme;
  styles: Styles;
  onEdit: (user: ManagedUser) => void;
  onImpersonate: (user: ManagedUser) => void;
  onViewCompanyMembers: (user: ManagedUser) => void;
  onBan: (user: ManagedUser) => void;
  onUnban: (user: ManagedUser) => void;
  onResetPassword: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
  onCopyPassword: (userId: string) => void;
}

const UserCard = React.memo(function UserCard({
  user,
  canEdit,
  canImpersonate,
  canBan,
  canDelete,
  canViewCompanyMembers,
  isBlocked,
  isDesktop,
  lastPassword,
  theme,
  styles,
  onEdit,
  onImpersonate,
  onViewCompanyMembers,
  onBan,
  onUnban,
  onResetPassword,
  onDelete,
  onCopyPassword,
}: UserCardProps) {
  const displayName = user.displayName || user.email || 'Sem nome';
  const initials = getInitials(user.displayName || '', user.email || '');
  const avatarColor = getAvatarColor(user.id || user.email || displayName || 'x', theme);
  const roleTone = getRoleTone(user.role, theme);
  const expiration = user.role === 'usuario' && user.expiresAt ? formatExpiration(user.expiresAt) : null;
  const metaLine = [
    user.empresaName || user.empresaId || 'Sem empresa',
    getMeiUserStatusShort(user.mei),
    expiration?.label,
  ]
    .filter(Boolean)
    .join(' · ');

  if (isDesktop) {
    return (
      <View style={[styles.userCard, styles.userCardDesktop]}>
        <View style={[styles.avatar, styles.avatarCompact, { backgroundColor: avatarColor + '22', borderColor: avatarColor }]}>
          <Text style={[styles.avatarText, styles.avatarTextCompact, { color: avatarColor }]}>{initials}</Text>
        </View>
        <View style={styles.userCardDesktopMain}>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email}
          </Text>
          <Text style={styles.userMetaInline} numberOfLines={1}>
            {metaLine}
          </Text>
        </View>
        <View style={styles.userCardDesktopBadges}>
          {isBlocked ? (
            <Badge label="Bloqueado" bg={theme.errorLight} fg={theme.error} dot styles={styles} />
          ) : (
            <Badge label="Ativo" bg={theme.successLight} fg={theme.success} dot styles={styles} />
          )}
          <Badge label={ROLE_LABEL[user.role] || user.role} bg={roleTone.bg} fg={roleTone.fg} styles={styles} />
        </View>
        {canEdit || canImpersonate || canViewCompanyMembers ? (
          <View style={styles.userActionsDesktop}>
            {canViewCompanyMembers ? (
              <IconButton
                icon="people-outline"
                label="Equipe"
                color={theme.primary}
                bg={theme.primaryLight}
                onPress={() => onViewCompanyMembers(user)}
                styles={styles}
                compact
              />
            ) : null}
            {canImpersonate ? (
              <IconButton icon="log-in-outline" label="Acessar" color="#B45309" bg="#FEF3C7" onPress={() => onImpersonate(user)} styles={styles} compact />
            ) : null}
            {canEdit ? (
              <>
            <IconButton icon="create-outline" label="Editar" color={theme.primary} bg={theme.primaryLight} onPress={() => onEdit(user)} styles={styles} compact />
            <IconButton icon="key-outline" label="Senha" color={theme.text} bg={theme.background} onPress={() => onResetPassword(user)} styles={styles} compact />
              </>
            ) : null}
            {canBan ? (
              isBlocked ? (
              <IconButton icon="checkmark-circle-outline" label="Liberar" color={theme.success} bg={theme.successLight} onPress={() => onUnban(user)} styles={styles} compact />
            ) : (
              <IconButton icon="ban-outline" label="Bloquear" color={theme.warning} bg="#FEF3C7" onPress={() => onBan(user)} styles={styles} compact />
            )
            ) : null}
            {canDelete ? (
            <IconButton icon="trash-outline" label="Excluir" color={theme.error} bg={theme.errorLight} onPress={() => onDelete(user)} styles={styles} compact />
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.userCard}>
      <View style={styles.userCardHeader}>
        <View style={[styles.avatar, { backgroundColor: avatarColor + '22', borderColor: avatarColor }]}>
          <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
        </View>
        <View style={styles.userCardHeaderInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        <View style={styles.userCardHeaderBadges}>
          {isBlocked ? (
            <Badge
              label="Bloqueado"
              bg={theme.errorLight}
              fg={theme.error}
              dot
              styles={styles}
            />
          ) : (
            <Badge
              label="Ativo"
              bg={theme.successLight}
              fg={theme.success}
              dot
              styles={styles}
            />
          )}
          <Badge label={ROLE_LABEL[user.role] || user.role} bg={roleTone.bg} fg={roleTone.fg} styles={styles} />
          {isFocoMeiProductLine(resolveUserProductLine(user.mei, user.productLine)) ? (
            <Badge label="FocoMEI" bg={theme.primaryLight} fg={theme.primary} styles={styles} />
          ) : null}
        </View>
      </View>

      <View style={styles.userMetaGrid}>
        {user.phone ? (
          <View style={styles.userMetaItem}>
            <Ionicons name="call-outline" size={13} color={theme.textTertiary} />
            <Text style={styles.userMetaText} numberOfLines={1}>
              {user.phone}
            </Text>
          </View>
        ) : null}
        <View style={styles.userMetaItem}>
          <Ionicons name="business-outline" size={13} color={theme.textTertiary} />
          <Text style={styles.userMetaText} numberOfLines={1}>
            {user.empresaName || user.empresaId || 'Sem empresa'}
          </Text>
        </View>
        <View style={styles.userMetaItem}>
          <Ionicons
            name={isMeiSlotUser(user.mei) ? 'checkmark-circle-outline' : 'close-circle-outline'}
            size={13}
            color={isMeiSlotUser(user.mei) ? theme.success : theme.textTertiary}
          />
          <Text style={styles.userMetaText}>{getMeiUserStatusShort(user.mei)}</Text>
        </View>
        {expiration ? (
          <View style={styles.userMetaItem}>
            <Ionicons
              name="time-outline"
              size={13}
              color={expiration.expired ? theme.error : theme.textTertiary}
            />
            <Text
              style={[
                styles.userMetaText,
                expiration.expired && { color: theme.error, fontWeight: '600' },
              ]}
            >
              {expiration.label}
            </Text>
          </View>
        ) : null}
      </View>

      {canEdit || canImpersonate || canViewCompanyMembers ? (
        <View style={styles.userActions}>
          {canViewCompanyMembers ? (
            <IconButton
              icon="people-outline"
              label="Equipe"
              color={theme.primary}
              bg={theme.primaryLight}
              onPress={() => onViewCompanyMembers(user)}
              styles={styles}
              compact
            />
          ) : null}
          {canImpersonate ? (
          <IconButton
            icon="log-in-outline"
            label="Acessar"
            color="#B45309"
            bg="#FEF3C7"
            onPress={() => onImpersonate(user)}
            styles={styles}
            compact
          />
          ) : null}
          {canEdit ? (
            <>
          <IconButton
            icon="create-outline"
            label="Editar"
            color={theme.primary}
            bg={theme.primaryLight}
            onPress={() => onEdit(user)}
            styles={styles}
            compact
          />
          <IconButton
            icon="key-outline"
            label="Senha"
            color={theme.text}
            bg={theme.background}
            onPress={() => onResetPassword(user)}
            styles={styles}
            compact
          />
            </>
          ) : null}
          {canBan ? (
          isBlocked ? (
            <IconButton
              icon="checkmark-circle-outline"
              label="Liberar"
              color={theme.success}
              bg={theme.successLight}
              onPress={() => onUnban(user)}
              styles={styles}
              compact
            />
          ) : (
            <IconButton
              icon="ban-outline"
              label="Bloquear"
              color={theme.warning}
              bg="#FEF3C7"
              onPress={() => onBan(user)}
              styles={styles}
              compact
            />
          )
          ) : null}
          {canDelete ? (
          <IconButton
            icon="trash-outline"
            label="Excluir"
            color={theme.error}
            bg={theme.errorLight}
            onPress={() => onDelete(user)}
            styles={styles}
            compact
          />
          ) : null}
        </View>
      ) : null}

      {lastPassword ? (
        <View style={styles.passwordRow}>
          <View style={styles.passwordChip}>
            <Ionicons name="key" size={14} color={theme.primary} />
            <Text style={styles.passwordLabel} numberOfLines={1}>
              Senha gerada: <Text style={styles.passwordValue}>{lastPassword}</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onCopyPassword(user.id)}
            style={styles.passwordCopyBtn}
            accessibilityLabel="Copiar senha"
          >
            <Ionicons name="copy-outline" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

interface EmpresaCardProps {
  empresa: EmpresaOption;
  theme: Theme;
  styles: Styles;
  onEdit: (empresa: EmpresaOption) => void;
  /** Superadmin: listar todos os usuários vinculados à empresa. */
  onViewMembers?: (empresa: EmpresaOption) => void;
  onOpenBilling?: (empresa: EmpresaOption) => void;
  /** Superadmin: excluir a empresa (irreversível). */
  onDelete?: (empresa: EmpresaOption) => void;
}

const EmpresaCard = React.memo(function EmpresaCard({
  empresa,
  theme,
  styles,
  onEdit,
  onViewMembers,
  onOpenBilling,
  onDelete,
}: EmpresaCardProps) {
  const renderNaoMeiLimit = (value?: number | null) =>
    value === null || value === undefined || value === 0 ? 'Sem limite' : String(value);

  const renderMeiEmpresaCap = (value?: number | null) => {
    const lim =
      value === null || value === undefined ? 0 : Number(value) || 0;
    if (lim > 0) return String(lim);
    return 'Desligado';
  };

  return (
    <View style={styles.empresaCard}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.empresaCardMain}
        onPress={() => onEdit(empresa)}
        accessibilityLabel={`Editar empresa ${empresa.empresa}`}
      >
        <View style={styles.empresaCardLeft}>
          <View style={[styles.empresaIcon, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="business" size={18} color={theme.primary} />
          </View>
          <View style={styles.empresaInfo}>
            <Text style={styles.empresaName} numberOfLines={1}>
              {empresa.nome_fantasia || empresa.empresa}
            </Text>
            {isFocoMeiProductLine(resolveEmpresaProductLine(empresa.max_mei, empresa.product_line)) ? (
              <Text style={[styles.empresaProductTag, { color: theme.primary }]}>
                {productLineLabel(resolveEmpresaProductLine(empresa.max_mei, empresa.product_line))}
              </Text>
            ) : null}
            <View style={styles.empresaLimitsRow}>
              <View style={styles.empresaLimitChip}>
                <Text style={styles.empresaLimitChipLabel}>MEI</Text>
                <Text style={styles.empresaLimitChipValue}>{renderMeiEmpresaCap(empresa.max_mei)}</Text>
              </View>
              <View style={styles.empresaLimitChip}>
                <Text style={styles.empresaLimitChipLabel}>Não MEI</Text>
                <Text style={styles.empresaLimitChipValue}>
                  {renderNaoMeiLimit(empresa.max_usuarios_nao_mei)}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
      </TouchableOpacity>
      {onViewMembers ? (
        <TouchableOpacity
          style={[styles.empresaCardActionBtn, { backgroundColor: theme.backgroundMuted }]}
          onPress={() => onViewMembers(empresa)}
          accessibilityLabel={`Ver usuários de ${empresa.empresa}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="people-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      ) : null}
      {onDelete ? (
        <TouchableOpacity
          style={[styles.empresaCardActionBtn, { backgroundColor: theme.errorLight }]}
          onPress={() => onDelete(empresa)}
          accessibilityLabel={`Excluir empresa ${empresa.empresa}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.error} />
        </TouchableOpacity>
      ) : null}
      {onOpenBilling ? (
        <TouchableOpacity
          style={[styles.empresaCardActionBtn, { backgroundColor: theme.primaryLight }]}
          onPress={() => onOpenBilling(empresa)}
          accessibilityLabel={`Cobrança Stripe, ${empresa.empresa}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="card-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

// =======================================================================
// Side Panel (drawer no desktop / modal no mobile)
// =======================================================================

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isDesktop: boolean;
  theme: Theme;
  styles: Styles;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  icon,
  isDesktop,
  theme,
  styles,
  children,
  footer,
}: SidePanelProps) {
  return (
    <Modal
      visible={open}
      animationType={isDesktop ? 'fade' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.panelOverlay}>
        <Pressable style={styles.panelBackdrop} onPress={onClose} />
        <View style={[styles.panel, isDesktop ? styles.panelDesktop : styles.panelMobile]}>
          <View style={styles.panelHeader}>
            {icon ? (
              <View style={[styles.panelHeaderIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name={icon} size={20} color={theme.primary} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.panelSubtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.panelCloseBtn}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
          <MfScrollView
            style={styles.panelBody}
            contentContainerStyle={styles.panelBodyContent}
            keyboardShouldPersistTaps="handled"
            hideLegalFooter
          >
            {children}
          </MfScrollView>
          {footer ? <View style={styles.panelFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
  styles: Styles;
}

function Field({ label, required, helper, children, styles }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.fieldRequired}> *</Text> : null}
      </Text>
      {children}
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

// =======================================================================
// Main screen
// =======================================================================

export default function ManageUsersScreen({ onBack, onImpersonateSuccess }: Props) {
  const { role, sessionRestored, impersonate, userId: currentUserId, refreshAccessContext } = useAuthStore();
  const canManage = hasRole(role, ['admin']);
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const { width: winWidth } = useWindowDimensions();
  const isDesktop = winWidth >= 900;
  const styles = useMemo(() => createStyles(theme, isDesktop, isDarkMode), [theme, isDesktop, isDarkMode]);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialUsersLoading, setInitialUsersLoading] = useState(true);
  const [initialEmpresasLoading, setInitialEmpresasLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastPasswords, setLastPasswords] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>('users');

  // Form: criar usuário
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleOption>('usuario');
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaOption | null>(null);
  const [empresaModalOpen, setEmpresaModalOpen] = useState(false);

  // Form: empresa (create + edit) — usa EmpresaModal completo
  const [empresaFormOpen, setEmpresaFormOpen] = useState(false);
  const [empresaFormInitial, setEmpresaFormInitial] = useState<EmpresaFullData | null>(null);

  // Form: editar usuário
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editRole, setEditRole] = useState<RoleOption>('usuario');
  const [editEmpresa, setEditEmpresa] = useState<EmpresaOption | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOriginalEmail, setEditOriginalEmail] = useState('');
  const [editMei, setEditMei] = useState(false);
  const [editDocNfse, setEditDocNfse] = useState(true);
  const [editDocNfe, setEditDocNfe] = useState(false);
  const [editDocNfce, setEditDocNfce] = useState(false);
  const [editDocsLoading, setEditDocsLoading] = useState(false);
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editEmpresaModalOpen, setEditEmpresaModalOpen] = useState(false);

  // Reset senha
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<ManagedUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Impersonar (Alert.alert com 2 botões não funciona na web)
  const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);
  const [impersonateTarget, setImpersonateTarget] = useState<ManagedUser | null>(null);

  // Excluir (Alert.alert com 2 botões não funciona na web)
  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // Bloquear / desbloquear (Alert.alert com 2 botões não funciona na web)
  const [banUserModalOpen, setBanUserModalOpen] = useState(false);
  const [unbanUserModalOpen, setUnbanUserModalOpen] = useState(false);
  const [userToBan, setUserToBan] = useState<ManagedUser | null>(null);
  const [userToUnban, setUserToUnban] = useState<ManagedUser | null>(null);

  // Excluir empresa (Alert.alert com 2 botões não funciona na web)
  const [deleteEmpresaModalOpen, setDeleteEmpresaModalOpen] = useState(false);
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaOption | null>(null);

  /** Cobrança MEI (Stripe) — superadmin, API do site (`EXPO_PUBLIC_MEI_API_URL`). */
  const [billingEmpresa, setBillingEmpresa] = useState<EmpresaOption | null>(null);
  /** Superadmin: painel com todos os usuários de uma empresa. */
  const [membersEmpresa, setMembersEmpresa] = useState<EmpresaOption | null>(null);

  // Listagem
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [empresaSearch, setEmpresaSearch] = useState('');
  const [empresaTabSearch, setEmpresaTabSearch] = useState('');
  const [empresaMeiFilter, setEmpresaMeiFilter] = useState<EmpresaMeiFilter>('active');
  const [clipboardAvailable, setClipboardAvailable] = useState(true);
  const clipboardRef = useRef<ClipboardModule | null>(null);

  // ----------------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------------

  const fetchUsers = async (search?: string, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await listUsers(search);
      setUsers((prev) => {
        if (!search?.trim()) return data;
        const merged = [...prev];
        data.forEach((newUser) => {
          const index = merged.findIndex((u) => u.id === newUser.id);
          if (index > -1) merged[index] = newUser;
          else merged.push(newUser);
        });
        return merged;
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao listar usuários');
    } finally {
      if (!silent) setLoading(false);
      setInitialUsersLoading(false);
    }
  };

  const fetchEmpresas = async () => {
    if (role !== 'superadmin') {
      setInitialEmpresasLoading(false);
      return;
    }
    try {
      const data = await listEmpresas();
      setEmpresas(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao listar empresas');
    } finally {
      setInitialEmpresasLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      fetchUsers();
      fetchEmpresas();
    }
  }, [canManage, role]);

  useEffect(() => {
    if (!canManage) return;
    const term = searchTerm.trim();
    if (!term) return;
    const timer = setTimeout(() => {
      void fetchUsers(term, users.length > 0);
    }, 350);
    return () => clearTimeout(timer);
  }, [canManage, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, sortDirection]);

  // Auto-dismiss success/error
  useEffect(() => {
    if (!success && !error) return;
    const timer = setTimeout(() => {
      setSuccess('');
      setError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [success, error]);

  // ----------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------

  const parseLimitValue = (value: string, fieldLabel: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
      throw new Error(`${fieldLabel} deve ser um inteiro maior ou igual a 0`);
    }
    return numeric;
  };

  const formatLimitValue = (value?: number | null) =>
    value === null || value === undefined ? '' : String(value);

  // ----------------------------------------------------------------------
  // Empresa actions
  // ----------------------------------------------------------------------

  const openCreateEmpresa = () => {
    setEmpresaFormInitial(null);
    setEmpresaFormOpen(true);
  };

  const openEditEmpresa = async (empresa: EmpresaOption) => {
    setLoading(true);
    setError('');
    try {
      const full = await getEmpresaById(empresa.id);
      setEmpresaFormInitial(
        full ?? {
          id: empresa.id,
          empresa: empresa.empresa,
          max_mei: empresa.max_mei,
          max_usuarios_nao_mei: empresa.max_usuarios_nao_mei,
        },
      );
      setEmpresaFormOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados da empresa');
    } finally {
      setLoading(false);
    }
  };

  const closeEmpresaPanel = () => {
    setEmpresaFormOpen(false);
    setEmpresaFormInitial(null);
  };

  const handleEmpresaSaved = async (saved?: EmpresaFullData) => {
    setEmpresaFormOpen(false);
    setEmpresaFormInitial(null);
    setSuccess('Empresa salva com sucesso.');
    if (saved?.id) {
      setEmpresas((prev) =>
        prev.map((e) =>
          e.id === saved.id
            ? {
                ...e,
                empresa: saved.empresa ?? e.empresa,
                nome_fantasia: saved.nome_fantasia ?? e.nome_fantasia,
                max_mei: saved.max_mei ?? e.max_mei,
                max_usuarios_nao_mei: saved.max_usuarios_nao_mei ?? e.max_usuarios_nao_mei,
              }
            : e,
        ),
      );
    }
    await fetchEmpresas();
  };

  // ----------------------------------------------------------------------
  // User actions
  // ----------------------------------------------------------------------

  const openCreateUser = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setPhone('');
    setSelectedRole('usuario');
    setSelectedEmpresa(null);
    setCreateUserOpen(true);
  };

  const handleCreateUser = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const cleanedPhone = cleanPhone(phone);
      const payload = {
        email,
        password: password || undefined,
        displayName: displayName || undefined,
        phone: cleanedPhone || undefined,
        role: role === 'superadmin' ? selectedRole : 'usuario',
        empresaId: role === 'superadmin' ? selectedEmpresa?.id : undefined,
        mei: false,
      };

      const result = await createUser(payload);
      const message = result?.generatedPassword
        ? `Usuário criado. Senha gerada: ${result.generatedPassword}`
        : 'Usuário criado com sucesso.';
      setSuccess(message);
      if (result?.generatedPassword && result?.userId) {
        setLastPasswords((prev) => ({ ...prev, [result.userId]: result.generatedPassword }));
      }
      setCreateUserOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const focomeiUsers = useMemo(() => {
    // Foco Simples: lista todos. FocoMEI: só vagas MEI.
    if (resolveAppOrigin() === 'focomei') return filterFocoMeiAdminUsers(users);
    return users;
  }, [users]);
  const focomeiEmpresas = useMemo(() => {
    if (resolveAppOrigin() === 'focomei') return filterFocoMeiAdminEmpresas(empresas);
    return empresas;
  }, [empresas]);

  const empresaMembersList = useMemo(() => {
    if (!membersEmpresa) return [];
    return listEmpresaMembersForMeiAdmin(users, membersEmpresa.id, role);
  }, [users, membersEmpresa, role]);

  const empresaMembersMeiCount = useMemo(
    () => empresaMembersList.filter((u) => isMeiSlotUser(u.mei)).length,
    [empresaMembersList],
  );

  const openEmpresaMembers = (empresa: EmpresaOption) => {
    setMembersEmpresa(empresa);
  };

  const resolveEmpresaForUser = (user: ManagedUser): EmpresaOption | null => {
    if (!user.empresaId) return null;
    return (
      focomeiEmpresas.find((item) => item.id === user.empresaId) || {
        id: user.empresaId,
        empresa: user.empresaName || 'Empresa',
      }
    );
  };

  const openCompanyMembersForUser = (user: ManagedUser) => {
    const empresa = resolveEmpresaForUser(user);
    if (!empresa) {
      Alert.alert('Sem empresa', 'Este admin não tem empresa vinculada.');
      return;
    }
    openEmpresaMembers(empresa);
  };

  const loadEditMeiDocumentos = async (userId: string) => {
    setEditDocsLoading(true);
    try {
      const status = await fetchAdminMeiCertificateStatus(userId);
      const docs = status.documentosAtivos;
      if (docs) {
        setEditDocNfse(Boolean(docs.nfse));
        setEditDocNfe(Boolean(docs.nfe));
        setEditDocNfce(Boolean(docs.nfce));
      } else {
        setEditDocNfse(true);
        setEditDocNfe(false);
        setEditDocNfce(false);
      }
    } catch {
      setEditDocNfse(true);
      setEditDocNfe(false);
      setEditDocNfce(false);
    } finally {
      setEditDocsLoading(false);
    }
  };

  const startEditUser = (user: ManagedUser) => {
    setEditingUser(user);
    setEditRole(
      user.role === 'admin' || user.role === 'usuario' || user.role === 'outsider'
        ? user.role
        : 'usuario',
    );
    const empresa =
      focomeiEmpresas.find((item) => item.id === user.empresaId) ||
      (user.empresaId
        ? { id: user.empresaId, empresa: user.empresaName || 'Empresa atual' }
        : null);
    setEditEmpresa(empresa);
    setEditDisplayName(user.displayName || '');
    setEditPhone(user.phone || '');
    setEditEmail(user.email || '');
    setEditOriginalEmail(user.email || '');
    setEditMei(user.mei === true);
    void loadEditMeiDocumentos(user.id);
    if (user.expiresAt) {
      try {
        const d = new Date(user.expiresAt);
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        setEditExpiresAt(isNaN(d.getTime()) ? '' : `${y}-${m}-${day}`);
      } catch {
        setEditExpiresAt('');
      }
    } else {
      setEditExpiresAt('');
    }
  };

  const openMemberForEdit = (user: ManagedUser) => {
    setMembersEmpresa(null);
    startEditUser(user);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const cleanedPhone = cleanPhone(editPhone);
      const trimmedEditEmail = editEmail.trim().toLowerCase();
      const emailChanged =
        !!trimmedEditEmail &&
        trimmedEditEmail !== (editOriginalEmail || '').trim().toLowerCase();
      if (trimmedEditEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEditEmail)) {
        throw new Error('E-mail inválido');
      }
      if (editMei && !editDocNfse && !editDocNfe && !editDocNfce) {
        throw new Error('Com MEI ativo, libere ao menos um tipo de nota (NFS-e, NF-e ou NFC-e).');
      }
      const expiresAtValue =
        editExpiresAt.trim() && editingUser.role === 'usuario'
          ? (() => {
              const d = new Date(editExpiresAt.trim());
              return isNaN(d.getTime()) ? null : d.toISOString();
            })()
          : editingUser.role === 'usuario'
            ? null
            : undefined;
      const isEditingSelf = editingUser.id === currentUserId;
      const emailField = emailChanged ? { email: trimmedEditEmail } : {};
      const payload =
        role === 'superadmin'
          ? {
              ...(isEditingSelf ? {} : { role: editRole, empresaId: editEmpresa?.id || undefined }),
              displayName: editDisplayName || undefined,
              phone: cleanedPhone || undefined,
              ...emailField,
              mei: editMei,
              ...(editRole === 'usuario' && !isEditingSelf && { expiresAt: expiresAtValue }),
              ...(isEditingSelf && editingUser.role === 'usuario' && { expiresAt: expiresAtValue }),
            }
          : {
              ...(isEditingSelf ? {} : { role: 'usuario' as const }),
              displayName: editDisplayName || undefined,
              phone: cleanedPhone || undefined,
              ...emailField,
              mei: editMei,
              expiresAt: expiresAtValue ?? null,
            };
      await updateUser(editingUser.id, payload);
      if (editMei) {
        await patchAdminMeiDocumentosAtivos(editingUser.id, {
          nfse: editDocNfse,
          nfe: editDocNfe,
          nfce: editDocNfce,
        });
      }
      // Aba Notas depende do mei na sessão — atualiza sem forçar novo login
      if (isEditingSelf) {
        useAuthStore.setState({ mei: editMei });
        await refreshAccessContext();
      }
      setSuccess(
        emailChanged
          ? `Usuário atualizado. Link de confirmação enviado para ${trimmedEditEmail}.`
          : 'Usuário atualizado com sucesso.',
      );
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setError(formatManageUserError(err.message || 'Erro ao atualizar usuário'));
    } finally {
      setLoading(false);
    }
  };

  const openBanUserModal = (user: ManagedUser) => {
    setUserToBan(user);
    setBanUserModalOpen(true);
  };

  const closeBanUserModal = () => {
    if (loading) return;
    setBanUserModalOpen(false);
    setUserToBan(null);
  };

  const confirmBanUser = async () => {
    if (!userToBan?.id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await banUser(userToBan.id);
      setBanUserModalOpen(false);
      setUserToBan(null);
      setSuccess('Usuário bloqueado com sucesso.');
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao bloquear usuário';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const openUnbanUserModal = (user: ManagedUser) => {
    setUserToUnban(user);
    setUnbanUserModalOpen(true);
  };

  const closeUnbanUserModal = () => {
    if (loading) return;
    setUnbanUserModalOpen(false);
    setUserToUnban(null);
  };

  const confirmUnbanUser = async () => {
    if (!userToUnban?.id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await unbanUser(userToUnban.id);
      setUnbanUserModalOpen(false);
      setUserToUnban(null);
      setSuccess('Usuário desbloqueado com sucesso.');
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao desbloquear usuário';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const openImpersonateModal = (user: ManagedUser) => {
    setImpersonateTarget(user);
    setImpersonateModalOpen(true);
  };

  const closeImpersonateModal = () => {
    if (loading) return;
    setImpersonateModalOpen(false);
    setImpersonateTarget(null);
  };

  const confirmImpersonate = async () => {
    if (!impersonateTarget?.id) return;
    const label =
      impersonateTarget.displayName || impersonateTarget.email || 'este usuário';
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await impersonate(impersonateTarget.id);
      setImpersonateModalOpen(false);
      setImpersonateTarget(null);
      setSuccess(`Acessando como ${label}`);
      onBack();
      onImpersonateSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao acessar conta';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteUserModal = (user: ManagedUser) => {
    setUserToDelete(user);
    setDeleteUserModalOpen(true);
  };

  const closeDeleteUserModal = () => {
    if (loading) return;
    setDeleteUserModalOpen(false);
    setUserToDelete(null);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete?.id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await deleteUser(userToDelete.id);
      setDeleteUserModalOpen(false);
      setUserToDelete(null);
      setSuccess('Usuário excluído com sucesso.');
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir usuário';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteEmpresaModal = (empresa: EmpresaOption) => {
    setEmpresaToDelete(empresa);
    setDeleteEmpresaModalOpen(true);
  };

  const closeDeleteEmpresaModal = () => {
    if (loading) return;
    setDeleteEmpresaModalOpen(false);
    setEmpresaToDelete(null);
  };

  const confirmDeleteEmpresa = async () => {
    if (!empresaToDelete?.id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await deleteEmpresa(empresaToDelete.id);
      setDeleteEmpresaModalOpen(false);
      setEmpresaToDelete(null);
      setSuccess('Empresa excluída com sucesso.');
      await fetchEmpresas();
      await fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir empresa';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = (user: ManagedUser) => {
    setResettingUser(user);
    setNewPasswordInput('');
    setResetPasswordModalOpen(true);
  };

  const confirmResetPassword = async () => {
    if (!resettingUser) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await resetUserPassword(
        resettingUser.id,
        newPasswordInput.trim() || undefined,
      );
      setLastPasswords((prev) => ({ ...prev, [resettingUser.id]: result.password }));
      setSuccess('Senha redefinida com sucesso.');
      setResetPasswordModalOpen(false);
      setResettingUser(null);
      setNewPasswordInput('');
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async (userId: string) => {
    const passwordValue = lastPasswords[userId];
    if (!passwordValue) return;
    if (!clipboardAvailable) {
      Alert.alert('Indisponível', 'Recurso de copiar não está disponível neste build.');
      return;
    }
    try {
      const Clipboard = clipboardRef.current ?? (await import('expo-clipboard'));
      clipboardRef.current = Clipboard;
      await Clipboard.setStringAsync(passwordValue);
      Alert.alert('Copiado', 'Senha copiada para a área de transferência.');
    } catch {
      setClipboardAvailable(false);
      Alert.alert('Indisponível', 'Recurso de copiar não está disponível neste build.');
    }
  };

  // ----------------------------------------------------------------------
  // Derived
  // ----------------------------------------------------------------------

  const filteredUsers = useMemo(() => {
    const base = focomeiUsers;
    return role === 'admin'
      ? base.filter((user) => user.role !== 'superadmin' && user.role !== 'outsider')
      : base;
  }, [role, focomeiUsers]);

  const searchedUsers = useMemo(() => {
    if (!searchTerm.trim()) return filteredUsers;
    return filteredUsers.filter((user) => matchManagedUserSearch(user, searchTerm));
  }, [filteredUsers, searchTerm]);

  const sortedUsers = useMemo(() => {
    const sorted = [...searchedUsers].sort((a, b) => {
      const aValue = (a.displayName || a.email || '').toLowerCase();
      const bValue = (b.displayName || b.email || '').toLowerCase();
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [searchedUsers, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage !== currentPageSafe) {
      setCurrentPage(currentPageSafe);
    }
  }, [currentPage, currentPageSafe]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPageSafe - 1) * pageSize;
    return sortedUsers.slice(startIndex, startIndex + pageSize);
  }, [sortedUsers, currentPageSafe, pageSize]);

  const filteredEmpresasList = useMemo(() => {
    const term = empresaTabSearch.trim().toLowerCase();
    const displayName = (e: EmpresaOption) => e.nome_fantasia || e.empresa;
    const sorted = [...focomeiEmpresas].sort((a, b) =>
      displayName(a).localeCompare(displayName(b), 'pt-BR', { sensitivity: 'base' }),
    );
    return sorted.filter((e) => {
      const matchesName = !term || displayName(e).toLowerCase().includes(term);
      if (!matchesName) return false;

      if (empresaMeiFilter === 'all') return true;

      const limiteMei =
        e.max_mei === null || e.max_mei === undefined ? 0 : Number(e.max_mei) || 0;
      const meiAtivo = limiteMei > 0;

      return empresaMeiFilter === 'active' ? meiAtivo : !meiAtivo;
    });
  }, [focomeiEmpresas, empresaTabSearch, empresaMeiFilter]);

  const totalEmpresasMeiAtivo = useMemo(
    () => focomeiEmpresas.length,
    [focomeiEmpresas],
  );

  const blockedCount = useMemo(
    () => filteredUsers.filter((u) => u.status === false).length,
    [filteredUsers],
  );

  const showEmpresasTab = role === 'superadmin';

  const pageStats = useMemo(() => {
    const isMeiProduct = resolveAppOrigin() === 'focomei';
    const activeCount = focomeiUsers.filter((u) => u.status !== false).length;
    const adminCount = focomeiUsers.filter(
      (u) => u.role === 'admin' || u.role === 'superadmin',
    ).length;
    const items = [
      { label: isMeiProduct ? 'Usuários MEI' : 'Usuários', value: focomeiUsers.length },
      { label: 'Ativos', value: activeCount },
      { label: 'Bloqueados', value: blockedCount },
      { label: 'Admins', value: adminCount },
    ];
    if (showEmpresasTab) {
      items.splice(1, 0, {
        label: isMeiProduct ? 'Empresas MEI' : 'Empresas',
        value: focomeiEmpresas.length,
      });
    }
    return items;
  }, [focomeiUsers, focomeiEmpresas, blockedCount, showEmpresasTab]);

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------

  if (!sessionRestored) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <MfScrollView
          style={styles.pageScroll}
          contentContainerStyle={[styles.pageContent, isDesktop && styles.pageContentDesktop]}
        >
          <View style={[styles.bodyInner, isDesktop && styles.bodyInnerDesktop]}>
            <ManageUsersPageChrome
              theme={theme}
              onBack={onBack}
              isDesktop={isDesktop}
              role={role}
              stats={[]}
            />
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando permissões...</Text>
            </View>
          </View>
        </MfScrollView>
      </SafeAreaView>
    );
  }

  if (!canManage) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <MfScrollView
          style={styles.pageScroll}
          contentContainerStyle={[styles.pageContent, isDesktop && styles.pageContentDesktop]}
        >
          <View style={[styles.bodyInner, isDesktop && styles.bodyInnerDesktop]}>
            <ManageUsersPageChrome
              theme={theme}
              onBack={onBack}
              isDesktop={isDesktop}
              role={role}
              stats={[]}
            />
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.errorLight }]}>
                <Ionicons name="lock-closed-outline" size={32} color={theme.error} />
              </View>
              <Text style={styles.emptyTitle}>Acesso restrito</Text>
              <Text style={styles.emptyDescription}>
                Você não tem permissão para acessar esta área.
              </Text>
            </View>
          </View>
        </MfScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <MfScrollView
          style={styles.pageScroll}
          contentContainerStyle={[styles.pageContent, isDesktop && styles.pageContentDesktop]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
        <View style={[styles.bodyInner, isDesktop && styles.bodyInnerDesktop]}>
          <ManageUsersPageChrome
            theme={theme}
            onBack={onBack}
            isDesktop={isDesktop}
            role={role}
            stats={pageStats}
            subtitle={
              resolveAppOrigin() === 'focomei'
                ? 'Somente empresas e usuários com MEI ativo no FocoMEI.'
                : 'Gerencie empresas, usuários e permissões do Foco Simples.'
            }
            loading={initialUsersLoading || (showEmpresasTab && initialEmpresasLoading)}
            rightAction={
              isDesktop && activeTab !== 'invites'
                ? {
                    label: activeTab === 'users' ? 'Novo usuário' : 'Nova empresa',
                    onPress: activeTab === 'users' ? openCreateUser : openCreateEmpresa,
                  }
                : null
            }
          />

          <MfScrollView
            horizontal
            hideHorizontalBar
            style={styles.tabScroll}
            contentContainerStyle={styles.tabRow}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'users' && styles.tabBtnActive]}
              onPress={() => setActiveTab('users')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'users' }}
              accessibilityLabel="Usuários"
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={activeTab === 'users' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'users' && styles.tabBtnTextActive]}
                numberOfLines={1}
              >
                Usuários
              </Text>
              <View style={[styles.tabCount, activeTab === 'users' && styles.tabCountActive]}>
                <Text
                  style={[styles.tabCountText, activeTab === 'users' && styles.tabCountTextActive]}
                >
                  {initialUsersLoading ? '…' : filteredUsers.length}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'invites' && styles.tabBtnActive]}
              onPress={() => setActiveTab('invites')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'invites' }}
              accessibilityLabel="Convites"
            >
              <Ionicons
                name="link-outline"
                size={16}
                color={activeTab === 'invites' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'invites' && styles.tabBtnTextActive]}
                numberOfLines={1}
              >
                Convites
              </Text>
            </TouchableOpacity>
            {showEmpresasTab ? (
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'empresas' && styles.tabBtnActive]}
                onPress={() => setActiveTab('empresas')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'empresas' }}
                accessibilityLabel="Empresas"
              >
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={activeTab === 'empresas' ? '#FFFFFF' : theme.textSecondary}
                />
                <Text
                  style={[styles.tabBtnText, activeTab === 'empresas' && styles.tabBtnTextActive]}
                  numberOfLines={1}
                >
                  Empresas
                </Text>
                <View style={[styles.tabCount, activeTab === 'empresas' && styles.tabCountActive]}>
                  <Text
                    style={[
                      styles.tabCountText,
                      activeTab === 'empresas' && styles.tabCountTextActive,
                    ]}
                  >
                    {initialEmpresasLoading ? '…' : focomeiEmpresas.length}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </MfScrollView>

          {/* Feedback */}
          {error ? (
            <View style={styles.feedbackError}>
              <Ionicons name="alert-circle" size={18} color={theme.error} />
              <Text style={styles.feedbackErrorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={styles.feedbackSuccess}>
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
              <Text style={styles.feedbackSuccessText}>{success}</Text>
            </View>
          ) : null}

          {activeTab === 'users' ? (
            <View style={styles.tabPanel}>
              <View style={styles.toolbar}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color={theme.textTertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Nome, email, telefone, empresa ou perfil"
                    placeholderTextColor={theme.placeholder}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    autoCapitalize="none"
                  />
                  {searchTerm ? (
                    <TouchableOpacity onPress={() => setSearchTerm('')}>
                      <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.sortBtn}
                  onPress={() =>
                    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                  }
                  accessibilityLabel="Alternar ordenação"
                >
                  <Ionicons
                    name={sortDirection === 'asc' ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={theme.text}
                  />
                  <Text style={styles.sortBtnText}>
                    {sortDirection === 'asc' ? 'A–Z' : 'Z–A'}
                  </Text>
                </TouchableOpacity>
                {!isDesktop ? (
                  <TouchableOpacity style={styles.toolbarAddBtn} onPress={openCreateUser}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
              {sortedUsers.length > 0 ? (
                <Text style={styles.listSummary}>
                  Mostrando {(currentPageSafe - 1) * pageSize + 1}–
                  {Math.min(currentPageSafe * pageSize, sortedUsers.length)} de {sortedUsers.length}
                </Text>
              ) : null}

              <ManageUsersListBlock
                data={paginatedUsers}
                keyExtractor={(item: ManagedUser, index: number) =>
                  item?.id ? String(item.id) : `user-${index}`
                }
                renderItem={(item: ManagedUser) => {
                  if (!item?.id) return null;
                  const isBlocked = item.status === false;
                  const actions = getManagedUserActions(role, item, currentUserId);
                  const canViewCompanyMembers =
                    role === 'superadmin' && item.role === 'admin' && !!item.empresaId;

                  return (
                    <UserCard
                      user={item}
                      canEdit={actions.canEdit}
                      canImpersonate={actions.canImpersonate}
                      canBan={actions.canBan}
                      canDelete={actions.canDelete}
                      canViewCompanyMembers={canViewCompanyMembers}
                      isBlocked={isBlocked}
                      isDesktop={isDesktop}
                      lastPassword={lastPasswords[item.id]}
                      theme={theme}
                      styles={styles}
                      onEdit={startEditUser}
                      onImpersonate={openImpersonateModal}
                      onViewCompanyMembers={openCompanyMembersForUser}
                      onBan={openBanUserModal}
                      onUnban={openUnbanUserModal}
                      onResetPassword={handleResetPassword}
                      onDelete={openDeleteUserModal}
                      onCopyPassword={handleCopyPassword}
                    />
                  );
                }}
                styles={styles}
                ListEmptyComponent={
                  initialUsersLoading ? (
                    <ListSkeleton count={5} variant="user" styles={styles} theme={theme} />
                  ) : sortedUsers.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                        <Ionicons name="people-outline" size={28} color={theme.primary} />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {searchTerm ? 'Nenhum resultado' : 'Sem usuários ainda'}
                      </Text>
                      <Text style={styles.emptyDescription}>
                        {searchTerm
                          ? 'Tente outros termos de busca.'
                          : 'Crie o primeiro usuário pelo botão acima.'}
                      </Text>
                    </View>
                  ) : null
                }
                ListFooterComponent={
                  sortedUsers.length > 0 ? (
                    <View style={styles.paginationRow}>
                      <TouchableOpacity
                        style={[
                          styles.pageNavButton,
                          currentPageSafe === 1 && styles.pageNavButtonDisabled,
                        ]}
                        onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPageSafe === 1}
                      >
                        <Ionicons name="chevron-back" size={16} color={theme.text} />
                        <Text style={styles.pageNavButtonText}>Anterior</Text>
                      </TouchableOpacity>
                      <Text style={styles.paginationText}>
                        Página {currentPageSafe} de {totalPages}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.pageNavButton,
                          currentPageSafe === totalPages && styles.pageNavButtonDisabled,
                        ]}
                        onPress={() =>
                          setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                        }
                        disabled={currentPageSafe === totalPages}
                      >
                        <Text style={styles.pageNavButtonText}>Próxima</Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                  ) : null
                }
              />
            </View>
          ) : activeTab === 'invites' ? (
            <View style={styles.tabPanel}>
            <InvitesTab
              role={role}
              empresas={focomeiEmpresas}
              users={focomeiUsers}
              theme={theme}
              isDesktop={isDesktop}
              onFeedback={({ type, message }) => {
                if (type === 'success') {
                  setSuccess(message);
                  setError('');
                } else {
                  setError(message);
                  setSuccess('');
                }
              }}
            />
            </View>
          ) : (
            <View style={styles.tabPanel}>
              <View style={styles.toolbar}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color={theme.textTertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar empresa"
                    placeholderTextColor={theme.placeholder}
                    value={empresaTabSearch}
                    onChangeText={setEmpresaTabSearch}
                    autoCapitalize="none"
                  />
                  {empresaTabSearch ? (
                    <TouchableOpacity onPress={() => setEmpresaTabSearch('')}>
                      <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {!isDesktop ? (
                  <TouchableOpacity style={styles.toolbarAddBtn} onPress={openCreateEmpresa}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.empresaMeiFilterBlock}>
                <Text style={styles.empresaMeiFilterHint}>
                  Exibindo apenas empresas com MEI ativo e usuários com vaga MEI liberada.
                </Text>
                <View style={[styles.meiStatBadge, { borderColor: theme.success + '55', backgroundColor: theme.successLight }]}>
                  <Text style={[styles.meiStatBadgeText, { color: theme.success }]}>
                    MEI ativo: {totalEmpresasMeiAtivo}
                  </Text>
                </View>
              </View>

              <ManageUsersListBlock
                data={filteredEmpresasList}
                keyExtractor={(item: EmpresaOption) => item.id}
                renderItem={(item: EmpresaOption) => (
                  <EmpresaCard
                    empresa={item}
                    theme={theme}
                    styles={styles}
                    onEdit={openEditEmpresa}
                    onViewMembers={
                      role === 'superadmin' ? openEmpresaMembers : undefined
                    }
                    onOpenBilling={role === 'superadmin' ? (e) => setBillingEmpresa(e) : undefined}
                    onDelete={role === 'superadmin' ? openDeleteEmpresaModal : undefined}
                  />
                )}
                styles={styles}
                ListEmptyComponent={
                  initialEmpresasLoading ? (
                    <ListSkeleton count={4} variant="empresa" styles={styles} theme={theme} />
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                        <Ionicons name="business-outline" size={28} color={theme.primary} />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {initialEmpresasLoading
                          ? ''
                          : focomeiEmpresas.length === 0
                            ? 'Sem empresas MEI ainda'
                            : 'Nenhuma empresa encontrada'}
                      </Text>
                      <Text style={styles.emptyDescription}>
                        {initialEmpresasLoading
                          ? ''
                          : focomeiEmpresas.length === 0
                            ? 'Cadastre a primeira empresa com MEI ativo para começar.'
                            : empresaTabSearch.trim()
                              ? 'Ajuste a busca pelo nome da empresa.'
                              : ''}
                      </Text>
                    </View>
                  )
                }
              />
            </View>
          )}
        </View>
          </MfScrollView>

      {/* ============================================================== */}
      {/* SidePanel: Criar usuário                                        */}
      {/* ============================================================== */}
      <SidePanel
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title="Novo usuário"
        subtitle="Cadastre uma nova conta e defina o nível de acesso."
        icon="person-add-outline"
        isDesktop={isDesktop}
        theme={theme}
        styles={styles}
        footer={
          <View style={styles.panelFooterRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setCreateUserOpen(false)}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || !email) && styles.primaryBtnDisabled,
              ]}
              onPress={handleCreateUser}
              disabled={loading || !email}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Salvando...' : 'Criar usuário'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.formSectionTitle}>Conta</Text>
        <Field label="Email" required styles={styles}>
          <TextInput
            style={styles.textInput}
            placeholder="email@exemplo.com"
            placeholderTextColor={theme.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </Field>
        <Field
          label="Senha"
          helper="Deixe em branco para gerar uma senha automaticamente."
          styles={styles}
        >
          <TextInput
            style={styles.textInput}
            placeholder="••••••••"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Field>

        <Text style={styles.formSectionTitle}>Perfil</Text>
        <Field label="Nome de exibição" styles={styles}>
          <TextInput
            style={styles.textInput}
            placeholder="Nome completo"
            placeholderTextColor={theme.placeholder}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </Field>
        <Field label="Telefone" styles={styles}>
          <TextInput
            style={styles.textInput}
            placeholder="(11) 99999-9999"
            placeholderTextColor={theme.placeholder}
            value={phone}
            onChangeText={(value: string) => setPhone(formatPhoneBrCell(value))}
            keyboardType="phone-pad"
          />
        </Field>

        {role === 'superadmin' ? (
          <>
            <Text style={styles.formSectionTitle}>Acesso</Text>
            <Field label="Função" styles={styles}>
              <View style={styles.chipRow}>
                {(['admin', 'usuario', 'outsider'] as RoleOption[]).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.chip,
                      selectedRole === option && styles.chipActive,
                    ]}
                    onPress={() => setSelectedRole(option)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedRole === option && styles.chipTextActive,
                      ]}
                    >
                      {ROLE_LABEL[option]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldHelper}>{ROLE_DESCRIPTION[selectedRole]}</Text>
            </Field>
            <Field label="Empresa" styles={styles}>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setEmpresaModalOpen(true)}
              >
                <View style={styles.selectorLeft}>
                  <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
                  <Text
                    style={[
                      styles.selectorText,
                      !selectedEmpresa && { color: theme.placeholder },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedEmpresa ? (selectedEmpresa.nome_fantasia || selectedEmpresa.empresa) : 'Selecionar empresa'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </Field>
          </>
        ) : null}
      </SidePanel>

      {/* ============================================================== */}
      {/* EmpresaModal: criação/edição com CNPJ + endereço + limites      */}
      {/* ============================================================== */}
      <EmpresaModal
        visible={empresaFormOpen}
        initial={empresaFormInitial}
        onClose={closeEmpresaPanel}
        onSuccess={handleEmpresaSaved}
      />

      {/* ============================================================== */}
      {/* SidePanel: Editar usuário                                       */}
      {/* ============================================================== */}
      <SidePanel
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Editar usuário"
        subtitle={editingUser?.email || undefined}
        icon="create-outline"
        isDesktop={isDesktop}
        theme={theme}
        styles={styles}
        footer={
          <View style={styles.panelFooterRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setEditingUser(null)}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || (role === 'superadmin' && !editEmpresa)) &&
                  styles.primaryBtnDisabled,
              ]}
              onPress={handleUpdateUser}
              disabled={loading || (role === 'superadmin' && !editEmpresa)}
            >
              <Text style={styles.primaryBtnText}>{loading ? 'Salvando...' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.formSectionTitle}>Perfil</Text>
        <Field label="Nome de exibição" styles={styles}>
          <TextInput
            style={styles.textInput}
            placeholder="Nome completo"
            placeholderTextColor={theme.placeholder}
            value={editDisplayName}
            onChangeText={setEditDisplayName}
          />
        </Field>
        <Field label="Telefone" styles={styles}>
          <TextInput
            style={styles.textInput}
            placeholder="(11) 99999-9999"
            placeholderTextColor={theme.placeholder}
            value={editPhone}
            onChangeText={(value: string) => setEditPhone(formatPhoneBrCell(value))}
            keyboardType="phone-pad"
          />
        </Field>
        <Field
          label="E-mail de login"
          helper={
            editEmail.trim().toLowerCase() !== (editOriginalEmail || '').trim().toLowerCase() && editEmail.trim()
              ? 'Ao salvar, um link de confirmação será enviado para o novo endereço. O e-mail só passa a valer quando o usuário clicar no link.'
              : undefined
          }
          styles={styles}
        >
          <TextInput
            style={styles.textInput}
            placeholder="email@exemplo.com"
            placeholderTextColor={theme.placeholder}
            value={editEmail}
            onChangeText={setEditEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>

        <Text style={styles.formSectionTitle}>Acesso</Text>
        <Field label="Função" styles={styles}>
          <View style={styles.chipRow}>
            {(['admin', 'usuario', 'outsider'] as RoleOption[]).map((option) => {
              const disabled = role !== 'superadmin' && option !== 'usuario';
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    editRole === option && styles.chipActive,
                    disabled && styles.chipDisabled,
                  ]}
                  onPress={() => {
                    if (disabled) return;
                    setEditRole(option);
                  }}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.chipText,
                      editRole === option && styles.chipTextActive,
                      disabled && styles.chipTextDisabled,
                    ]}
                  >
                    {ROLE_LABEL[option]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        {role === 'superadmin' ? (
          <Field label="Empresa" required styles={styles}>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setEditEmpresaModalOpen(true)}
            >
              <View style={styles.selectorLeft}>
                <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
                <Text
                  style={[
                    styles.selectorText,
                    !editEmpresa && { color: theme.placeholder },
                  ]}
                  numberOfLines={1}
                >
                  {editEmpresa ? (editEmpresa.nome_fantasia || editEmpresa.empresa) : 'Selecionar empresa'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </Field>
        ) : null}

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>
              {resolveAppOrigin() === 'focosimples' ? 'Habilitar Notas (emissão fiscal)' : 'Habilitar MEI'}
            </Text>
            <Text style={styles.switchHelper}>
              {resolveAppOrigin() === 'focosimples'
                ? editingUser?.id === currentUserId && editingUser?.mei === true && !editMei
                  ? 'Desligue para esconder a aba Notas da sua conta.'
                  : editingUser?.id === currentUserId && editMei
                    ? 'Com isto ligado, a aba Notas aparece no menu.'
                    : 'Libera a aba Notas e a emissão NFS-e / NF-e / NFC-e (Simples Nacional).'
                : editingUser?.id === currentUserId && editingUser?.mei === true && !editMei
                  ? 'Desligue para remover o módulo MEI da sua conta.'
                  : editingUser?.id === currentUserId && editMei
                    ? 'Você pode desligar quando não precisar mais do módulo MEI.'
                    : 'Permite uso dos recursos exclusivos para MEI.'}
            </Text>
          </View>
          <ToggleSwitch
            value={editMei}
            onValueChange={setEditMei}
            activeColor={theme.primary}
          />
        </View>

        {editMei ? (
          <View style={[styles.switchRow, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <View>
              <Text style={styles.switchLabel}>Tipos de nota liberados</Text>
              <Text style={styles.switchHelper}>
                Define o que o usuário pode cadastrar e emitir (NFS-e, NF-e, NFC-e).
              </Text>
            </View>
            {editDocsLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <View style={[styles.switchRow, { marginTop: 0 }]}>
                  <Text style={styles.switchLabel}>NFS-e (serviços)</Text>
                  <ToggleSwitch value={editDocNfse} onValueChange={setEditDocNfse} activeColor={theme.primary} />
                </View>
                <View style={[styles.switchRow, { marginTop: 0 }]}>
                  <Text style={styles.switchLabel}>NF-e (produtos)</Text>
                  <ToggleSwitch value={editDocNfe} onValueChange={setEditDocNfe} activeColor={theme.primary} />
                </View>
                <View style={[styles.switchRow, { marginTop: 0 }]}>
                  <Text style={styles.switchLabel}>NFC-e (varejo)</Text>
                  <ToggleSwitch value={editDocNfce} onValueChange={setEditDocNfce} activeColor={theme.primary} />
                </View>
              </>
            )}
          </View>
        ) : null}

        {editingUser?.role === 'usuario' ? (
          <>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Data de validade</Text>
                <Text style={styles.switchHelper}>
                  {editExpiresAt
                    ? 'Acesso será bloqueado nesta data.'
                    : 'Sem expiração — acesso permanente.'}
                </Text>
              </View>
              <ToggleSwitch
                value={Boolean(editExpiresAt)}
                onValueChange={(next) => {
                  if (next) {
                    const d = new Date();
                    d.setDate(d.getDate() + 30);
                    const y = d.getFullYear();
                    const m = (d.getMonth() + 1).toString().padStart(2, '0');
                    const day = d.getDate().toString().padStart(2, '0');
                    setEditExpiresAt(`${y}-${m}-${day}`);
                  } else {
                    setEditExpiresAt('');
                  }
                }}
                activeColor={theme.warning}
              />
            </View>
            {editExpiresAt ? (
              <Field
                label="Data de bloqueio"
                helper="Formato AAAA-MM-DD."
                styles={styles}
              >
                <TextInput
                  style={styles.textInput}
                  placeholder="2026-12-31"
                  placeholderTextColor={theme.placeholder}
                  value={editExpiresAt}
                  onChangeText={setEditExpiresAt}
                />
              </Field>
            ) : null}
          </>
        ) : null}

        {role === 'superadmin' && !editEmpresa ? (
          <Text style={styles.fieldHelper}>Selecione uma empresa para poder salvar.</Text>
        ) : null}
      </SidePanel>

      {/* ============================================================== */}
      {/* Modal: Selecionar empresa (create user)                         */}
      {/* ============================================================== */}
      <Modal
        visible={empresaModalOpen}
        animationType={isDesktop ? 'fade' : 'slide'}
        transparent
        onRequestClose={() => setEmpresaModalOpen(false)}
      >
        <View style={styles.panelOverlay}>
          <Pressable style={styles.panelBackdrop} onPress={() => setEmpresaModalOpen(false)} />
          <View style={[styles.panel, isDesktop ? styles.panelDesktopWide : styles.panelMobile]}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelHeaderIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="business-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>Selecionar empresa</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEmpresaModalOpen(false)}
                style={styles.panelCloseBtn}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.panelBody, { padding: 20 }]}>
              <View style={[styles.searchBox, { marginBottom: 12, paddingVertical: 14, flex: 0 }]}>
                <Ionicons name="search" size={16} color={theme.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar empresa"
                  placeholderTextColor={theme.placeholder}
                  value={empresaSearch}
                  onChangeText={setEmpresaSearch}
                />
              </View>
              <MfScrollView style={styles.pickerScroll} hideLegalFooter>
                {[...focomeiEmpresas]
                  .sort((a, b) =>
                    (a.nome_fantasia || a.empresa).localeCompare(
                      b.nome_fantasia || b.empresa, 'pt-BR', { sensitivity: 'base' },
                    ),
                  )
                  .filter((empresa) =>
                    (empresa.nome_fantasia || empresa.empresa).toLowerCase().includes(empresaSearch.toLowerCase()),
                  )
                  .map((empresa) => {
                    const active = selectedEmpresa?.id === empresa.id;
                    return (
                      <TouchableOpacity
                        key={empresa.id}
                        style={[styles.pickerRow, active && styles.pickerRowActive]}
                        onPress={() => {
                          setSelectedEmpresa(empresa);
                          setEmpresaModalOpen(false);
                          setEmpresaSearch('');
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerRowText,
                            active && styles.pickerRowTextActive,
                          ]}
                        >
                          {empresa.nome_fantasia || empresa.empresa}
                        </Text>
                        {active ? (
                          <Ionicons name="checkmark" size={18} color={theme.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
              </MfScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* Modal: Selecionar empresa (edit user)                           */}
      {/* ============================================================== */}
      <Modal
        visible={editEmpresaModalOpen}
        animationType={isDesktop ? 'fade' : 'slide'}
        transparent
        onRequestClose={() => setEditEmpresaModalOpen(false)}
      >
        <View style={styles.panelOverlay}>
          <Pressable
            style={styles.panelBackdrop}
            onPress={() => setEditEmpresaModalOpen(false)}
          />
          <View style={[styles.panel, isDesktop ? styles.panelDesktopWide : styles.panelMobile]}>
            <View style={styles.panelHeader}>
              <View style={[styles.panelHeaderIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="business-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>Selecionar empresa</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditEmpresaModalOpen(false)}
                style={styles.panelCloseBtn}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.panelBody, { padding: 20 }]}>
              <View style={[styles.searchBox, { marginBottom: 12, paddingVertical: 14, flex: 0 }]}>
                <Ionicons name="search" size={16} color={theme.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar empresa"
                  placeholderTextColor={theme.placeholder}
                  value={empresaSearch}
                  onChangeText={setEmpresaSearch}
                />
              </View>
              <MfScrollView style={styles.pickerScroll} hideLegalFooter>
                {[...focomeiEmpresas]
                  .sort((a, b) =>
                    (a.nome_fantasia || a.empresa).localeCompare(
                      b.nome_fantasia || b.empresa, 'pt-BR', { sensitivity: 'base' },
                    ),
                  )
                  .filter((empresa) =>
                    (empresa.nome_fantasia || empresa.empresa).toLowerCase().includes(empresaSearch.toLowerCase()),
                  )
                  .map((empresa) => {
                    const active = editEmpresa?.id === empresa.id;
                    return (
                      <TouchableOpacity
                        key={empresa.id}
                        style={[styles.pickerRow, active && styles.pickerRowActive]}
                        onPress={() => {
                          setEditEmpresa(empresa);
                          setEditEmpresaModalOpen(false);
                          setEmpresaSearch('');
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerRowText,
                            active && styles.pickerRowTextActive,
                          ]}
                        >
                          {empresa.nome_fantasia || empresa.empresa}
                        </Text>
                        {active ? (
                          <Ionicons name="checkmark" size={18} color={theme.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
              </MfScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* Modal: Acessar como usuário (impersonate)                       */}
      {/* ============================================================== */}
      <SidePanel
        open={impersonateModalOpen}
        onClose={closeImpersonateModal}
        title="Acessar como usuário"
        subtitle={impersonateTarget?.displayName || impersonateTarget?.email || undefined}
        icon="log-in-outline"
        isDesktop={isDesktop}
        theme={theme}
        styles={styles}
        footer={
          <View style={styles.panelFooterRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={closeImpersonateModal}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={confirmImpersonate}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Acessando...' : 'Acessar'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.helperText}>
          Você verá o app com os dados e permissões de{' '}
          <Text style={{ fontWeight: '700' }}>
            {impersonateTarget?.displayName || impersonateTarget?.email || 'este usuário'}
          </Text>
          . Use o banner no topo para voltar à sua conta de administrador.
        </Text>
      </SidePanel>

      {/* ============================================================== */}
      {/* Modal: Reset senha                                              */}
      {/* ============================================================== */}
      <SidePanel
        open={resetPasswordModalOpen}
        onClose={() => {
          setResetPasswordModalOpen(false);
          setResettingUser(null);
          setNewPasswordInput('');
        }}
        title="Redefinir senha"
        subtitle={resettingUser?.displayName || resettingUser?.email || undefined}
        icon="key-outline"
        isDesktop={isDesktop}
        theme={theme}
        styles={styles}
        footer={
          <View style={styles.panelFooterRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setResetPasswordModalOpen(false);
                setResettingUser(null);
                setNewPasswordInput('');
              }}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={confirmResetPassword}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Redefinindo...' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.helperText}>
          Digite uma nova senha ou deixe em branco para que uma seja gerada automaticamente.
          A senha gerada aparecerá no card do usuário após confirmar.
        </Text>
        <Field label="Nova senha" helper="Mínimo 6 caracteres (opcional)" styles={styles}>
          <TextInput
            style={styles.textInput}
            placeholder="••••••••"
            placeholderTextColor={theme.placeholder}
            value={newPasswordInput}
            onChangeText={setNewPasswordInput}
            secureTextEntry
            autoCapitalize="none"
          />
        </Field>
      </SidePanel>

      {/* ============================================================== */}
      {/* Modal: Excluir usuário (Alert.alert não funciona na web)          */}
      {/* ============================================================== */}
      <Modal
        visible={deleteUserModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteUserModal}
      >
        <Pressable style={styles.deleteConfirmBackdrop} onPress={closeDeleteUserModal}>
          <Pressable style={styles.deleteConfirmDialog} onPress={() => {}}>
            <TouchableOpacity
              style={styles.deleteConfirmClose}
              onPress={closeDeleteUserModal}
              disabled={loading}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.deleteConfirmIconBox, { backgroundColor: theme.errorLight }]}>
              <Ionicons name="warning-outline" size={32} color={theme.error} />
            </View>
            <Text style={styles.deleteConfirmTitle}>Excluir usuário</Text>
            <Text style={styles.deleteConfirmMessage}>
              Você está prestes a excluir{' '}
              <Text style={styles.deleteConfirmName}>
                {userToDelete?.displayName || userToDelete?.email || 'este usuário'}
              </Text>
              . Esta ação é irreversível e todos os dados vinculados serão removidos
              permanentemente.
            </Text>
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={closeDeleteUserModal}
                disabled={loading}
              >
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, loading && styles.primaryBtnDisabled]}
                onPress={() => void confirmDeleteUser()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dangerBtnText}>Sim, excluir usuário</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ============================================================== */}
      {/* Modal: Bloquear usuário (Alert.alert não funciona na web)        */}
      {/* ============================================================== */}
      <Modal
        visible={banUserModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeBanUserModal}
      >
        <Pressable style={styles.deleteConfirmBackdrop} onPress={closeBanUserModal}>
          <Pressable style={styles.deleteConfirmDialog} onPress={() => {}}>
            <TouchableOpacity
              style={styles.deleteConfirmClose}
              onPress={closeBanUserModal}
              disabled={loading}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.deleteConfirmIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="ban-outline" size={32} color={theme.warning} />
            </View>
            <Text style={styles.deleteConfirmTitle}>Bloquear usuário</Text>
            <Text style={styles.deleteConfirmMessage}>
              Tem certeza que deseja bloquear{' '}
              <Text style={styles.deleteConfirmName}>
                {userToBan?.displayName || userToBan?.email || 'este usuário'}
              </Text>
              ? Ele não poderá acessar o sistema até ser desbloqueado.
            </Text>
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={closeBanUserModal}
                disabled={loading}
              >
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, loading && styles.primaryBtnDisabled]}
                onPress={() => void confirmBanUser()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dangerBtnText}>Sim, bloquear</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ============================================================== */}
      {/* Modal: Desbloquear usuário (Alert.alert não funciona na web)     */}
      {/* ============================================================== */}
      <Modal
        visible={unbanUserModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeUnbanUserModal}
      >
        <Pressable style={styles.deleteConfirmBackdrop} onPress={closeUnbanUserModal}>
          <Pressable style={styles.deleteConfirmDialog} onPress={() => {}}>
            <TouchableOpacity
              style={styles.deleteConfirmClose}
              onPress={closeUnbanUserModal}
              disabled={loading}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.deleteConfirmIconBox, { backgroundColor: theme.successLight }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color={theme.success} />
            </View>
            <Text style={styles.deleteConfirmTitle}>Desbloquear usuário</Text>
            <Text style={styles.deleteConfirmMessage}>
              Tem certeza que deseja desbloquear{' '}
              <Text style={styles.deleteConfirmName}>
                {userToUnban?.displayName || userToUnban?.email || 'este usuário'}
              </Text>
              ? O acesso ao sistema será restaurado.
            </Text>
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={closeUnbanUserModal}
                disabled={loading}
              >
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={() => void confirmUnbanUser()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Sim, desbloquear</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ============================================================== */}
      {/* Modal: Excluir empresa (Alert.alert não funciona na web)         */}
      {/* ============================================================== */}
      <Modal
        visible={deleteEmpresaModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteEmpresaModal}
      >
        <Pressable style={styles.deleteConfirmBackdrop} onPress={closeDeleteEmpresaModal}>
          <Pressable style={styles.deleteConfirmDialog} onPress={() => {}}>
            <TouchableOpacity
              style={styles.deleteConfirmClose}
              onPress={closeDeleteEmpresaModal}
              disabled={loading}
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.deleteConfirmIconBox, { backgroundColor: theme.errorLight }]}>
              <Ionicons name="warning-outline" size={32} color={theme.error} />
            </View>
            <Text style={styles.deleteConfirmTitle}>Excluir empresa</Text>
            <Text style={styles.deleteConfirmMessage}>
              Você está prestes a excluir{' '}
              <Text style={styles.deleteConfirmName}>
                {empresaToDelete?.nome_fantasia || empresaToDelete?.empresa || 'esta empresa'}
              </Text>
              . Esta ação é irreversível e todos os vínculos serão removidos.
            </Text>
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={closeDeleteEmpresaModal}
                disabled={loading}
              >
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, loading && styles.primaryBtnDisabled]}
                onPress={() => void confirmDeleteEmpresa()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dangerBtnText}>Sim, excluir empresa</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <EmpresaStripeMeiBillingModal
        open={!!billingEmpresa}
        empresa={billingEmpresa}
        meiUsuariosEmUso={
          billingEmpresa
            ? focomeiUsers.filter((u) => u.empresaId === billingEmpresa.id).length
            : null
        }
        onClose={() => setBillingEmpresa(null)}
        onMaxMeiSynced={fetchEmpresas}
      />

      <SidePanel
        open={!!membersEmpresa}
        onClose={() => setMembersEmpresa(null)}
        title="Usuários da empresa"
        subtitle={
          membersEmpresa
            ? membersEmpresa.nome_fantasia || membersEmpresa.empresa
            : undefined
        }
        icon="people-outline"
        isDesktop={isDesktop}
        theme={theme}
        styles={styles}
        footer={
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setMembersEmpresa(null)}
          >
            <Text style={styles.secondaryBtnText}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.helperText}>
          {empresaMembersList.length === 0
            ? 'Nenhum usuário vinculado a esta empresa.'
            : `${empresaMembersList.length} usuário${empresaMembersList.length === 1 ? '' : 's'} vinculado${empresaMembersList.length === 1 ? '' : 's'} · ${empresaMembersMeiCount} com vaga MEI · ${empresaMembersList.length - empresaMembersMeiCount} PF / Outros. Toque em um nome para editar.`}
        </Text>
        <View style={styles.membersList}>
          {empresaMembersList.map((member) => {
            const roleTone = getRoleTone(member.role, theme);
            const blocked = member.status === false;
            return (
              <TouchableOpacity
                key={member.id}
                style={styles.memberRow}
                onPress={() => openMemberForEdit(member)}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${member.displayName || member.email}`}
              >
                <View style={styles.memberRowMain}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.displayName || member.email || 'Sem nome'}
                  </Text>
                  <Text style={styles.memberEmail} numberOfLines={1}>
                    {member.email || '—'}
                  </Text>
                  <View style={styles.memberBadges}>
                    <Badge
                      label={ROLE_LABEL[member.role] || member.role}
                      bg={roleTone.bg}
                      fg={roleTone.fg}
                      styles={styles}
                    />
                    <Badge
                      label={getMeiUserTypeLabel(member.mei)}
                      bg={theme.backgroundMuted}
                      fg={isMeiSlotUser(member.mei) ? theme.success : theme.textSecondary}
                      styles={styles}
                    />
                    <Badge
                      label={blocked ? 'Bloqueado' : 'Ativo'}
                      bg={blocked ? theme.errorLight : theme.successLight}
                      fg={blocked ? theme.error : theme.success}
                      styles={styles}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            );
          })}
        </View>
      </SidePanel>
    </SafeAreaView>
  );
}

// =======================================================================
// Styles
// =======================================================================

const createStyles = (theme: Theme, isDesktop: boolean, isDarkMode: boolean) => {
  const tokens = getTechTokens(isDarkMode);
  const tabWell = mfTechInsetSurface(isDarkMode, false);

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    pageScroll: { flex: 1 },
    pageContent: {
      paddingBottom: 32,
    },
    pageContentDesktop: {
      alignItems: 'center',
    },

    bodyInner: {
      width: '100%',
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    bodyInnerDesktop: {
      maxWidth: 1280,
      paddingHorizontal: 24,
      paddingTop: 16,
    },

    tabScroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    tabPanel: {
      width: '100%',
    },

    // -- Tabs (tech inset — alinhado às demais telas) --
    tabRow: {
      flexDirection: 'row',
      borderRadius: 14,
      padding: 4,
      marginBottom: 12,
      alignSelf: 'flex-start',
      flexGrow: 0,
      ...tabWell,
    },
    tabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: isDesktop ? 18 : 12,
      borderRadius: 10,
      marginRight: 4,
      flexShrink: 0,
      minWidth: isDesktop ? 132 : 96,
    },
    tabBtnActive: { backgroundColor: tokens.accent },
    tabBtnText: {
      color: theme.textSecondary,
      fontWeight: '600',
      fontSize: 14,
      flexShrink: 0,
    },
    tabBtnTextActive: { color: '#FFFFFF' },
    tabCount: {
      minWidth: 24,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.background,
      alignItems: 'center',
    },
    tabCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
    tabCountText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
    tabCountTextActive: { color: '#FFFFFF' },

    // -- Feedback --
    feedbackError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.errorLight,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.error + '40',
    },
    feedbackErrorText: { flex: 1, color: theme.error, fontWeight: '500', fontSize: 13 },
    feedbackSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.successLight,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.success + '40',
    },
    feedbackSuccessText: { flex: 1, color: theme.success, fontWeight: '500', fontSize: 13 },

    // -- Toolbar --
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.select({ ios: 10, default: 12 }),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      paddingVertical: 4,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    sortBtnText: { color: theme.text, fontWeight: '600', fontSize: 13 },
    toolbarAddBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: tokens.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },

    empresaMeiFilterBlock: {
      marginBottom: 12,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    empresaMeiFilterHint: {
      flex: 1,
      minWidth: 220,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSecondary,
    },
    empresaMeiFilterLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    empresaMeiFilterChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    meiFilterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
    },
    meiFilterChipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    meiStatBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: 4,
    },
    meiStatBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },

    // -- List --
    listBlock: {
      width: '100%',
    },
    listItemShell: {
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: 'stretch',
    },
    listSummary: {
      fontSize: 12,
      color: theme.textTertiary,
      marginBottom: 8,
      fontWeight: '500',
    },

    // -- User card --
    userCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 10,
    },
    userCardDesktop: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 6,
      gap: 12,
    },
    userCardDesktopMain: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    userCardDesktopBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    userMetaInline: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 2,
    },
    userCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      flexShrink: 0,
    },
    avatarCompact: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    avatarText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
    avatarTextCompact: { fontSize: 13 },
    userCardHeaderInfo: { flex: 1, minWidth: 0, gap: 2 },
    userName: { fontSize: 15, fontWeight: '700', color: theme.text },
    userEmail: { fontSize: 13, color: theme.textSecondary },
    userCardHeaderBadges: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
    },

    // -- Badges --
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

    // -- User meta --
    userMetaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      rowGap: 6,
    },
    userMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    userMetaText: { fontSize: 12.5, color: theme.textSecondary },

    // -- User actions --
    userActions: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    userActionsDesktop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    iconAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 10,
    },
    iconActionCompact: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconActionLabel: { fontSize: 12.5, fontWeight: '600' },

    // -- Password chip --
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    passwordChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.primaryLight,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    passwordLabel: { color: theme.text, fontSize: 12.5, flex: 1 },
    passwordValue: { color: theme.primary, fontWeight: '700', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
    passwordCopyBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primaryLight,
    },

    // -- Empresa card --
    empresaCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 8,
      paddingLeft: 12,
      paddingRight: 8,
      marginBottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    empresaCardMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
    },
    empresaCardActionBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    membersList: { gap: 8, marginTop: mfSpacing.md },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.backgroundMuted,
    },
    memberRowMain: { flex: 1, minWidth: 0, gap: 4 },
    memberName: { fontSize: 15, fontWeight: '600', color: theme.text },
    memberEmail: { fontSize: 13, color: theme.textSecondary },
    memberBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    empresaCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    empresaIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empresaInfo: { flex: 1, gap: 6 },
    empresaName: { fontSize: 15, fontWeight: '700', color: theme.text },
    empresaProductTag: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    empresaLimitsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    empresaLimitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    empresaLimitChipLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    empresaLimitChipValue: { fontSize: 12, color: theme.text, fontWeight: '700' },

    // -- Pagination --
    paginationRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    pageNavButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.surface,
    },
    pageNavButtonDisabled: { opacity: 0.4 },
    pageNavButtonText: { color: theme.text, fontWeight: '600', fontSize: 13 },
    paginationText: { color: theme.textSecondary, fontSize: 12.5, fontWeight: '500' },

    // -- Empty state --
    emptyState: {
      paddingVertical: 48,
      paddingHorizontal: 24,
      alignItems: 'center',
      gap: 10,
    },
    emptyIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    emptyDescription: { fontSize: 13.5, color: theme.textSecondary, textAlign: 'center' },

    // -- Loading --
    loadingContainer: { padding: 32, alignItems: 'center' },
    loadingText: { color: theme.textSecondary, fontSize: 14 },

    // -- Side Panel (drawer/modal) --
    panelOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.55)',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: isDesktop ? 'stretch' : 'flex-end',
    },
    panelBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    panel: {
      backgroundColor: theme.surface,
      flexDirection: 'column',
      zIndex: 2,
      elevation: 8,
    },
    panelDesktop: {
      width: 460,
      height: '100%',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: -8, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    panelDesktopWide: {
      width: 640,
      height: '100%',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: -8, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    panelMobile: {
      width: '100%',
      height: '92%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    panelHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
    panelSubtitle: { fontSize: 12.5, color: theme.textSecondary, marginTop: 2 },
    panelCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    panelBody: { flex: 1 },
    panelBodyContent: { padding: 20, paddingBottom: 32, gap: 4 },
    panelFooter: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.surface,
    },
    panelFooterRow: { flexDirection: 'row', gap: 10 },

    // -- Form --
    formSectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textTertiary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 8,
    },
    field: { marginBottom: 12 },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 6,
    },
    fieldRequired: { color: theme.error },
    fieldHelper: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 16,
    },
    helperText: { fontSize: 13.5, color: theme.textSecondary, lineHeight: 19, marginBottom: 10 },
    textInput: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },

    // -- Chips --
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    chipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    chipDisabled: { opacity: 0.5 },
    chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
    chipTextActive: { color: '#FFFFFF' },
    chipTextDisabled: { color: theme.textTertiary },

    // -- Selector --
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 12,
      backgroundColor: theme.inputBackground,
    },
    selectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    selectorText: { color: theme.text, fontSize: 14, fontWeight: '500', flex: 1 },

    // -- Switch row --
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: theme.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      marginBottom: 12,
    },
    switchLabel: { fontSize: 14, fontWeight: '600', color: theme.text },
    switchHelper: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },

    // -- Picker rows (modais de seleção) --
    pickerScroll: {
      maxHeight: 320,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 4,
    },
    pickerRowActive: { backgroundColor: theme.primaryLight },
    pickerRowText: { fontSize: 14, color: theme.text, fontWeight: '500' },
    pickerRowTextActive: { color: theme.primary, fontWeight: '700' },

    // -- Buttons --
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: theme.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    secondaryBtnText: { color: theme.text, fontWeight: '600', fontSize: 14 },
    dangerBtn: {
      flex: 1.5,
      backgroundColor: theme.error,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    dangerBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

    deleteConfirmBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    deleteConfirmDialog: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      padding: 24,
      alignItems: 'center',
    },
    deleteConfirmClose: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteConfirmIconBox: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    deleteConfirmTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    deleteConfirmMessage: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    deleteConfirmName: { fontWeight: '700', color: theme.text },
    deleteConfirmActions: { flexDirection: 'row', gap: 10, width: '100%' },
  });
};
