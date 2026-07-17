import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AuthPalette,
  authRadius,
  authShadows,
  authSpacing,
  authTypography,
} from './authTokens'
import { mfSpacing } from '../../lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type AuthInputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  palette: AuthPalette;
  required?: boolean;
  leftIcon?: IoniconName;
  rightIconToggle?: {
    iconWhenSecure: IoniconName;
    iconWhenVisible: IoniconName;
    accessibilityLabelShow: string;
    accessibilityLabelHide: string;
    isVisible: boolean;
    onToggle: () => void;
  };
};

export function AuthInput({
  label,
  palette,
  required,
  leftIcon,
  rightIconToggle,
  ...inputProps
}: AuthInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text
        style={[
          styles.label,
          { color: palette.labelText },
        ]}
      >
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: palette.inputBg,
            borderColor: focused ? palette.inputBorderFocus : palette.inputBorder,
          },
          focused && Platform.OS === 'web'
            ? ({ boxShadow: `${authShadows.focusRing} ${palette.inputRingFocus}` } as object)
            : null,
        ]}
      >
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={palette.inputPlaceholder}
          style={[
            styles.input,
            { color: palette.inputText },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          ]}
        />
        {rightIconToggle ? (
          <TouchableOpacity
            onPress={rightIconToggle.onToggle}
            accessibilityLabel={
              rightIconToggle.isVisible
                ? rightIconToggle.accessibilityLabelHide
                : rightIconToggle.accessibilityLabelShow
            }
            accessibilityRole="button"
            style={styles.iconButton}
          >
            <Ionicons
              name={
                rightIconToggle.isVisible
                  ? rightIconToggle.iconWhenVisible
                  : rightIconToggle.iconWhenSecure
              }
              size={18}
              color={palette.iconNeutral}
            />
          </TouchableOpacity>
        ) : leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={palette.iconNeutral}
            style={styles.iconRight}
          />
        ) : null}
      </View>
    </View>
  );
}

type AuthButtonProps = {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  palette: AuthPalette;
};

export function AuthButton({
  label,
  loadingLabel,
  loading,
  disabled,
  onPress,
  palette,
}: AuthButtonProps) {
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const bg =
    Platform.OS === 'web' && hovered && !disabled && !loading
      ? palette.primaryButtonHover
      : palette.primaryButton;

  const animateScale = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
      onHoverIn={() => {
        setHovered(true);
        if (Platform.OS === 'web') animateScale(1.02);
      }}
      onHoverOut={() => {
        setHovered(false);
        animateScale(1);
      }}
      onPressIn={() => animateScale(0.97)}
      onPressOut={() => animateScale(hovered && Platform.OS === 'web' ? 1.02 : 1)}
    >
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: bg, transform: [{ scale }] },
          (loading || disabled) && styles.buttonDisabled,
          Platform.OS === 'web'
            ? ({
                boxShadow: `0 8px 24px ${palette.inputRingFocus}`,
                cursor: loading || disabled ? 'not-allowed' : 'pointer',
              } as object)
            : null,
        ]}
      >
        {loading ? (
          <View style={styles.buttonContentRow}>
            <ActivityIndicator size="small" color={palette.primaryButtonText} />
            <Text style={[styles.buttonText, { color: palette.primaryButtonText }]}>
              {loadingLabel ?? label}
            </Text>
          </View>
        ) : (
          <Text style={[styles.buttonText, { color: palette.primaryButtonText }]}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

type AuthLinkProps = {
  label: string;
  onPress: () => void;
  palette: AuthPalette;
  align?: 'left' | 'center' | 'right';
};

export function AuthLink({ label, onPress, palette, align = 'left' }: AuthLinkProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <View
      style={{
        alignItems:
          align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null}
      >
        <Text
          style={[
            styles.link,
            {
              color: hovered ? palette.linkHoverText : palette.linkText,
              textDecorationLine: hovered ? 'underline' : 'none',
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

type AuthAlertProps = {
  kind: 'error' | 'success';
  title?: string;
  message: React.ReactNode;
  palette: AuthPalette;
};

export function AuthAlert({ kind, title, message, palette }: AuthAlertProps) {
  const bg = kind === 'error' ? palette.alertErrorBg : palette.alertSuccessBg;
  const border = kind === 'error' ? palette.alertErrorBorder : palette.alertSuccessBorder;
  const text = kind === 'error' ? palette.alertErrorText : palette.alertSuccessText;
  const titleColor = kind === 'success' ? palette.alertSuccessTitle : text;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.alert,
        { backgroundColor: bg, borderColor: border },
      ]}
    >
      {title ? (
        <Text style={[styles.alertTitle, { color: titleColor }]}>{title}</Text>
      ) : null}
      {typeof message === 'string' ? (
        <Text style={[styles.alertText, { color: text }]}>{message}</Text>
      ) : (
        <View>{message}</View>
      )}
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
  inputWrapper: {
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
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: mfSpacing.md,
    borderRadius: authRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: authSpacing.buttonMarginTop,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: authTypography.buttonSize,
    fontWeight: authTypography.buttonWeight,
  },
  link: {
    fontSize: 14,
    fontWeight: '500',
  },
  alert: {
    borderWidth: 1,
    borderRadius: authRadius.alert,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
