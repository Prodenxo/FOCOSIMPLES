import React, { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MfGlassCard } from '../ui/MfGlassCard'
import { mfRadius, mfSpacing, mfTypography, type Theme } from '../../lib/theme'
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign'
import { ActivationEyebrow } from './activationUi'
import type { ActivationStep } from '../../services/activationService'

type Props = {
  steps: ActivationStep[]
  theme: Theme
  isDarkMode: boolean
  onStepPress: (step: ActivationStep) => void
  /** Sem card externo — lista embutida no painel pai. */
  embedded?: boolean
}

type IonName = React.ComponentProps<typeof Ionicons>['name']

const STEP_ICONS: Record<string, IonName> = {
  profile_name: 'person-outline',
  phone_whatsapp: 'logo-whatsapp',
  first_account: 'wallet-outline',
  first_transaction: 'swap-horizontal-outline',
  first_budget: 'pie-chart-outline',
  google_calendar: 'calendar-outline',
  mei_certificate: 'document-attach-outline',
  mei_das_view: 'receipt-outline',
  mei_nfse_catalog: 'people-outline',
}

function resolveIcon (stepId: string): IonName {
  return STEP_ICONS[stepId] ?? 'ellipse-outline'
}

function StepRow ({
  step,
  theme,
  isDarkMode,
  isCompact,
  onStepPress,
  showDivider,
}: {
  step: ActivationStep
  theme: Theme
  isDarkMode: boolean
  isCompact: boolean
  onStepPress: (step: ActivationStep) => void
  showDivider: boolean
}) {
  const tokens = getTechTokens(isDarkMode)
  const done = step.status === 'completed'
  const iconName = done ? 'checkmark-circle' : resolveIcon(step.id)

  const cta = !done ? (
    <Pressable
      onPress={() => onStepPress(step)}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: tokens.accent,
          opacity: pressed ? 0.88 : 1,
          alignSelf: isCompact ? 'stretch' : 'center',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Fazer agora: ${step.title}`}
    >
      <Text
        style={[
          styles.actionBtnText,
          { color: isDarkMode ? '#030508' : '#ffffff' },
        ]}
      >
        Fazer agora
      </Text>
      <Ionicons
        name="arrow-forward"
        size={16}
        color={isDarkMode ? '#030508' : '#ffffff'}
      />
    </Pressable>
  ) : null

  return (
    <View
      style={[
        styles.stepWrap,
        showDivider && { borderBottomWidth: 1, borderBottomColor: tokens.divider },
        done && styles.stepDone,
      ]}
    >
      <View style={[styles.stepRow, isCompact && styles.stepRowCompact]}>
        <View
          style={[
            styles.iconWell,
            mfTechInsetSurface(isDarkMode, !done),
            done && { borderColor: tokens.accentMuted },
          ]}
        >
          <Ionicons
            name={iconName}
            size={22}
            color={done ? tokens.accent : theme.textSecondary}
          />
        </View>
        <View style={styles.stepBody}>
          <Text
            style={[
              styles.stepTitle,
              { color: theme.text },
              done && { color: theme.textSecondary },
            ]}
          >
            {step.title}
          </Text>
          {!done && step.description ? (
            <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
              {step.description}
            </Text>
          ) : done ? (
            <Text style={[styles.stepDoneLabel, { color: tokens.accent }]}>
              Concluído
            </Text>
          ) : null}
        </View>
        {!isCompact ? cta : null}
      </View>
      {isCompact ? <View style={styles.compactCta}>{cta}</View> : null}
    </View>
  )
}

function StepSection ({
  eyebrow,
  steps,
  theme,
  isDarkMode,
  isCompact,
  onStepPress,
  showTopBorder,
}: {
  eyebrow: string
  steps: ActivationStep[]
  theme: Theme
  isDarkMode: boolean
  isCompact: boolean
  onStepPress: (step: ActivationStep) => void
  showTopBorder?: boolean
}) {
  if (steps.length === 0) return null
  const tokens = getTechTokens(isDarkMode)

  return (
    <View
      style={[
        styles.section,
        showTopBorder && {
          borderTopWidth: 1,
          borderTopColor: tokens.divider,
          marginTop: mfSpacing.sm,
        },
      ]}
    >
      <ActivationEyebrow label={eyebrow} isDarkMode={isDarkMode} style={styles.sectionEyebrow} />
      {steps.map((step, index) => (
        <StepRow
          key={step.id}
          step={step}
          theme={theme}
          isDarkMode={isDarkMode}
          isCompact={isCompact}
          onStepPress={onStepPress}
          showDivider={index < steps.length - 1}
        />
      ))}
    </View>
  )
}

export function ActivationStepList ({
  steps,
  theme,
  isDarkMode,
  onStepPress,
  embedded = false,
}: Props) {
  const { width } = useWindowDimensions()
  const isCompact = width < 560

  const groups = useMemo(() => {
    const core = steps.filter((s) => s.required)
    const optional = steps.filter((s) => !s.required && !s.id.startsWith('mei_'))
    const mei = steps.filter((s) => s.id.startsWith('mei_'))
    return { core, optional, mei }
  }, [steps])

  const hasCore = groups.core.length > 0
  const hasOptional = groups.optional.length > 0
  const hasMei = groups.mei.length > 0

  const list = (
    <>
      <StepSection
        eyebrow="Essencial"
        steps={groups.core}
        theme={theme}
        isDarkMode={isDarkMode}
        isCompact={isCompact}
        onStepPress={onStepPress}
      />
      <StepSection
        eyebrow="Recomendado"
        steps={groups.optional}
        theme={theme}
        isDarkMode={isDarkMode}
        isCompact={isCompact}
        onStepPress={onStepPress}
        showTopBorder={hasCore && hasOptional}
      />
      <StepSection
        eyebrow="Para MEI"
        steps={groups.mei}
        theme={theme}
        isDarkMode={isDarkMode}
        isCompact={isCompact}
        onStepPress={onStepPress}
        showTopBorder={(hasCore || hasOptional) && hasMei}
      />
    </>
  )

  if (embedded) {
    return <View style={styles.embedded}>{list}</View>
  }

  return (
    <MfGlassCard padding="none" intensity="strong" techVariant="surface">
      {list}
    </MfGlassCard>
  )
}

const styles = StyleSheet.create({
  embedded: {
    paddingTop: mfSpacing.xs,
  },
  section: {
    paddingTop: mfSpacing.md,
    paddingBottom: mfSpacing.sm,
  },
  sectionEyebrow: {
    marginHorizontal: mfSpacing.md,
    marginBottom: mfSpacing.sm,
  },
  stepWrap: {
    paddingHorizontal: mfSpacing.md,
    paddingVertical: mfSpacing.md,
  },
  stepDone: {
    opacity: 0.88,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.md,
  },
  stepRowCompact: {
    alignItems: 'flex-start',
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: mfRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    ...mfTypography.bodyStrong,
  },
  stepDesc: {
    ...mfTypography.caption,
    marginTop: mfSpacing.xs,
    lineHeight: 18,
  },
  stepDoneLabel: {
    ...mfTypography.caption,
    marginTop: mfSpacing.xs,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.xs,
    paddingHorizontal: mfSpacing.md,
    paddingVertical: mfSpacing.sm,
    borderRadius: mfRadius.md,
    flexShrink: 0,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  compactCta: {
    marginTop: mfSpacing.sm,
    paddingLeft: 44 + mfSpacing.md,
  },
})
