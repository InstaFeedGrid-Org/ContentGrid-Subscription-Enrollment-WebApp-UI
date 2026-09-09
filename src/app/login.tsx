import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { login, signup } from '@/lib/api';

type AuthMode = 'login' | 'signup';

type AuthForm = {
  name: string;
  email: string;
  password: string;
};

type AuthErrors = Partial<Record<keyof AuthForm, string>>;

const initialForm: AuthForm = {
  name: '',
  email: '',
  password: '',
};

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const theme = useTheme();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<AuthMode>(params.mode === 'signup' ? 'signup' : 'login');
  const [form, setForm] = useState<AuthForm>(initialForm);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = mode === 'signup';

  function updateField(field: keyof AuthForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrors({});
  }

  async function submit() {
    const nextErrors: AuthErrors = {};

    if (isSignUp && !form.name.trim()) {
      nextErrors.name = 'Enter your name.';
    }

    if (!isValidEmail(form.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (form.password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const session = isSignUp
        ? await signup(form.name.trim(), form.email.trim(), form.password)
        : await login(form.email.trim(), form.password);
      signIn(session);
      router.replace('/');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">{isSignUp ? 'Create your account' : 'Welcome back'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {isSignUp ? 'Sign up to access your publisher workspace.' : 'Log in to your publisher workspace.'}
          </ThemedText>

          <View style={styles.segmentedControl}>
            <ModeButton active={!isSignUp} label="Log in" onPress={() => selectMode('login')} />
            <ModeButton active={isSignUp} label="Sign up" onPress={() => selectMode('signup')} />
          </View>

          {isSignUp && (
            <AuthField
              error={errors.name}
              label="Name"
              onChangeText={(value) => updateField('name', value)}
              placeholder="Your name"
              value={form.name}
            />
          )}
          <AuthField
            error={errors.email}
            label="Email"
            onChangeText={(value) => updateField('email', value)}
            placeholder="you@example.com"
            value={form.email}
          />
          <AuthField
            error={errors.password}
            label="Password"
            onChangeText={(value) => updateField('password', value)}
            placeholder="At least 8 characters"
            secureTextEntry
            value={form.password}
          />

          {submitError && <ThemedText style={styles.validationError}>{submitError}</ThemedText>}
          <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={submit} style={[styles.submitButton, isSubmitting && styles.buttonMuted]}>
            {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <ThemedText style={styles.submitButtonText}>{isSignUp ? 'Sign up' : 'Log in'}</ThemedText>}
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

function AuthField({
  error,
  label,
  onChangeText,
  placeholder,
  secureTextEntry,
  value,
}: {
  error?: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        autoCapitalize="none"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6F82A8"
        secureTextEntry={secureTextEntry}
        style={[styles.input, error && styles.inputInvalid]}
        value={value}
      />
      {error && <ThemedText style={styles.validationError}>{error}</ThemedText>}
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}>
      <ThemedText type="smallBold" style={active ? styles.modeButtonTextActive : styles.modeButtonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  safeArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    borderRadius: Spacing.two,
    gap: Spacing.three,
    maxWidth: 460,
    padding: Spacing.four,
    width: '100%',
  },
  segmentedControl: {
    backgroundColor: '#D6E5FF',
    borderRadius: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: Spacing.one,
    flex: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  modeButtonActive: { backgroundColor: '#185ABC' },
  modeButtonText: { color: '#31527F' },
  modeButtonTextActive: { color: '#ffffff' },
  field: { gap: Spacing.two },
  input: {
    borderColor: '#9DB7E8',
    borderRadius: Spacing.two,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputInvalid: { borderColor: '#D14343' },
  validationError: { color: '#B42318', fontSize: 13 },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#185ABC',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.four,
  },
  submitButtonText: { color: '#ffffff', fontWeight: 700 },
  buttonMuted: { opacity: 0.65 },
});
