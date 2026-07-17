import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
  onStartActivation: () => void
  onGoToApp: () => void
}

export default function OnboardingScreen ({ onStartActivation, onGoToApp }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="rocket" size={72} color="#2563EB" />
        </View>
        <Text style={styles.title}>Vamos deixar sua conta pronta em poucos minutos</Text>
        <Text style={styles.description}>
          Você pode pular e voltar depois pelas configurações.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.buttonPrimary}
          onPress={onStartActivation}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Começar ativação"
        >
          <Text style={styles.buttonPrimaryText}>Começar ativação</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={onGoToApp}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Ir direto ao app"
        >
          <Text style={styles.buttonSecondaryText}>Ir direto ao app</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 152,
    height: 152,
    borderRadius: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  buttonSecondary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  buttonSecondaryText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
})
