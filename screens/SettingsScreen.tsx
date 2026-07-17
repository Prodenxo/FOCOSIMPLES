import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import { useRouter } from "expo-router";
import { SETTINGS_ROUTES } from "../lib/settingsRoutes";
import { hasRole, normalizeRoleValue, type UserRole } from "../lib/auth-roles";
import { useThemeStore } from "../store/themeStore";
import { getTheme } from "../lib/theme";
import { startGoogleAuthFlow } from "../lib/google-auth-flow";
import { checkGoogleAuth, disconnectGoogleAuth } from "../lib/google-calendar";
import { supabase } from "../lib/supabase";
import { phonesMatch, normalizePhoneDigits, getBrazilPhoneValidationError } from "../lib/internationalPhone";
import { getErrorMessage } from "../lib/errors";
import { logger } from "../lib/logger";
import { useNavigationDrawer } from "../lib/navigationContext";
import {
  MfConfirmDialog,
  type MfConfirmDialogVariant,
} from "../components/ui/MfConfirmDialog";
import { MfScrollView } from "../components/ui/MfScrollView";
import { useGoogleCalendarStore } from "../store/googleCalendarStore";
import { useAppToastStore } from "../store/appToastStore";
import { ActivationSettingsEntry } from "../components/activation/ActivationSettingsEntry";
import { SitePageShell } from "../components/onboarding/SitePageShell";
import { getSiteTokens, siteHeadingStyle, siteLeadStyle } from "../lib/siteDesign";
import {
  SettingsSectionCard,
  SETTINGS_PAGE_MAX_WIDTH,
} from "../components/settings/settingsUi";
import { SettingsProfileField } from "../components/settings/SettingsProfileField";
import { SettingsPhoneField } from "../components/settings/SettingsPhoneField";
import { SettingsActionLink } from "../components/settings/SettingsActionLink";
import { SignOutHeaderButton } from "../components/settings/SignOutHeaderButton";
import { MfAppHeader } from "../components/ui/MfAppHeader";
import { useMfTheme } from "../components/ui/useMfTheme";
import { mfRadius, mfSpacing } from "../lib/theme";

const DESKTOP_BREAKPOINT = 900;

type GoogleDialogState =
  | { kind: "disconnect-confirm" }
  | { kind: "disconnect-success" }
  | { kind: "disconnect-error"; message: string }
  | { kind: "connect-success" }
  | { kind: "connect-error"; message: string }
  | null;

export default function SettingsScreen() {
  const { user, phone, displayName, updatePhone, updateDisplayName } =
    useAuthStore();
  const { isDarkMode, preference, setPreference } = useThemeStore();
  const { isDarkMode: mfDark } = useMfTheme();
  const { openDrawer, hasGlobalNav } = useNavigationDrawer();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= DESKTOP_BREAKPOINT;
  const isNarrow = windowWidth < 380;
  const [phoneInput, setPhoneInput] = useState<string>(phone || "");
  const [displayNameInput, setDisplayNameInput] = useState<string>(
    displayName || "",
  );
  const [emailInput, setEmailInput] = useState<string>(user?.email || "");
  const [savingPhone, setSavingPhone] = useState<boolean>(false);
  const [savingDisplayName, setSavingDisplayName] = useState<boolean>(false);
  const [savingEmail, setSavingEmail] = useState<boolean>(false);
  const [googleAgendaIntegrated, setGoogleAgendaIntegrated] =
    useState<boolean>(false);
  const [checkingIntegration, setCheckingIntegration] = useState<boolean>(true);
  const router = useRouter();
  const [resolvedRole, setResolvedRole] = useState<UserRole | null>(null);
  const [googleDialog, setGoogleDialog] = useState<GoogleDialogState>(null);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const siteTokens = useMemo(() => getSiteTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, siteTokens, isDesktop, isDarkMode),
    [theme, siteTokens, isDesktop, isDarkMode],
  );
  const webWithTopNav = hasGlobalNav && Platform.OS === "web";

  const trimmedEmailInput = emailInput.trim();
  const normalizedEmailInput = trimmedEmailInput.toLowerCase();
  const normalizedCurrentEmail = (user?.email || "").trim().toLowerCase();
  const showEmailChangeWarning = useMemo(
    () =>
      trimmedEmailInput.length > 0 &&
      normalizedEmailInput !== normalizedCurrentEmail,
    [trimmedEmailInput, normalizedEmailInput, normalizedCurrentEmail],
  );
  const emailChangeWarningText = showEmailChangeWarning
    ? `Ao salvar, enviaremos um link de confirmação para ${trimmedEmailInput}. O e-mail só passa a valer após você clicar no link.`
    : "";

  useEffect(() => {
    setPhoneInput(phone || "");
  }, [phone]);

  useEffect(() => {
    setDisplayNameInput(displayName || "");
  }, [displayName]);

  useEffect(() => {
    setEmailInput(user?.email || "");
  }, [user?.email]);

  useEffect(() => {
    checkGoogleAgendaIntegration();
  }, [user]);

  const showAppToast = useAppToastStore((s) => s.show);
  const googleConnectionVersion = useGoogleCalendarStore((s) => s.connectionVersion);

  useEffect(() => {
    void checkGoogleAgendaIntegration();
  }, [googleConnectionVersion]);

  useEffect(() => {
    const loadRoleFromLink = async () => {
      if (!user?.id) {
        setResolvedRole(null);
        return;
      }

      const { data: linkData, error: linkError } = await supabase
        .from("role_x_user_x_empresa")
        .select("roles_id, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: sessionData } = await supabase.auth.getSession();
      logger.debug("[Roles] session:", {
        sessionUserId: sessionData?.session?.user?.id || null,
        expiresAt: sessionData?.session?.expires_at || null,
      });

      logger.debug("[Roles] role_x_user_x_empresa:", {
        userId: user.id,
        roles_id: linkData?.roles_id || null,
        status: linkData?.status ?? null,
      });

      if (linkError) {
        logger.warn("Erro ao buscar role_x_user_x_empresa:", linkError.message);
        setResolvedRole(null);
        return;
      }

      if (!linkData?.roles_id || linkData?.status === false) {
        setResolvedRole(null);
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("roles")
        .select("roles")
        .eq("id", linkData.roles_id)
        .maybeSingle();

      logger.debug("[Roles] roles lookup:", {
        roles_id: linkData.roles_id,
        roles: roleData?.roles || null,
      });

      if (roleError) {
        logger.warn("Erro ao buscar role:", roleError.message);
        setResolvedRole(null);
        return;
      }

      const normalizedRole = normalizeRoleValue(roleData?.roles);
      logger.debug("[Roles] role normalizado:", normalizedRole);
      setResolvedRole(normalizedRole);
    };

    loadRoleFromLink();
  }, [user?.id]);

  const checkGoogleAgendaIntegration = async () => {
    setCheckingIntegration(true);
    try {
      if (!user) {
        setGoogleAgendaIntegrated(false);
        return;
      }
      const integrated = await checkGoogleAuth();
      setGoogleAgendaIntegrated(integrated);
    } catch (error) {
      console.error("Erro ao verificar integração:", error);
      setGoogleAgendaIntegrated(false);
    } finally {
      setCheckingIntegration(false);
    }
  };

  const handleAuthorizeGoogle = async () => {
    try {
      if (!user) {
        Alert.alert(
          "Login Necessário",
          "Você precisa fazer login no app antes de autorizar o acesso ao Google Calendar. Por favor, faça login primeiro.",
          [{ text: "OK" }],
        );
        return;
      }

      const success = await startGoogleAuthFlow();

      if (success === null) {
        return;
      }

      if (success) {
        setGoogleAgendaIntegrated(true);
        useGoogleCalendarStore.getState().notifyConnectionChanged();
        await checkGoogleAgendaIntegration();
        showAppToast("Google Agenda vinculada com sucesso!", "success");
      } else {
        Alert.alert(
          "Erro",
          "Não foi possível autorizar o acesso ao Google Calendar. Por favor, tente novamente.",
          [{ text: "OK" }],
        );
      }
    } catch (error: any) {
      console.error("Erro ao autorizar Google Agenda:", error);
      Alert.alert(
        "Erro",
        error.message ||
          "Erro ao autorizar Google Calendar. Por favor, tente novamente.",
        [{ text: "OK" }],
      );
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleDialog({ kind: "disconnect-confirm" });
  };

  const performDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    try {
      await disconnectGoogleAuth();
      setGoogleAgendaIntegrated(false);
      useGoogleCalendarStore.getState().notifyConnectionChanged();
      setGoogleDialog({ kind: "disconnect-success" });
    } catch (error: unknown) {
      console.error("Erro ao desfazer integração:", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Erro ao desconectar Google Calendar. Por favor, tente novamente.";
      setGoogleDialog({ kind: "disconnect-error", message: msg });
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const closeGoogleDialog = () => {
    if (disconnectingGoogle) return;
    setGoogleDialog(null);
  };

  const googleDialogVariant: MfConfirmDialogVariant =
    googleDialog?.kind === "disconnect-confirm"
      ? "confirm"
      : googleDialog?.kind === "disconnect-success" ||
          googleDialog?.kind === "connect-success"
        ? "success"
        : googleDialog?.kind === "disconnect-error" ||
            googleDialog?.kind === "connect-error"
          ? "error"
          : "info";

  const googleDialogTitle = (() => {
    switch (googleDialog?.kind) {
      case "disconnect-confirm":
        return "Desconectar Google Agenda?";
      case "disconnect-success":
        return "Desconectado";
      case "disconnect-error":
        return "Não foi possível desconectar";
      case "connect-success":
        return "Google Agenda conectada";
      case "connect-error":
        return "Falha na conexão";
      default:
        return "";
    }
  })();

  const googleDialogMessage = (() => {
    switch (googleDialog?.kind) {
      case "disconnect-confirm":
        return "Seus compromissos no app deixam de sincronizar com o Google Calendar. Você pode conectar de novo quando quiser.";
      case "disconnect-success":
        return "A integração com Google Calendar foi removida desta conta.";
      case "disconnect-error":
        return googleDialog.message;
      case "connect-success":
        return "Sua conta Google foi vinculada. Compromissos criados no app podem aparecer no seu calendário.";
      case "connect-error":
        return googleDialog.message;
      default:
        return "";
    }
  })();

  const resolvePhoneSaveError = (error: unknown): string => {
    const code = (error as { code?: string })?.code;
    if (code === "PHONE_ALREADY_LINKED") {
      return "Este número de WhatsApp já está em outra conta. Entre na conta certa ou peça ao suporte para desvincular.";
    }
    const message = getErrorMessage(error);
    if (message && message !== "{}") return message;
    return "Erro ao salvar telefone. Por favor, tente novamente.";
  };

  const handleSavePhone = async () => {
    const digits = normalizePhoneDigits(phoneInput);
    if (!digits || digits.length < 10) {
      showAppToast("Por favor, insira um número de telefone válido.", "error");
      return;
    }

    const brError = getBrazilPhoneValidationError(digits);
    if (brError) {
      showAppToast(brError, "error");
      return;
    }

    setSavingPhone(true);
    try {
      await updatePhone(digits);
      showAppToast("Telefone salvo com sucesso!", "success");
    } catch (error: unknown) {
      console.error("Erro ao salvar telefone:", error);
      showAppToast(resolvePhoneSaveError(error), "error");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!displayNameInput.trim()) {
      Alert.alert("Atenção", "Por favor, insira um nome válido.");
      return;
    }

    setSavingDisplayName(true);
    try {
      await updateDisplayName(displayNameInput.trim());
      Alert.alert("Sucesso", "Nome atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar nome:", error);
      Alert.alert(
        "Erro",
        error.message || "Erro ao salvar nome. Por favor, tente novamente.",
      );
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleSaveEmail = async () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert("Atenção", "Por favor, insira um e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert("Atenção", "E-mail inválido.");
      return;
    }
    if (trimmed === (user?.email || "").trim().toLowerCase()) {
      Alert.alert("Atenção", "Informe um e-mail diferente do atual.");
      return;
    }

    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      Alert.alert(
        "Confirmação enviada",
        `Enviamos um link de confirmação para ${trimmed}. O e-mail só passa a valer após você clicar no link.`,
      );
    } catch (error: any) {
      console.error("Erro ao alterar e-mail:", error);
      Alert.alert(
        "Erro",
        error?.message || "Erro ao alterar e-mail. Por favor, tente novamente.",
      );
    } finally {
      setSavingEmail(false);
    }
  };

  const handleOpenWhatsapp = async () => {
    const whatsappUrl = "https://wa.me/5521974526796";
    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (!supported) {
        Alert.alert(
          "WhatsApp indisponível",
          "Não foi possível abrir o WhatsApp neste dispositivo.",
        );
        return;
      }
      await Linking.openURL(whatsappUrl);
    } catch (error) {
      console.error("Erro ao abrir WhatsApp:", error);
      Alert.alert(
        "Erro",
        "Não foi possível abrir o WhatsApp. Tente novamente.",
      );
    }
  };

  const handleOpenSupportGroup = async () => {
    const groupUrl = "https://chat.whatsapp.com/G0F3SaEFfvNI066k5MYKDT";
    try {
      const supported = await Linking.canOpenURL(groupUrl);
      if (!supported) {
        Alert.alert(
          "WhatsApp indisponível",
          "Não foi possível abrir o WhatsApp neste dispositivo.",
        );
        return;
      }
      await Linking.openURL(groupUrl);
    } catch (error) {
      console.error("Erro ao abrir grupo de suporte:", error);
      Alert.alert(
        "Erro",
        "Não foi possível abrir o grupo de suporte. Tente novamente.",
      );
    }
  };

  const settingsBody = (
    <>
      {hasGlobalNav ? (
        <View style={styles.pageHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.neonDot, { backgroundColor: siteTokens.neon, shadowColor: siteTokens.neon }]} />
            <Text style={[siteHeadingStyle, styles.pageTitle, { color: siteTokens.textPrimary }]}>
              Configurações
            </Text>
          </View>
          <Text style={[siteLeadStyle, { color: siteTokens.textSecondary }]}>
            Perfil, integrações e preferências da sua conta.
          </Text>
        </View>
      ) : null}

      <ActivationSettingsEntry />

      <View style={styles.settingsStack}>
          <SettingsSectionCard
            title="Perfil"
            description="Atualize seus dados de acesso"
            style={styles.sectionFull}
          >
            <SettingsProfileField
              label="Nome"
              placeholder="Como quer ser chamado no app"
              value={displayNameInput}
              onChangeText={setDisplayNameInput}
              onSave={handleSaveDisplayName}
              saving={savingDisplayName}
              disabled={displayNameInput.trim() === (displayName || "").trim()}
              inputProps={{ autoComplete: "name" }}
            />

            <SettingsPhoneField
              label="Telefone"
              value={phoneInput}
              onChange={setPhoneInput}
              onSave={handleSavePhone}
              saving={savingPhone}
              disabled={phonesMatch(phoneInput, phone)}
            />

            <SettingsProfileField
              label="E-mail"
              placeholder="email@exemplo.com"
              value={emailInput}
              onChangeText={setEmailInput}
              onSave={handleSaveEmail}
              saving={savingEmail}
              saveLabel="Alterar e-mail"
              savingLabel="Enviando…"
              disabled={
                !emailInput.trim() ||
                emailInput.trim().toLowerCase() === normalizedCurrentEmail
              }
              hint={showEmailChangeWarning ? emailChangeWarningText : undefined}
              isLast
              inputProps={{
                keyboardType: "email-address",
                autoCapitalize: "none",
                autoCorrect: false,
                autoComplete: "email",
              }}
            />
          </SettingsSectionCard>

          {hasRole(resolvedRole, ["admin"]) ? (
            <SettingsSectionCard
              title="Equipe"
              description="Gerenciamento de usuários e permissões"
              style={styles.sectionFull}
            >
                <SettingsActionLink
                  title="Gerenciar usuários"
                  description="Convites, papéis e bloqueios"
                  icon="people-outline"
                  onPress={() => router.push(SETTINGS_ROUTES.usuarios)}
                />
                {resolvedRole === "superadmin" ? (
                  <SettingsActionLink
                    title="Solicitações de acesso"
                    description="Aprovar novos pedidos de entrada"
                    icon="shield-checkmark-outline"
                    onPress={() => router.push(SETTINGS_ROUTES.solicitacoes)}
                  />
                ) : null}
            </SettingsSectionCard>
          ) : null}

          <SettingsSectionCard
            title="Google Agenda"
            description="Sincronize pagamentos e compromissos no calendário"
            style={isDesktop ? styles.sectionHalf : styles.sectionFull}
          >
            {checkingIntegration ? (
              <Text style={styles.loadingText}>
                Verificando integração...
              </Text>
            ) : !googleAgendaIntegrated ? (
              <TouchableOpacity
                onPress={handleAuthorizeGoogle}
                accessibilityRole="button"
                accessibilityLabel="Conectar Google Agenda"
                style={{ paddingVertical: 4 }}
              >
                <Text style={[styles.linkAction, { color: siteTokens.neon }]}>
                  Conectar com Google
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.integrationStatus}>
                <View style={styles.statusRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={theme.success}
                  />
                  <Text style={styles.statusText}>Conectado</Text>
                </View>
                <TouchableOpacity onPress={handleDisconnectGoogle}>
                  <Text style={[styles.linkDanger, { color: siteTokens.textSecondary }]}>
                    Desconectar
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Aparência"
            style={isDesktop ? styles.sectionHalf : styles.sectionFull}
          >
            <View style={styles.themeOptions}>
              {[
                {
                  value: "light",
                  label: "Claro",
                  icon: "sunny-outline" as const,
                },
                {
                  value: "system",
                  label: "Automático",
                  icon: "contrast-outline" as const,
                },
                {
                  value: "dark",
                  label: "Escuro",
                  icon: "moon-outline" as const,
                },
              ].map((opt) => {
                const selected = preference === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() =>
                      void setPreference(
                        opt.value as "light" | "dark" | "system",
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected }}
                    style={[
                      styles.themeOption,
                      isNarrow && styles.themeOptionNarrow,
                      selected && styles.themeOptionSelected,
                      selected && {
                        borderColor: siteTokens.neonBorder,
                        backgroundColor: siteTokens.neonDim,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={selected ? siteTokens.neon : siteTokens.textSecondary}
                    />
                    {!isNarrow ? (
                      <Text
                        style={[
                          styles.themeOptionLabel,
                          {
                            color: selected ? siteTokens.textPrimary : siteTokens.textSecondary,
                            fontWeight: selected ? "500" : "400",
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Suporte"
            description="Ajuda humana e comunidade"
            style={styles.sectionFull}
          >
            <SettingsActionLink
              title="Fale com o Agente"
              description="WhatsApp do consultor pessoal"
              icon="logo-whatsapp"
              onPress={() => void handleOpenWhatsapp()}
            />
            <SettingsActionLink
              title="Grupo de suporte"
              description="Tire dúvidas com outros usuários"
              icon="chatbubbles-outline"
              onPress={() => void handleOpenSupportGroup()}
              accessibilityLabel="Entrar no grupo de suporte do WhatsApp"
            />
          </SettingsSectionCard>
      </View>
    </>
  );

  return (
    <SitePageShell
      isDarkMode={mfDark}
      maxWidth={SETTINGS_PAGE_MAX_WIDTH}
      noHorizontalPad={webWithTopNav}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {!hasGlobalNav ? (
          <MfAppHeader
            title="Configurações"
            subtitle="Preferências e integrações"
            onMenuPress={openDrawer}
            right={<SignOutHeaderButton />}
          />
        ) : null}

        <MfScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            webWithTopNav ? styles.scrollContentWebNav : null,
          ]}
        >
          {settingsBody}
        </MfScrollView>

      <MfConfirmDialog
        visible={googleDialog !== null}
        variant={googleDialogVariant}
        confirmIntent={
          googleDialog?.kind === "disconnect-confirm" ? "danger" : "primary"
        }
        iconName={
          googleDialog?.kind === "disconnect-confirm"
            ? "unlink-outline"
            : googleDialog?.kind === "connect-success"
              ? "logo-google"
              : undefined
        }
        title={googleDialogTitle}
        message={googleDialogMessage}
        confirmLabel={
          googleDialog?.kind === "disconnect-confirm"
            ? "Desconectar"
            : "Entendi"
        }
        cancelLabel="Cancelar"
        loading={disconnectingGoogle}
        onConfirm={
          googleDialog?.kind === "disconnect-confirm"
            ? () => void performDisconnectGoogle()
            : undefined
        }
        onCancel={closeGoogleDialog}
      />

      </SafeAreaView>
    </SitePageShell>
  );
}

const createStyles = (
  theme: ReturnType<typeof getTheme>,
  siteTokens: ReturnType<typeof getSiteTokens>,
  isDesktop: boolean,
  isDarkMode: boolean,
) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      minHeight: 0,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      gap: mfSpacing.md,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.lg,
    },
    scrollContentWebNav: {
      paddingHorizontal: mfSpacing.md,
    },
    pageHeader: {
      marginBottom: mfSpacing.lg,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      marginBottom: 4,
    },
    neonDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 0 12px rgba(59, 130, 246, 0.65)' } as object)
        : { shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }),
    },
    pageTitle: {
      marginBottom: 0,
    },
    settingsStack: {
      width: '100%',
      gap: mfSpacing.md,
      ...(isDesktop
        ? {
            flexDirection: 'row' as const,
            flexWrap: 'wrap' as const,
            alignItems: 'stretch' as const,
            justifyContent: 'space-between' as const,
          }
        : {
            flexDirection: 'column' as const,
          }),
    },
    sectionFull: {
      width: '100%',
      flexGrow: 0,
      flexShrink: 0,
    },
    sectionHalf: {
      width: isDesktop ? '48.5%' : '100%',
      minWidth: isDesktop ? 280 : undefined,
      flexGrow: 0,
      flexShrink: 0,
    },
    loadingText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    linkAction: {
      fontSize: 14,
      fontWeight: '500',
    },
    linkDanger: {
      fontSize: 13,
      fontWeight: '500',
    },
    integrationStatus: {
      gap: 8,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusText: {
      fontSize: 14,
      color: theme.text,
      fontWeight: "500",
    },
    disconnectButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.error,
    },
    appearanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    appearanceInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    appearanceLabel: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "500",
    },
    themeOptions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    themeOption: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: mfRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: siteTokens.inputBorder,
      backgroundColor: siteTokens.inputBg,
    },
    themeOptionSelected: {
      borderWidth: 1,
    },
    themeOptionNarrow: {
      paddingVertical: 12,
      paddingHorizontal: 0,
      gap: 0,
    },
    themeOptionLabel: {
      fontSize: 13,
    },
  });
