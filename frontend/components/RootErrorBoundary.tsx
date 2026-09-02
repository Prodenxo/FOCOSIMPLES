import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { hardReloadWithCacheBust, isDomReconciliationErrorMessage } from '@/lib/hardReload';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const isDomRace = isDomReconciliationErrorMessage(this.state.error.message);

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Não foi possível carregar o app</Text>
        <Text style={styles.message}>
          {isDomRace
            ? 'O navegador bloqueou a atualização da página (cache ou extensão). Toque em «Atualizar agora» ou use Ctrl+Shift+R. Se usa tradutor automático, desative para este site.'
            : 'Ocorreu um erro ao iniciar. Tente atualizar a página para buscar a versão mais recente do site.'}
        </Text>
        {Platform.OS === 'web' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => hardReloadWithCacheBust({ clearStorage: true })}
            style={styles.reloadBtn}
          >
            <Text style={styles.reloadBtnText}>Atualizar agora</Text>
          </Pressable>
        ) : null}
        {__DEV__ ? (
          <Text style={styles.detail}>{this.state.error.message}</Text>
        ) : null}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    textAlign: 'center',
  },
  detail: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#991B1B',
  },
  reloadBtn: {
    marginTop: 20,
    alignSelf: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  reloadBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
