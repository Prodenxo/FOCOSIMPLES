import React from 'react';
import { View, StyleSheet } from 'react-native';
import { getDashboardCanvasStyle } from '../../lib/glassStyles';

type Props = {
  isDarkMode: boolean;
};

/** Fundo do dashboard (gradiente no web). */
export function DashboardCanvasBackground({ isDarkMode }: Props) {
  return <View style={[StyleSheet.absoluteFill, getDashboardCanvasStyle(isDarkMode)]} pointerEvents="none" />;
}
