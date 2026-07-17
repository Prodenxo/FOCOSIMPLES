import React from 'react';
import { useRouter } from 'expo-router';
import { RegisterAuthForm } from '@/screens/auth/RegisterAuthForm';

export default function RegisterScreen() {
  const router = useRouter();
  return (
    <RegisterAuthForm
      onGoToLogin={() => router.back()}
    />
  );
}
