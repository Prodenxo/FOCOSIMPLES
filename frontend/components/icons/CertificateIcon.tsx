import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type Props = { size: number; color: string };

export function CertificateIcon({ size, color }: Props) {
  return <Ionicons name="ribbon-outline" size={size} color={color} />;
}
