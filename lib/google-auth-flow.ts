import * as WebBrowser from 'expo-web-browser';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import { getGoogleAuthUrl, checkGoogleAuth, handleGoogleCallback } from './google-calendar';
import { buildGoogleOAuthReturnTo } from './google-calendar-oauth-return';
import { useAppToastStore } from '../store/appToastStore';
import { useGoogleCalendarStore } from '../store/googleCalendarStore';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { logger } from './logger';

function isWebOAuthReturnUrl(url: string): boolean {
  return url.includes('googleCalendar=connected') || url.includes('googleCalendar=error');
}

function getAuthSessionReturnUrl(result: WebBrowserAuthSessionResult): string | undefined {
  return result.type === 'success' ? result.url : undefined;
}

// Configurar WebBrowser para fechar automaticamente após autenticação
WebBrowser.maybeCompleteAuthSession();

// Contador para evitar recursão infinita
let authFlowAttempts = 0;
const MAX_AUTH_ATTEMPTS = 3;

/**
 * Verifica periodicamente se a autenticação foi concluída
 * @param intervalMs Intervalo entre verificações em milissegundos (padrão: 2000ms)
 * @param maxDurationMs Duração máxima do polling em milissegundos (padrão: 60000ms = 60s)
 * @param onStop Callback para parar o polling (retorna true para parar)
 * @returns Promise<boolean> true se autenticado, false se timeout
 */
async function pollForAuthentication(
  intervalMs: number = 2000,
  maxDurationMs: number = 60000,
  onStop?: () => boolean
): Promise<boolean> {
  logger.debug('[AUTH] Iniciando polling de autenticação...');
  logger.debug('[AUTH] Intervalo:', intervalMs, 'ms, Duração máxima:', maxDurationMs, 'ms');
  
  const startTime = Date.now();
  let pollCount = 0;
  
  return new Promise((resolve) => {
    const pollInterval = setInterval(async () => {
      pollCount++;
      const elapsed = Date.now() - startTime;
      
      // Verificar se deve parar (deep link processado, etc)
      if (onStop && onStop()) {
        logger.debug('[AUTH] Polling interrompido por callback');
        clearInterval(pollInterval);
        resolve(false);
        return;
      }
      
      // Verificar timeout
      if (elapsed >= maxDurationMs) {
        logger.debug('[AUTH] Polling atingiu timeout após', pollCount, 'tentativas');
        clearInterval(pollInterval);
        resolve(false);
        return;
      }
      
      logger.debug('[AUTH] Polling verificação', pollCount, '- Tempo decorrido:', Math.round(elapsed / 1000), 's');
      const isAuthenticated = await checkGoogleAuth();
      
      if (isAuthenticated) {
        logger.debug('[AUTH] Autenticação confirmada durante polling após', pollCount, 'tentativas');
        clearInterval(pollInterval);
        resolve(true);
        return;
      }
      
      logger.debug('[AUTH] Ainda não autenticado, continuando polling...');
    }, intervalMs);
    
    // Verificação inicial imediata
    setTimeout(async () => {
      const isAuthenticated = await checkGoogleAuth();
      if (isAuthenticated) {
        logger.debug('[AUTH] Autenticação confirmada na verificação inicial');
        clearInterval(pollInterval);
        resolve(true);
      }
    }, 1000);
  });
}

/**
 * Inicia o fluxo de autenticação OAuth do Google Calendar
 */
/** `null` = redirect web em andamento (mesma aba; a página recarrega). */
export async function startGoogleAuthFlow(): Promise<boolean | null> {
  authFlowAttempts++;
  logger.debug('[AUTH] Iniciando fluxo de autenticação Google (tentativa', authFlowAttempts, '/', MAX_AUTH_ATTEMPTS, ')');
  
  if (authFlowAttempts > MAX_AUTH_ATTEMPTS) {
    authFlowAttempts = 0;
    Alert.alert('Erro', 'Número máximo de tentativas excedido.');
    return false;
  }
  
  let subscription: { remove: () => void } | null = null;

  try {
    logger.debug('[AUTH] Verificando se já está autenticado...');
    const isAuthenticated = await checkGoogleAuth();
    logger.debug('[AUTH] Resultado da verificação:', isAuthenticated ? 'AUTENTICADO' : 'NÃO AUTENTICADO');
    if (isAuthenticated) {
      return true;
    }

    logger.debug('[AUTH] Obtendo URL de autorização...');
    const webReturnTo = buildGoogleOAuthReturnTo();
    const authData = await getGoogleAuthUrl(webReturnTo);
    const authUrl = authData.authUrl;
    logger.debug('[AUTH] URL de autorização obtida:', authUrl ? 'SIM' : 'NÃO');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      logger.debug('[AUTH] Web: redirect na mesma aba (sem popup)');
      window.location.assign(authUrl);
      return null;
    }

    const sessionReturnUri = 'financas-pessoais://google-callback';
    logger.debug('[AUTH] URI de retorno da sessão OAuth:', sessionReturnUri);
    
    // Função para processar deep link quando capturado
    const handleDeepLinkCallback = async (url: string): Promise<boolean> => {
      logger.debug('[AUTH] Processando deep link callback:', url);
      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const state = urlObj.searchParams.get('state');
        const success = urlObj.searchParams.get('success');
        const errorParam = urlObj.searchParams.get('error');
        logger.debug('[AUTH] Deep link - Code:', code ? 'SIM' : 'NÃO', 'State:', state ? 'SIM' : 'NÃO', 'Success:', success, 'Error:', errorParam);

        if (errorParam) {
          logger.debug('[AUTH] Erro no deep link callback:', errorParam);
          Alert.alert('Erro', 'Não foi possível conectar o Google Calendar.');
          return false;
        }
        
        if (code) {
          try {
            logger.debug('[AUTH] Chamando handleGoogleCallback com código...');
            await handleGoogleCallback(code, state || undefined);
            logger.debug('[AUTH] handleGoogleCallback concluído, verificando autenticação...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const isAuthenticated = await checkGoogleAuth();
            logger.debug('[AUTH] Autenticação após callback:', isAuthenticated ? 'SIM' : 'NÃO');
            if (isAuthenticated) {
              Alert.alert('Sucesso', 'Google Calendar conectado.');
              return true;
            }
          } catch (error: any) {
            logger.error('[AUTH] Erro ao processar callback:', error.message);
            if (error.message?.includes('401') || error.message?.includes('Missing authorization')) {
              logger.debug('[AUTH] Erro 401 detectado, aguardando e verificando novamente...');
              await new Promise(resolve => setTimeout(resolve, 3000));
              const isAuthenticated = await checkGoogleAuth();
              logger.debug('[AUTH] Autenticação após erro 401:', isAuthenticated ? 'SIM' : 'NÃO');
              if (isAuthenticated) {
                Alert.alert('Sucesso', 'Google Calendar conectado.');
                return true;
              }
            }
          }
        } else if (success === 'true') {
          logger.debug('[AUTH] Deep link com success=true, verificando autenticação...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          const isAuthenticated = await checkGoogleAuth();
          logger.debug('[AUTH] Autenticação após success=true:', isAuthenticated ? 'SIM' : 'NÃO');
          if (isAuthenticated) {
            Alert.alert('Sucesso', 'Google Calendar conectado.');
            return true;
          }
        }
      } catch (error) {
        logger.error('[AUTH] Erro ao processar deep link:', error);
      }
      
      return false;
    };
    
    // Criar listener para capturar deep link
    let deepLinkProcessed = false;
    let deepLinkResult: boolean | null = null;
    const listener = async ({ url }: { url: string }) => {
      logger.debug('[AUTH] Listener recebeu URL:', url);
      // Ignorar URLs do Expo Go
      if (url.startsWith('exp://') || url.startsWith('exps://')) {
        logger.debug('[AUTH] Ignorando URL do Expo Go');
        return;
      }
      
      // Capturar deep link do callback
      if (url.startsWith('financas-pessoais://google-callback')) {
        logger.debug('[AUTH] Deep link do callback capturado pelo listener');
        WebBrowser.dismissBrowser();
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        deepLinkProcessed = true;
        deepLinkResult = await handleDeepLinkCallback(url);
      } 
      // Capturar URL HTTP do callback (caso o WebBrowser capture diretamente)
      else if (url.includes('/google-calendar/callback') && url.includes('code=')) {
        logger.debug('[AUTH] URL HTTP do callback capturada pelo listener');
        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const state = urlObj.searchParams.get('state');
          if (code) {
            WebBrowser.dismissBrowser();
            if (subscription) {
              subscription.remove();
              subscription = null;
            }
            deepLinkProcessed = true;
            deepLinkResult = await handleDeepLinkCallback(`financas-pessoais://google-callback?code=${code}${state ? `&state=${state}` : ''}`);
          }
        } catch (e) {
          logger.error('[AUTH] Erro ao processar URL HTTP:', e);
        }
      } else if (isWebOAuthReturnUrl(url)) {
        logger.debug('[AUTH] Retorno web capturado pelo listener');
        WebBrowser.dismissBrowser();
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        deepLinkProcessed = true;
        deepLinkResult = url.includes('googleCalendar=connected');
      } else {
        logger.debug('[AUTH] URL não é do callback, ignorando');
      }
    };
    
    logger.debug('[AUTH] Registrando listener do Linking...');
    subscription = Linking.addEventListener('url', listener);
    logger.debug('[AUTH] Listener registrado');
    
    logger.debug('[AUTH] Abrindo WebBrowser.openAuthSessionAsync...');
    logger.debug('[AUTH] Auth URL:', authUrl);
    logger.debug('[AUTH] Return URI:', sessionReturnUri);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, sessionReturnUri);
    const returnUrl = getAuthSessionReturnUrl(result);
    logger.debug('[AUTH] WebBrowser retornou - Tipo:', result.type, 'URL:', returnUrl || 'NENHUMA');

    if (returnUrl && isWebOAuthReturnUrl(returnUrl)) {
      logger.debug('[AUTH] Retorno web após OAuth:', returnUrl);
      try {
        WebBrowser.dismissBrowser();
      } catch {
        /* já fechado */
      }
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
      const ok = returnUrl.includes('googleCalendar=connected');
      if (ok) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const verified = await checkGoogleAuth();
        if (verified) {
          useGoogleCalendarStore.getState().notifyConnectionChanged();
          useAppToastStore.getState().show('Google Agenda vinculada com sucesso!', 'success');
          authFlowAttempts = 0;
          return true;
        }
      }
      authFlowAttempts = 0;
      return false;
    }
    
    // Se o WebBrowser interceptou o deep link de callback (sucesso esperado — native)
    if (returnUrl) {
      logger.debug('[AUTH] WebBrowser retornou success com URL:', returnUrl);
      if (returnUrl.startsWith('financas-pessoais://google-callback')) {
        try {
          const urlObj = new URL(returnUrl);
          const errorParam = urlObj.searchParams.get('error');
          const success = urlObj.searchParams.get('success');
          logger.debug('[AUTH] Deep link interceptado - success:', success, 'error:', errorParam);

          if (errorParam) {
            logger.debug('[AUTH] Erro no callback:', errorParam);
            if (subscription) { subscription.remove(); subscription = null; }
            authFlowAttempts = 0;
            Alert.alert('Erro', 'Não foi possível conectar o Google Calendar.');
            return false;
          }

          if (success === 'true') {
            // Tokens já foram salvos pela Edge Function; apenas confirmar
            await new Promise(resolve => setTimeout(resolve, 1000));
            const isAuthenticated = await checkGoogleAuth();
            logger.debug('[AUTH] Autenticação após deep link:', isAuthenticated ? 'SIM' : 'NÃO');
            if (isAuthenticated) {
              if (subscription) { subscription.remove(); subscription = null; }
              Alert.alert('Sucesso', 'Google Calendar conectado.');
              authFlowAttempts = 0;
              return true;
            }
          }
        } catch (error: any) {
          logger.error('[AUTH] Erro ao processar deep link do WebBrowser:', error);
        }
      }
    }
    
    // Aguardar um pouco para dar tempo do listener processar o deep link
    if (deepLinkProcessed) {
      logger.debug('[AUTH] Deep link foi processado, aguardando resultado...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (deepLinkResult === true) {
        logger.debug('[AUTH] Deep link processado com sucesso');
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        authFlowAttempts = 0;
        return true;
      }
    }
    
    // Se o navegador foi aberto ou fechado sem capturar URL, iniciar polling
    if (result.type === 'opened' || (result.type === 'dismiss' && !deepLinkProcessed)) {
      logger.debug('[AUTH] Navegador', result.type === 'opened' ? 'aberto' : 'fechado', 'sem URL capturada. Iniciando polling...');
      
      // Iniciar polling em background
      const pollingResult = await pollForAuthentication(
        2000, // Verificar a cada 2 segundos
        2000, // Por até 2 segundos
        () => deepLinkProcessed // Parar se deep link for processado
      );
      
      if (pollingResult) {
        logger.debug('[AUTH] Autenticação confirmada via polling');
        // Fechar navegador se ainda estiver aberto
        try {
          WebBrowser.dismissBrowser();
        } catch {
          // Ignorar erro se navegador já estiver fechado
        }
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        Alert.alert('Sucesso', 'Google Calendar conectado.');
        authFlowAttempts = 0;
        return true;
      }
      
      // Se polling não confirmou autenticação, verificar uma última vez
      logger.debug('[AUTH] Polling não confirmou autenticação, verificando uma última vez...');
      const finalCheck = await checkGoogleAuth();
      if (finalCheck) {
        logger.debug('[AUTH] Autenticação confirmada na verificação final');
        try {
          WebBrowser.dismissBrowser();
        } catch {
          // Ignorar erro se navegador já estiver fechado
        }
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        Alert.alert('Sucesso', 'Google Calendar conectado.');
        authFlowAttempts = 0;
        return true;
      }
      
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
      
      authFlowAttempts = 0;
      logger.debug('[AUTH] Falha na autenticação após polling');
      Alert.alert('Erro', 'Não foi possível conectar o Google Calendar.');
      return false;
    }
    
    // Se foi cancelado, apenas verificar uma vez
    if (result.type === 'cancel') {
      logger.debug('[AUTH] Navegador cancelado pelo usuário');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isAuthenticated = await checkGoogleAuth();
      logger.debug('[AUTH] Autenticação após cancelamento:', isAuthenticated ? 'SIM' : 'NÃO');
      if (isAuthenticated) {
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        Alert.alert('Sucesso', 'Google Calendar conectado.');
        authFlowAttempts = 0;
        return true;
      }
      
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
      
      authFlowAttempts = 0;
      Alert.alert('Erro', 'Não foi possível conectar o Google Calendar.');
      return false;
    }
    
    // Se deep link foi processado mas não retornou true, verificar autenticação
    if (deepLinkProcessed && deepLinkResult === false) {
      logger.debug('[AUTH] Deep link processado mas retornou false, verificando autenticação...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isAuthenticated = await checkGoogleAuth();
      logger.debug('[AUTH] Autenticação após deep link false:', isAuthenticated ? 'SIM' : 'NÃO');
      if (isAuthenticated) {
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        Alert.alert('Sucesso', 'Google Calendar conectado.');
        authFlowAttempts = 0;
        return true;
      }
    }
    
    // Garantir que subscription seja removida antes de retornar
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
    
    authFlowAttempts = 0;
    Alert.alert('Erro', 'Não foi possível conectar o Google Calendar.');
    return false;
  } catch (error: any) {
    logger.error('Erro no fluxo de autenticação:', error);
    // Garantir que subscription seja removida em caso de erro
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
    // Reset contador em caso de erro
    authFlowAttempts = 0;
    Alert.alert(
      'Erro',
      error?.message || 'Erro ao autenticar com o Google Calendar.',
    );
    return false;
  }
}

/**
 * Solicita ao usuário se deseja conectar o Google Calendar
 */
export async function promptGoogleAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Conectar Google Calendar',
      'Para criar eventos automaticamente no Google Calendar quando você criar transações "A receber" ou "A pagar", é necessário autorizar o acesso ao seu calendário.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Conectar',
          onPress: async () => {
            const success = await startGoogleAuthFlow();
            resolve(success === true);
          },
        },
      ]
    );
  });
}

