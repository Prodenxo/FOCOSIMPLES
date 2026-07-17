import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RegisterAuthForm } from './RegisterAuthForm';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
};

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

/** Ecrã legado para stack; o fluxo principal usa `AuthNavigator` + `RegisterAuthForm`. */
export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  return <RegisterAuthForm onGoToLogin={() => navigation.navigate('Login')} />;
}
