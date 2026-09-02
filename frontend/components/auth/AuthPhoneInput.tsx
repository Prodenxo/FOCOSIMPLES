import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import {
  AuthPalette,
  authRadius,
  authSpacing,
  authTypography,
} from './authTokens';

type AuthPhoneInputProps = {
  label: string;
  palette: AuthPalette;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  isDarkMode?: boolean;
};

/**
 * Phone input internacional:
 *  - web: react-phone-input-2 (com country selector + máscara automática)
 *  - native: TextInput plano com keyboard phone-pad
 */
export function AuthPhoneInput(props: AuthPhoneInputProps) {
  if (Platform.OS === 'web') {
    return <WebPhoneInput {...props} />;
  }
  return <NativePhoneInput {...props} />;
}

function WebPhoneInput({
  label,
  palette,
  required,
  value,
  onChange,
  hasError,
  isDarkMode,
}: AuthPhoneInputProps) {
  // Lazy require — react-phone-input-2 só existe em ambiente web (DOM).
  const PhoneInput = require('react-phone-input-2').default;
  require('react-phone-input-2/lib/style.css');

  return (
    <View>
      <Text style={[styles.label, { color: palette.labelText }]}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <PhoneInput
        country={'br'}
        value={value ?? ''}
        onChange={onChange}
        enableSearch
        containerStyle={{
          width: '100%',
        }}
        inputStyle={{
          width: '100%',
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 48,
          paddingRight: 16,
          borderRadius: authRadius.input,
          border: `1px solid ${hasError ? '#F43F5E' : palette.inputBorder}`,
          fontSize: authTypography.inputSize,
          backgroundColor: hasError
            ? isDarkMode
              ? 'rgba(76,5,25,0.30)'
              : 'rgba(255,241,242,0.75)'
            : palette.inputBg,
          color: palette.inputText,
          boxSizing: 'border-box',
          outline: 'none',
          lineHeight: 1.5,
          height: 44,
        }}
        buttonStyle={{
          border: 'none',
          background: 'transparent',
          paddingLeft: 8,
          color: palette.iconNeutral,
        }}
        dropdownStyle={{
          color: palette.titleText,
          backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
        }}
        placeholder="(11) 999999999"
      />
    </View>
  );
}

function NativePhoneInput({
  label,
  palette,
  required,
  value,
  onChange,
  hasError,
}: AuthPhoneInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={[styles.label, { color: palette.labelText }]}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.wrapper,
          {
            backgroundColor: palette.inputBg,
            borderColor: hasError
              ? '#F43F5E'
              : focused
                ? palette.inputBorderFocus
                : palette.inputBorder,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Ex.: 11999999999"
          keyboardType="phone-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={palette.inputPlaceholder}
          style={[styles.input, { color: palette.inputText }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: authTypography.labelSize,
    fontWeight: authTypography.labelWeight,
    marginBottom: authSpacing.labelMarginBottom,
  },
  requiredMark: {
    color: '#EF4444',
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: authRadius.input,
    paddingHorizontal: authSpacing.inputPaddingH,
  },
  input: {
    flex: 1,
    paddingVertical: authSpacing.inputPaddingV,
    fontSize: authTypography.inputSize,
    fontWeight: authTypography.inputWeight,
  },
});
