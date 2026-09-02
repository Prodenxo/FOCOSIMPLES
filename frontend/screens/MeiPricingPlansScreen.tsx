import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { AppBrandLogo } from '@/components/shell/AppBrandLogo'
import { AppLegalFooter } from '@/components/shell/AppLegalFooter'
import { MfScrollView } from '@/components/ui/MfScrollView'
import { brandColors } from '@/lib/brandTokens'
import {
  MEI_PUBLIC_PACKAGES,
  type MeiPublicPackage,
} from '@/lib/meiBillingPricing'
import {
  createSelfServeMeiCheckout,
  fetchMeiBillingStatus,
} from '@/services/billingService'
import { useAppToastStore } from '@/store/appToastStore'
import { useAuthStore } from '@/store/authStore'

const NAVY = brandColors.primary
const GREEN = brandColors.secondary
const PAGE_BG = '#EEF2F7'
const CARD_BG = '#FFFFFF'

const formatBrl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })

const formatUnit = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Tabela de preços FocoMEI (arte oficial) + Checkout Stripe.
 */
export default function MeiPricingPlansScreen () {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ stripe_mei?: string }>()
  const showToast = useAppToastStore((s) => s.show)
  const signOut = useAuthStore((s) => s.signOut)
  const userEmail = useAuthStore((s) => s.user?.email?.trim() || '')
  const [loadingSlots, setLoadingSlots] = useState<number | null>(null)
  const [checking, setChecking] = useState(true)
  const [packages, setPackages] = useState<readonly MeiPublicPackage[]>(
    MEI_PUBLIC_PACKAGES,
  )

  const isWide = width >= 720
  const styles = useMemo(() => createStyles(isWide), [isWide])

  const refreshGate = useCallback(async () => {
    setChecking(true)
    try {
      const status = await fetchMeiBillingStatus()
      if (status.packages?.length) {
        setPackages(status.packages as MeiPublicPackage[])
      }
      if (!status.required) {
        router.replace('/(app)/' as never)
        return
      }
    } catch {
      /* tabela local */
    } finally {
      setChecking(false)
    }
  }, [router])

  useEffect(() => {
    void refreshGate()
  }, [refreshGate])

  useEffect(() => {
    if (params.stripe_mei === 'success') {
      showToast('Pagamento recebido! Liberando seu acesso…', 'success')
      const t = setTimeout(() => {
        void refreshGate()
      }, 1500)
      return () => clearTimeout(t)
    }
    if (params.stripe_mei === 'cancel') {
      showToast('Checkout cancelado. Escolha um plano quando quiser.', 'info')
    }
  }, [params.stripe_mei, refreshGate, showToast])

  const handleSelect = async (pack: MeiPublicPackage) => {
    setLoadingSlots(pack.meiSlots)
    try {
      const data = await createSelfServeMeiCheckout(pack.meiSlots)
      const url = data.checkoutUrl
      if (!url) throw new Error('Checkout sem URL')
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url
        return
      }
      await WebBrowser.openBrowserAsync(url)
      await refreshGate()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Não foi possível abrir o Checkout',
        'error',
      )
    } finally {
      setLoadingSlots(null)
    }
  }

  if (checking) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.bootHint}>Carregando planos…</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <MfScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        hideLegalFooter
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <AppBrandLogo variant="wordmark" onDarkBackground height={36} />
            <Pressable
              onPress={() => void signOut().then(() => router.replace('/(auth)/login' as never))}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
              style={styles.signOutChip}
            >
              <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={styles.signOutText}>Sair</Text>
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>Tabela de Preços</Text>
          <Text style={styles.heroSub}>
            Planos por quantidade de CNPJs MEI contratados
          </Text>
          <View style={styles.heroAccent} />
          {userEmail ? (
            <Text style={styles.heroEmail}>Logado como {userEmail}</Text>
          ) : null}
        </View>

        <View style={styles.mid}>
          <Text style={styles.midHint}>
            Toque em um plano para ir ao pagamento seguro (Stripe).
          </Text>

          <View style={styles.list}>
            {packages.map((pack) => {
              const busy = loadingSlots === pack.meiSlots
              const featured = Boolean(pack.featured)
              const badge =
                featured && 'badge' in pack && typeof pack.badge === 'string'
                  ? pack.badge
                  : null

              return (
                <Pressable
                  key={pack.meiSlots}
                  onPress={() => void handleSelect(pack)}
                  disabled={loadingSlots !== null}
                  style={({ pressed }) => [
                    styles.card,
                    featured ? styles.cardFeatured : null,
                    pressed ? styles.cardPressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Assinar ${pack.label} por ${formatBrl(pack.total)} ao mês`}
                >
                  {badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardBody}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.slotsNum}>{pack.meiSlots}</Text>
                      <Text style={styles.slotsLabel}>CNPJs MEI</Text>
                    </View>

                    <View style={styles.cardRight}>
                      <View style={styles.priceRow}>
                        <Text style={styles.price}>{formatBrl(pack.total)}</Text>
                        <Text style={styles.pricePeriod}>/mês</Text>
                      </View>
                      <Text style={styles.unitPrice}>
                        {formatUnit(pack.unit)} / CNPJ
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.cta,
                      featured ? styles.ctaFeatured : null,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color={featured ? '#FFFFFF' : NAVY} />
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.ctaText,
                            featured ? styles.ctaTextFeatured : null,
                          ]}
                        >
                          Assinar agora
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color={featured ? '#FFFFFF' : NAVY}
                        />
                      </>
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.footerBand}>
          <Text style={styles.footerLine}>
            <Text style={styles.footerSlogan}>O sistema cuida do MEI. </Text>
            <Text style={styles.footerSloganAccent}>Você cuida do lucro.</Text>
          </Text>
          <Text style={styles.footerMeta}>
            focomei.com.br  ·  @focomei.oficial
          </Text>
        </View>

        <AppLegalFooter />
      </MfScrollView>
    </View>
  )
}

function createStyles (isWide: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: PAGE_BG },
    centered: { alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1, backgroundColor: NAVY },
    bootHint: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1 },

    hero: {
      backgroundColor: NAVY,
      paddingTop: 28,
      paddingBottom: 36,
      paddingHorizontal: isWide ? 40 : 20,
      alignItems: 'center',
    },
    heroTop: {
      width: '100%',
      maxWidth: 640,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 28,
    },
    signOutChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    signOutText: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 13,
      fontWeight: '600',
    },
    heroTitle: {
      fontSize: isWide ? 34 : 28,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    heroSub: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: '400',
      color: 'rgba(255,255,255,0.72)',
      textAlign: 'center',
      maxWidth: 400,
      lineHeight: 22,
    },
    heroAccent: {
      marginTop: 18,
      width: 56,
      height: 4,
      borderRadius: 2,
      backgroundColor: GREEN,
    },
    heroEmail: {
      marginTop: 16,
      fontSize: 12,
      color: 'rgba(255,255,255,0.45)',
    },

    mid: {
      backgroundColor: PAGE_BG,
      paddingTop: 28,
      paddingBottom: 40,
      paddingHorizontal: isWide ? 40 : 16,
      flexGrow: 1,
    },
    midHint: {
      textAlign: 'center',
      fontSize: 13,
      color: 'rgba(13, 43, 94, 0.55)',
      marginBottom: 20,
      fontWeight: '500',
    },
    list: {
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
      gap: 16,
    },

    card: {
      backgroundColor: CARD_BG,
      borderRadius: 18,
      paddingTop: 22,
      paddingBottom: 16,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: 'rgba(13, 43, 94, 0.08)',
      shadowColor: '#0D2B5E',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
      elevation: 3,
      position: 'relative',
      overflow: 'visible',
    },
    cardFeatured: {
      borderWidth: 2,
      borderColor: GREEN,
      shadowOpacity: 0.12,
    },
    cardPressed: { transform: [{ scale: 0.992 }], opacity: 0.96 },
    badge: {
      position: 'absolute',
      top: -11,
      right: 18,
      backgroundColor: GREEN,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      zIndex: 2,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    cardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    cardLeft: { flexShrink: 0 },
    slotsNum: {
      fontSize: isWide ? 42 : 36,
      fontWeight: '800',
      color: NAVY,
      letterSpacing: -1.2,
      lineHeight: isWide ? 46 : 40,
    },
    slotsLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: 'rgba(13, 43, 94, 0.5)',
      marginTop: 2,
    },
    cardRight: { alignItems: 'flex-end', flex: 1 },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    price: {
      fontSize: isWide ? 28 : 24,
      fontWeight: '800',
      color: NAVY,
      letterSpacing: -0.4,
    },
    pricePeriod: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(13, 43, 94, 0.45)',
    },
    unitPrice: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '700',
      color: GREEN,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: 'rgba(13, 43, 94, 0.06)',
      borderWidth: 1,
      borderColor: 'rgba(13, 43, 94, 0.1)',
      minHeight: 44,
    },
    ctaFeatured: {
      backgroundColor: GREEN,
      borderColor: GREEN,
    },
    ctaText: {
      fontSize: 14,
      fontWeight: '700',
      color: NAVY,
    },
    ctaTextFeatured: {
      color: '#FFFFFF',
    },

    footerBand: {
      backgroundColor: NAVY,
      paddingVertical: 40,
      paddingHorizontal: 24,
      alignItems: 'center',
      gap: 10,
    },
    footerLine: {
      textAlign: 'center',
      maxWidth: 420,
    },
    footerSlogan: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    footerSloganAccent: {
      fontSize: 17,
      fontWeight: '700',
      color: GREEN,
    },
    footerMeta: {
      marginTop: 8,
      fontSize: 12,
      color: 'rgba(255,255,255,0.4)',
      letterSpacing: 0.2,
    },
  })
}
