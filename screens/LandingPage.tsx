import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppBrandLogo } from '@/components/shell/AppBrandLogo';
import { AppLegalFooter } from '@/components/shell/AppLegalFooter';
import {
  HeroMockupShell,
  LandingButton,
  PulseDot,
  Reveal,
} from '@/components/landing/LandingMotion';
import { APP_BRAND_NAME, APP_BRAND_TAGLINE } from '@/lib/appBrand';
import { brandColors } from '@/lib/brandTokens';

const MAX_WIDTH = 1100;
const BREAKPOINT = 768;

/** Manual v1.0 — máx. 3 cores por peça: azul, verde, branco (+ laranja só alerta). */
const C = {
  primary: brandColors.primary,
  secondary: brandColors.secondary,
  white: brandColors.background,
  surface: brandColors.surface,
  text: brandColors.textBody,
  alert: brandColors.alert,
  primaryDeep: '#071830',
  primaryMid: '#0A2248',
} as const;

const AUDIENCES = [
  {
    icon: 'briefcase-outline' as const,
    title: 'Contadores',
    tagline: 'Mais clientes no Simples. Menos esforço operacional.',
    desc: 'Controle financeiro e obrigações do Simples Nacional em um só lugar.',
  },
  {
    icon: 'school-outline' as const,
    title: 'Estudantes',
    tagline: 'Construa sua carteira antes de pegar o diploma.',
    desc: 'Atenda empresas do Simples com ferramenta profissional enquanto forma sua base.',
  },
  {
    icon: 'rocket-outline' as const,
    title: 'Empreendedores',
    tagline: 'Organize o caixa e as obrigações sem planilha.',
    desc: 'Baixa barreira de entrada para montar operação sólida no regime Simples.',
  },
];

function ProductMockup() {
  return (
    <View style={mock.wrap}>
      <View style={mock.phone}>
        <View style={mock.statusBar}>
          <Text style={mock.statusTime}>9:41</Text>
          <Ionicons name="cellular" size={11} color="rgba(255,255,255,0.45)" />
        </View>

        <Text style={mock.sectionLabel}>PAINEL FOCO SIMPLES</Text>
        <Text style={mock.metric}>R$ 12.4k</Text>
        <Text style={mock.metricHint}>saldo do mês</Text>

        <View style={mock.statsRow}>
          <View style={[mock.statCard, { backgroundColor: 'rgba(0,168,107,0.14)' }]}>
            <Text style={[mock.statValue, { color: C.secondary }]}>Em dia</Text>
            <Text style={mock.statLabel}>Obrigações</Text>
          </View>
          <View style={[mock.statCard, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={mock.statValue}>68%</Text>
            <Text style={mock.statLabel}>orçado</Text>
          </View>
        </View>

        <View style={mock.waBubble}>
          <View style={mock.waHeader}>
            <Ionicons name="swap-horizontal" size={14} color={C.secondary} />
            <Text style={mock.waTitle}>Lançamento · hoje</Text>
          </View>
          <Text style={mock.waQuote}>
            "Entrada de R$ 2.800 — serviço de consultoria."
          </Text>
          <Text style={mock.waStatus}>Registrado ✓</Text>
        </View>
      </View>
    </View>
  );
}

const mock = StyleSheet.create({
  wrap: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 4,
  },
  phone: {
    width: 272,
    backgroundColor: C.primaryMid,
    borderRadius: 20,
    padding: 20,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusTime: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '400' },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  metric: {
    color: C.white,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  metricHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 10, padding: 10 },
  statValue: { color: C.white, fontSize: 14, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, marginTop: 2, fontWeight: '400' },
  waBubble: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,168,107,0.28)',
    backgroundColor: 'rgba(0,168,107,0.08)',
    padding: 12,
    gap: 6,
  },
  waHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waTitle: { color: C.secondary, fontSize: 10, fontWeight: '800' },
  waQuote: { color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 16, fontWeight: '400' },
  waStatus: { color: C.secondary, fontSize: 10, fontWeight: '800' },
});

function useLandingCardHover() {
  const [hovered, setHovered] = React.useState(false);
  const lift = useRef(new Animated.Value(0)).current;
  const iconPop = useRef(new Animated.Value(0)).current;

  const animateHover = (next: boolean) => {
    setHovered(next);
    Animated.parallel([
      Animated.spring(lift, {
        toValue: next ? 1 : 0,
        speed: 18,
        bounciness: 8,
        useNativeDriver: true,
      }),
      Animated.spring(iconPop, {
        toValue: next ? 1 : 0,
        speed: 22,
        bounciness: 12,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return {
    hovered,
    lift,
    animateHover,
    translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }),
    scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
    iconScale: iconPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }),
    iconRotate: iconPop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] }),
    webHoverProps:
      Platform.OS === 'web'
        ? {
            onHoverIn: () => animateHover(true),
            onHoverOut: () => animateHover(false),
          }
        : {},
  };
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  desc: string;
}) {
  const {
    hovered,
    lift,
    animateHover,
    translateY,
    scale,
    iconScale,
    iconRotate,
    webHoverProps,
  } = useLandingCardHover();

  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={() => animateHover(true)}
      onPressOut={() => animateHover(false)}
      style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
      {...webHoverProps}
    >
      <Animated.View
        style={[
          glow.card,
          hovered ? glow.cardHovered : null,
          { transform: [{ translateY }, { scale }] },
        ]}
      >
        <Animated.View pointerEvents="none" style={[glow.hoverTint, { opacity: lift }]} />
        <Animated.View
          style={[
            glow.iconBox,
            hovered ? glow.iconBoxHovered : null,
            { transform: [{ scale: iconScale }, { rotate: iconRotate }], marginBottom: 18 },
          ]}
        >
          <Ionicons name={icon} size={22} color={C.secondary} />
        </Animated.View>
        <Text style={feat.title}>{title}</Text>
        <Text style={feat.desc}>{desc}</Text>
        <Animated.View
          style={[
            glow.accentBar,
            {
              opacity: lift,
              transform: [
                {
                  scaleX: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.15, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const feat = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', color: C.primary, marginBottom: 8 },
  desc: { fontSize: 14, color: C.text, lineHeight: 22, fontWeight: '400' },
});

function AudienceCard({
  icon,
  title,
  tagline,
  desc,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  tagline: string;
  desc: string;
}) {
  const {
    hovered,
    lift,
    animateHover,
    translateY,
    scale,
    iconScale,
    iconRotate,
    webHoverProps,
  } = useLandingCardHover();

  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={() => animateHover(true)}
      onPressOut={() => animateHover(false)}
      style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
      {...webHoverProps}
    >
      <Animated.View
        style={[
          glow.card,
          hovered ? glow.cardHovered : null,
          { transform: [{ translateY }, { scale }] },
        ]}
      >
        <Animated.View pointerEvents="none" style={[glow.hoverTint, { opacity: lift }]} />
        <Animated.View
          style={[
            glow.iconBox,
            hovered ? glow.iconBoxHovered : null,
            { transform: [{ scale: iconScale }, { rotate: iconRotate }] },
          ]}
        >
          <Ionicons name={icon} size={22} color={C.secondary} />
        </Animated.View>
        <Text style={aud.title}>{title}</Text>
        <Text style={aud.tagline}>{tagline}</Text>
        <Text style={aud.desc}>{desc}</Text>
        <Animated.View
          style={[
            glow.accentBar,
            {
              opacity: lift,
              transform: [
                {
                  scaleX: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.15, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const glow = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 240,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 24,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(13,43,94,0.08)',
    gap: 10,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 18px rgba(13, 43, 94, 0.06)',
          transitionProperty: 'box-shadow, border-color, background-color',
          transitionDuration: '200ms',
        } as object)
      : {
          shadowColor: C.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 2,
        }),
  },
  cardHovered: {
    borderColor: 'rgba(0,168,107,0.55)',
    backgroundColor: '#FBFFFD',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 28px 56px rgba(0, 168, 107, 0.22), 0 12px 28px rgba(13, 43, 94, 0.14)',
        } as object)
      : {
          shadowColor: C.secondary,
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.28,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  hoverTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'rgba(0,168,107,0.05)',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,168,107,0.1)',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,168,107,0.12)',
  },
  iconBoxHovered: {
    backgroundColor: 'rgba(0,168,107,0.18)',
    borderColor: 'rgba(0,168,107,0.35)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 20px rgba(0, 168, 107, 0.25)',
        } as object)
      : {}),
  },
  accentBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: C.secondary,
    ...(Platform.OS === 'web' ? ({ transformOrigin: 'left center' } as object) : {}),
  },
});

const aud = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '800', color: C.secondary, letterSpacing: 0.5 },
  tagline: { fontSize: 16, fontWeight: '800', color: C.primary, lineHeight: 22 },
  desc: { fontSize: 14, color: C.text, lineHeight: 21, fontWeight: '400' },
});

export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;

  const cx = {
    maxWidth: MAX_WIDTH,
    width: '100%' as const,
    alignSelf: 'center' as const,
    paddingHorizontal: isMobile ? 20 : 48,
  };

  const goLogin = () => router.push('/(auth)/login');
  const goRequestAccess = () => router.push('/(auth)/solicitar-acesso');

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Nav */}
      <View style={s.nav}>
        <View style={[s.navRow, cx]}>
          <Reveal delay={0} offset={12}>
            <AppBrandLogo variant="wordmark" onDarkBackground />
          </Reveal>

          <View style={[s.navActions, isMobile && s.navActionsMobile]}>
            <LandingButton
              label="Entrar"
              variant="ghost"
              compact={isMobile}
              entranceDelay={80}
              onPress={goLogin}
            />
            <LandingButton
              label="Quero ser cliente"
              variant="primary"
              compact={isMobile}
              entranceDelay={160}
              onPress={goRequestAccess}
            />
          </View>
        </View>
      </View>

      {/* Hero */}
      <View style={s.hero}>
        <View style={[s.heroInner, cx, isMobile && s.heroInnerMobile]}>
          <View style={s.heroCopy}>
            <Reveal delay={120}>
              <View style={s.pill}>
                <PulseDot />
                <Text style={s.pillText}>Tecnologia para o Simples Nacional</Text>
              </View>
            </Reveal>

            <Reveal delay={220}>
              <Text style={[s.h1, isMobile && s.h1Mobile]}>
                Finanças claras.{'\n'}Obrigações sob controle.
              </Text>
            </Reveal>

            <Reveal delay={320}>
              <Text style={s.heroSub}>{APP_BRAND_TAGLINE}</Text>
            </Reveal>

            <Reveal delay={420}>
              <Text style={s.heroBody}>
                Controle de caixa, categorias, orçamentos e recorrências — com caminho
                aberto para emissão no Simples Nacional. Feito para contadores e empresas
                que querem operar sem planilha.
              </Text>
            </Reveal>
          </View>

          {!isMobile ? (
            <HeroMockupShell style={s.heroVisual}>
              <ProductMockup />
            </HeroMockupShell>
          ) : null}
        </View>
      </View>

      {/* Métricas — manual */}
      <View style={s.strip}>
        <View style={[cx, s.stripRow, isMobile && s.stripRowMobile]}>
          {[
            { n: 'Simples', label: 'Foco no regime Simples' },
            { n: '1 lugar', label: 'Caixa + obrigações' },
            { n: 'Zero', label: 'planilha improvisada' },
          ].map((item, index) => (
            <Reveal key={item.label} delay={120 + index * 100} style={s.stripItem}>
              <Text style={s.stripN}>{item.n}</Text>
              <Text style={s.stripLabel}>{item.label}</Text>
            </Reveal>
          ))}
        </View>
      </View>

      {/* Públicos */}
      <View style={s.section}>
        <View style={cx}>
          <Reveal delay={80}>
            <Text style={s.eyebrow}>PARA QUEM</Text>
            <Text style={[s.h2, isMobile && s.h2Mobile]}>
              Quem organiza o Simples{'\n'}com método
            </Text>
          </Reveal>
          <View style={[s.grid, isMobile && s.gridMobile]}>
            {AUDIENCES.map((a, index) => (
              <Reveal key={a.title} delay={160 + index * 90} style={s.gridReveal}>
                <AudienceCard {...a} />
              </Reveal>
            ))}
          </View>
        </View>
      </View>

      {/* Diferencial */}
      <View style={[s.section, s.sectionTint]}>
        <View style={[cx, s.diffRow, isMobile && s.diffRowMobile]}>
          <Reveal delay={100} style={s.diffCopy}>
            <Text style={s.eyebrow}>DIFERENCIAL</Text>
            <Text style={[s.h2, isMobile && s.h2Mobile]}>
              Caixa e obrigações.{'\n'}No mesmo {APP_BRAND_NAME}.
            </Text>
            <Text style={s.diffBody}>
              Lançamentos, contas, categorias e orçamentos no dia a dia — com base
              pronta para as obrigações do Simples Nacional. Menos fricção, mais clareza.
            </Text>
          </Reveal>
          <Reveal delay={220} style={s.diffHighlight}>
            <Ionicons name="wallet-outline" size={28} color={C.secondary} />
            <Text style={s.diffHighlightText}>
              Financeiro operacional + caminho fiscal do Simples, sem depender de planilha.
            </Text>
          </Reveal>
        </View>
      </View>

      {/* Funcionalidades */}
      <View style={s.section}>
        <View style={cx}>
          <Reveal delay={80}>
            <Text style={s.eyebrow}>O QUE ENTREGAMOS</Text>
            <Text style={[s.h2, isMobile && s.h2Mobile]}>
              O sistema organiza o Simples.{'\n'}Você cuida do negócio.
            </Text>
          </Reveal>
          <View style={[s.grid, isMobile && s.gridMobile]}>
            {[
              {
                icon: 'swap-horizontal-outline' as const,
                title: 'Controle financeiro',
                desc: 'Lançamentos, recorrências, contas e categorias com visão clara do mês.',
              },
              {
                icon: 'pie-chart-outline' as const,
                title: 'Orçamentos e DRE',
                desc: 'Planeje por categoria e acompanhe realizado sem perder o fio.',
              },
              {
                icon: 'document-text-outline' as const,
                title: 'Base para o Simples',
                desc: 'Estrutura pronta para obrigações e emissão no Simples Nacional.',
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={160 + index * 90} style={s.gridReveal}>
                <FeatureCard {...item} />
              </Reveal>
            ))}
          </View>
        </View>
      </View>

      {/* CTA */}
      <View style={s.cta}>
        <View style={[cx, s.ctaInner]}>
          <Reveal delay={100}>
            <Text style={[s.ctaTitle, isMobile && s.h2Mobile]}>
              Mais clareza. Mais Simples. Menos esforço.
            </Text>
            <Text style={s.ctaSub}>
              Plataforma para contadores, estudantes e empreendedores que querem
              operar o Simples com governança e resultados documentados.
            </Text>
          </Reveal>
          <View style={[s.ctaBtns, isMobile && s.ctaBtnsMobile]}>
            <LandingButton
              label="Entrar"
              variant="primary"
              entranceDelay={220}
              onPress={goLogin}
            />
            <LandingButton
              label="Quero ser cliente"
              variant="ghost"
              entranceDelay={300}
              onPress={goRequestAccess}
            />
          </View>
        </View>
      </View>

      {/* Footer */}
      <AppLegalFooter />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  content: { flexGrow: 1 },

  nav: {
    backgroundColor: C.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  navActionsMobile: { gap: 8 },

  hero: { backgroundColor: C.primary, paddingVertical: 64 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  heroInnerMobile: { flexDirection: 'column', alignItems: 'flex-start' },
  heroCopy: { flex: 1, maxWidth: 560 },
  heroVisual: { flexShrink: 0, alignSelf: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(0,168,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,168,107,0.28)',
  },
  pillText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '400' },
  h1: {
    fontSize: 44,
    fontWeight: '800',
    color: C.white,
    lineHeight: 52,
    letterSpacing: -1,
    marginBottom: 16,
  },
  h1Mobile: { fontSize: 32, lineHeight: 40 },
  heroSub: {
    fontSize: 18,
    fontWeight: '800',
    color: C.secondary,
    lineHeight: 26,
    marginBottom: 12,
  },
  heroBody: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 480,
  },

  strip: {
    backgroundColor: C.primaryMid,
    paddingVertical: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  stripRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stripRowMobile: { flexDirection: 'column', gap: 24, alignItems: 'center' },
  stripItem: { alignItems: 'center', gap: 4 },
  stripN: { fontSize: 28, fontWeight: '800', color: C.secondary },
  stripLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '400', textAlign: 'center' },

  section: { paddingVertical: 72, backgroundColor: C.white },
  sectionTint: { backgroundColor: C.surface },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: C.secondary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  h2: {
    fontSize: 32,
    fontWeight: '800',
    color: C.primary,
    lineHeight: 40,
    letterSpacing: -0.4,
    marginBottom: 40,
  },
  h2Mobile: { fontSize: 26, lineHeight: 34 },
  grid: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  gridMobile: { flexDirection: 'column' },
  gridReveal: { flex: 1, minWidth: 240 },

  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  diffRowMobile: { flexDirection: 'column' },
  diffCopy: { flex: 1 },
  diffBody: { fontSize: 15, color: C.text, lineHeight: 24, fontWeight: '400', maxWidth: 520 },
  diffHighlight: {
    flex: 1,
    minWidth: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,168,107,0.22)',
    backgroundColor: 'rgba(0,168,107,0.08)',
    padding: 24,
    gap: 12,
  },
  diffHighlightText: { fontSize: 15, color: C.primary, lineHeight: 22, fontWeight: '400' },

  cta: { backgroundColor: C.primary, paddingVertical: 72 },
  ctaInner: { alignItems: 'center' },
  ctaTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: C.white,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  ctaSub: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 560,
  },
  ctaBtns: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  ctaBtnsMobile: { flexDirection: 'column', width: '100%', maxWidth: 320, alignItems: 'stretch' },
});
