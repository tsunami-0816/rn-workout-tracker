import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { AppError, errorText } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../store/toastStore';
import { BrandLine } from '../components/BrandMark';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from '../theme/tokens';
import { isValidPhone } from '../utils/format';

export function LoginScreen(): React.JSX.Element {
  const signIn = useAuthStore((state) => state.signIn);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  const phoneValid = useMemo(() => isValidPhone(phone), [phone]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = useMutation({
    mutationFn: (value: string) => api.sendCode(value),
    onSuccess: (data) => {
      setCooldown(data.cooldown > 0 ? data.cooldown : 60);
      setCodeError(null);
      showToast('验证码已发送', 'success');
    },
    onError: (error) => {
      if (error instanceof AppError && error.code === 42901) {
        setCooldown(60);
      }
      showToast(errorText(error), 'error');
    }
  });

  const login = useMutation({
    mutationFn: (input: { phone: string; code: string }) => api.login(input.phone, input.code),
    onSuccess: async (data) => {
      await signIn(data.token, data.user);
    },
    onError: (error) => {
      const text = errorText(error);
      if (error instanceof AppError && error.code === 40102) {
        setCodeError(text);
        return;
      }
      showToast(text, 'error');
    }
  });

  const requestCode = (): void => {
    if (!phoneValid) {
      setPhoneError('请输入 11 位有效手机号');
      return;
    }
    setPhoneError(null);
    sendCode.mutate(phone);
  };

  const submit = (): void => {
    if (!phoneValid) {
      setPhoneError('请输入 11 位有效手机号');
      return;
    }
    if (code.length !== 6) {
      setCodeError('请输入 6 位验证码');
      return;
    }
    setPhoneError(null);
    setCodeError(null);
    login.mutate({ phone, code });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandLine subtitle="记录 · 分化训练 · 每周回看" />

          <View style={styles.intro}>
            <Text style={styles.headline}>把每一组都记下来，{'\n'}进步才有据可查。</Text>
            <Text style={styles.support}>
              手机号免注册登录。训练记录只属于你自己；管理员只读全站汇总，不改任何人的数据。
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>手机号</Text>
            <TextInput
              value={phone}
              onChangeText={(value) => {
                setPhone(value.replace(/\D/g, '').slice(0, 11));
                setPhoneError(null);
              }}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
              placeholder="13900139000"
              placeholderTextColor={colors.inkFaint}
              keyboardType="number-pad"
              maxLength={11}
              style={[styles.input, phoneFocused && styles.inputFocused, phoneError && styles.inputError]}
              accessibilityLabel="手机号"
              autoComplete="tel"
            />
            {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

            <Text style={styles.fieldLabel}>验证码</Text>
            <View style={styles.codeRow}>
              <TextInput
                value={code}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, '').slice(0, 6));
                  setCodeError(null);
                }}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                placeholder="6 位数字"
                placeholderTextColor={colors.inkFaint}
                keyboardType="number-pad"
                maxLength={6}
                style={[
                  styles.input,
                  styles.codeInput,
                  codeFocused && styles.inputFocused,
                  codeError && styles.inputError
                ]}
                accessibilityLabel="验证码"
                autoComplete="one-time-code"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="获取验证码"
                accessibilityState={{ disabled: cooldown > 0 || !phoneValid || sendCode.isPending }}
                onPress={cooldown > 0 || !phoneValid || sendCode.isPending ? undefined : requestCode}
                style={[
                  styles.codeButton,
                  (cooldown > 0 || !phoneValid) && styles.codeButtonDisabled
                ]}
              >
                <Text style={styles.codeButtonText}>
                  {cooldown > 0 ? `重新获取 ${cooldown}s` : sendCode.isPending ? '发送中…' : '获取验证码'}
                </Text>
              </Pressable>
            </View>
            {codeError ? <Text style={styles.fieldError}>{codeError}</Text> : null}

            <AppButton
              label="登录"
              onPress={submit}
              loading={login.isPending}
              disabled={!phoneValid || code.length !== 6}
              style={styles.submit}
            />

            <Text style={styles.hint}>
              演示验证码以服务端 .env 的 DEMO_CODE 为准（不会写进客户端代码）。
            </Text>
          </View>

          <Text style={styles.footnote}>
            连接地址：{Platform.OS === 'web' ? '本机 8094' : '自动匹配开发机 8094'} · 超时 8s · 登录态存于设备安全区
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: { marginTop: spacing.xl, gap: spacing.sm },
  headline: {
    color: colors.ink,
    fontSize: fontSize.display,
    lineHeight: 40,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.8
  },
  support: { color: colors.inkMuted, fontSize: fontSize.body, lineHeight: 24, maxWidth: 560 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs
  },
  fieldLabel: {
    color: colors.inkMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    marginTop: spacing.sm
  },
  input: {
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: fontSize.body + 1
  },
  inputFocused: { borderColor: colors.accent },
  inputError: { borderColor: colors.danger },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeInput: { flex: 1 },
  codeButton: {
    minHeight: touchTarget + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 132
  },
  codeButtonDisabled: { opacity: 0.5 },
  codeButtonText: { color: colors.accent, fontSize: fontSize.label, fontWeight: fontWeight.semibold },
  fieldError: { color: colors.danger, fontSize: fontSize.label, marginTop: 2 },
  submit: { marginTop: spacing.lg },
  hint: { color: colors.inkMuted, fontSize: fontSize.meta, lineHeight: 18, marginTop: spacing.sm },
  footnote: { color: colors.inkFaint, fontSize: fontSize.meta, lineHeight: 18 }
});
