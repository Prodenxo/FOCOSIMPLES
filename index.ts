import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

import App from './App';

// Habilitar todos os logs no terminal
if (__DEV__) {
  // Mostrar todos os warnings e erros
  LogBox.ignoreAllLogs(false);
  
  // Interceptar console.log para garantir que apareçam
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    originalLog(...args);
  };
  
  const originalError = console.error;
  console.error = (...args: any[]) => {
    originalError(...args);
  };
  
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    originalWarn(...args);
  };
  
  console.log('=== APP INICIADO - LOGS HABILITADOS ===');
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
