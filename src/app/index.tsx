import { useEffect, useState, type ChangeEvent } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { createPost, ensureInstagramAccount, publishPost, uploadAsset } from '@/lib/api';

type PublishResult = {
  ok: boolean;
  dryRun?: boolean;
  message: string;
  instagramMediaId?: string;
  receivedAt?: string;
  uploadedFile?: {
    name: string;
    type: string;
    size: number;
  };
};

type FormState = {
  instagramUserId: string;
  mediaLink: string;
  caption: string;
};

type MediaInputMode = 'file' | 'link';

type FormErrors = Partial<Record<keyof FormState | 'mediaFile', string>>;

const initialForm: FormState = {
  instagramUserId: '',
  mediaLink: '',
  caption: '',
};

const NavigationViewportHeight = Platform.select({ web: 84, default: 96 }) ?? 84;

export default function PublisherScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { signedInEmail, signOut, token } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [mediaInputMode, setMediaInputMode] = useState<MediaInputMode>('file');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!form.caption.trim()) {
      nextErrors.caption = 'Enter a caption before publishing.';
    } else if (form.caption.trim().length > 2_200) {
      nextErrors.caption = 'Captions can be at most 2,200 characters.';
    }

    if (mediaInputMode === 'file') {
      if (!mediaFile) {
        nextErrors.mediaFile = 'Select an image or video file.';
      } else if (!mediaFile.type.startsWith('image/') && !mediaFile.type.startsWith('video/')) {
        nextErrors.mediaFile = 'Select an image or video file.';
      } else if (mediaFile.size === 0) {
        nextErrors.mediaFile = 'The selected media file is empty.';
      }
    }

    if (mediaInputMode === 'link') {
      if (!form.mediaLink.trim()) {
        nextErrors.mediaLink = 'Enter a hosted image or video URL.';
      } else if (!isValidHttpUrl(form.mediaLink)) {
        nextErrors.mediaLink = 'Enter a valid http or https URL.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function publishToInstagram() {
    if (!token) {
      router.push({ pathname: '/login', params: { mode: 'login' } });
      return;
    }
    if (!validateForm()) {
      setResult(null);
      return;
    }

    setIsSubmitting(true);
    setResult(null);
    setError(null);

    try {
      if (mediaInputMode !== 'file' || !mediaFile) {
        throw new Error('The configured backend publishes uploaded files. Choose “Load from system” and select a JPEG, PNG, MP4, or MOV file.');
      }
      const account = await ensureInstagramAccount(token);
      const { asset } = await uploadAsset(token, mediaFile);
      const { post } = await createPost(token, { instagramAccountId: account.id, assetId: asset.id, caption: form.caption.trim() });
      const { post: published } = await publishPost(token, post.id);
      setResult({ ok: true, message: 'Post published through the configured ContentGrid API.', instagramMediaId: published.instagramMediaId });
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Unable to send the Instagram publish request.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = !isSubmitting;
  const inputStyle = [
    styles.input,
    {
      borderColor: '#9DB7E8',
      color: theme.text,
      backgroundColor: theme.background,
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.fixedNavigation}>
        <SafeAreaView style={styles.navigationSafeArea}>
          <View style={styles.navigationSection}>
          <View style={styles.navigationBar}>
            <View>
              <ThemedText type="smallBold" style={styles.navBrand}>
                InstaFeedGridAi
              </ThemedText>
            </View>
            <View style={styles.navActions}>
              {signedInEmail && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.accountEmail}>
                  {signedInEmail}
                </ThemedText>
              )}
              <Pressable
                accessibilityLabel="Open navigation menu"
                accessibilityRole="button"
                onPress={() => setIsMenuOpen((current) => !current)}
                style={({ pressed }) => [styles.menuButton, pressed && styles.buttonMuted]}>
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
              </Pressable>
            </View>
          </View>

          {isMenuOpen && (
            <ThemedView type="backgroundElement" style={styles.navigationMenu}>
              {signedInEmail ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    signOut();
                    setIsMenuOpen(false);
                  }}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.buttonMuted]}>
                  <ThemedText type="smallBold">Log out</ThemedText>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setIsMenuOpen(false);
                      router.push({ pathname: '/login', params: { mode: 'login' } });
                    }}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.buttonMuted]}>
                    <ThemedText type="smallBold">Log in</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setIsMenuOpen(false);
                      router.push({ pathname: '/login', params: { mode: 'signup' } });
                    }}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.buttonMuted]}>
                    <ThemedText type="smallBold">Sign up</ThemedText>
                  </Pressable>
                </>
              )}
            </ThemedView>
          )}
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.scrollView}>
        <SafeAreaView style={styles.contentSafeArea}>
          <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Create Instagram Post
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.panel}>
            <AnimatedFormBackground />
            <View style={styles.mediaSection}>
              <ThemedText type="smallBold">Media source</ThemedText>

              {mediaInputMode === 'file' && (
                <FilePicker
                  mediaFile={mediaFile}
                  onChange={(file) => {
                    setMediaFile(file);
                    setResult(null);
                    setError(null);
                    setErrors((current) => ({ ...current, mediaFile: undefined }));
                  }}
                  error={errors.mediaFile}
                />
              )}

              <View style={styles.segmentedControl}>
                <ModeButton
                  active={mediaInputMode === 'file'}
                  label="Load from system"
                  onPress={() => {
                    setMediaInputMode('file');
                    setErrors((current) => ({ ...current, mediaLink: undefined }));
                  }}
                />
                <ModeButton
                  active={mediaInputMode === 'link'}
                  label="Attach link"
                  onPress={() => {
                    setMediaInputMode('link');
                    setErrors((current) => ({ ...current, mediaFile: undefined }));
                  }}
                />
              </View>

              {mediaInputMode === 'link' && (
                <Field
                  label="Hosted image or video link"
                  value={form.mediaLink}
                  onChangeText={(value) => updateField('mediaLink', value)}
                  placeholder="https://example.com/post-media.mp4"
                  inputStyle={inputStyle}
                  error={errors.mediaLink}
                />
              )}
            </View>

            <Field
              label="Instagram user ID"
              value={form.instagramUserId}
              onChangeText={(value) => updateField('instagramUserId', value)}
              placeholder="Optional when IG_USER_ID is configured"
              inputStyle={inputStyle}
              error={errors.instagramUserId}
            />

            <Field
              containerStyle={styles.captionField}
              label="Caption"
              value={form.caption}
              onChangeText={(value) => updateField('caption', value)}
              placeholder="Write the Instagram caption here"
              inputStyle={[...inputStyle, styles.captionInput]}
              multiline
              error={errors.caption}
            />

            <View style={styles.publishAction}>
              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={publishToInstagram}
                style={({ pressed }) => [
                  styles.button,
                  (!canSubmit || pressed) && styles.buttonMuted,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText style={styles.buttonText}>Publish on Instagram</ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>

          {result && (
            <ThemedView type="backgroundElement" style={styles.statusBox}>
              <ThemedText type="smallBold">
                {result.dryRun ? 'Dry run completed' : 'Instagram publish completed'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {result.message}
              </ThemedText>
              {result.instagramMediaId && (
                <ThemedText type="code">Media ID: {result.instagramMediaId}</ThemedText>
              )}
              {result.uploadedFile && (
                <ThemedText type="code">
                  File: {result.uploadedFile.name} ({formatBytes(result.uploadedFile.size)})
                </ThemedText>
              )}
            </ThemedView>
          )}

          {error && (
            <ThemedView type="backgroundElement" style={styles.errorBox}>
              <ThemedText type="smallBold">Publish failed</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </ThemedView>
          )}

          </ThemedView>
        </SafeAreaView>
      </ScrollView>
      <AmbientSparkles />
    </View>
  );
}

function AmbientSparkles() {
  const [twinkle] = useState(() => new Animated.Value(0));
  const [orbit] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { duration: 1500, easing: Easing.inOut(Easing.sin), toValue: 1, useNativeDriver: true }),
        Animated.timing(twinkle, { duration: 1500, easing: Easing.inOut(Easing.sin), toValue: 0, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [twinkle]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(orbit, { duration: 6500, easing: Easing.inOut(Easing.sin), toValue: 1, useNativeDriver: true }),
        Animated.timing(orbit, { duration: 6500, easing: Easing.inOut(Easing.sin), toValue: 0, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [orbit]);

  const softTwinkle = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.6] });
  const brightTwinkle = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0.18] });
  const leftNebulaMotion = {
    opacity: orbit.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.36] }),
    transform: [
      { translateX: orbit.interpolate({ inputRange: [0, 1], outputRange: [-18, 28] }) },
      { translateY: orbit.interpolate({ inputRange: [0, 1], outputRange: [-12, 18] }) },
      { rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '12deg'] }) },
    ],
  };
  const rightNebulaMotion = {
    opacity: orbit.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.14] }),
    transform: [
      { translateX: orbit.interpolate({ inputRange: [0, 1], outputRange: [26, -20] }) },
      { translateY: orbit.interpolate({ inputRange: [0, 1], outputRange: [16, -12] }) },
      { rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['10deg', '-10deg'] }) },
    ],
  };

  return (
    <View pointerEvents="none" style={styles.sparkleLayer}>
      <Animated.View style={[styles.nebula, styles.nebulaOne, leftNebulaMotion]} />
      <Animated.View style={[styles.nebula, styles.nebulaTwo, rightNebulaMotion]} />
      <Animated.View style={[styles.sparkle, styles.sparkleOne, { opacity: softTwinkle }]} />
      <Animated.View style={[styles.sparkle, styles.sparkleTwo, { opacity: brightTwinkle }]} />
      <Animated.View style={[styles.sparkle, styles.sparkleThree, { opacity: softTwinkle }]} />
      <Animated.View style={[styles.sparkle, styles.sparkleFour, { opacity: brightTwinkle }]} />
      <Animated.View style={[styles.sparkle, styles.sparkleFive, { opacity: softTwinkle }]} />
    </View>
  );
}

function AnimatedFormBackground() {
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 7_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 7_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [drift]);

  const leftTransform = drift.interpolate({ inputRange: [0, 1], outputRange: [-24, 56] });
  const rightTransform = drift.interpolate({ inputRange: [0, 1], outputRange: [36, -42] });

  return (
    <View pointerEvents="none" style={styles.animatedBackground}>
      <Animated.View style={[styles.backgroundOrb, styles.backgroundOrbPrimary, { transform: [{ translateX: leftTransform }, { translateY: leftTransform }] }]} />
      <Animated.View style={[styles.backgroundOrb, styles.backgroundOrbSecondary, { transform: [{ translateX: rightTransform }, { translateY: rightTransform }] }]} />
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  inputStyle: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
  secureTextEntry?: boolean;
  error?: string;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  inputStyle,
  containerStyle,
  multiline,
  secureTextEntry,
  error,
}: FieldProps) {
  return (
    <View style={[styles.field, containerStyle]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        autoCapitalize="none"
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6F82A8"
        secureTextEntry={secureTextEntry}
        style={[inputStyle, error && styles.inputInvalid]}
        value={value}
      />
      {error && <ThemedText style={styles.validationError}>{error}</ThemedText>}
    </View>
  );
}

type ModeButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function ModeButton({ active, label, onPress }: ModeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        active && styles.modeButtonActive,
        pressed && styles.buttonMuted,
      ]}>
      <ThemedText
        type="smallBold"
        style={active ? styles.modeButtonTextActive : styles.modeButtonText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type FilePickerProps = {
  mediaFile: File | null;
  onChange: (file: File | null) => void;
  error?: string;
};

function FilePicker({ mediaFile, onChange, error }: FilePickerProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] ?? null);
  }

  if (Platform.OS !== 'web') {
    return (
      <ThemedView style={[styles.filePickerBox, error && styles.inputInvalid]}>
        <ThemedText type="small" themeColor="textSecondary">
          Local file picker is available in the web UI.
        </ThemedText>
        {error && <ThemedText style={styles.validationError}>{error}</ThemedText>}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.filePickerBox, error && styles.inputInvalid]}>
      <label className="media-file-button">
        Choose file
        <input
          accept="image/*,video/*"
          className="media-file-input"
          onChange={handleFileChange}
          type="file"
        />
      </label>
      <ThemedText type="small" themeColor="textSecondary" style={styles.fileSelectionStatus}>
        {mediaFile ? `Selected ${mediaFile.name} (${formatBytes(mediaFile.size)})` : 'No file chosen'}
      </ThemedText>
      {error && <ThemedText style={styles.validationError}>{error}</ThemedText>}
    </ThemedView>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollView: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: NavigationViewportHeight,
    zIndex: 1,
  },
  contentSafeArea: {
    alignItems: 'center',
    paddingBottom: BottomTabInset + Spacing.four,
    paddingTop: Spacing.two,
  },
  fixedNavigation: {
    elevation: 5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
    zIndex: 2,
  },
  navigationSafeArea: {
    backgroundColor: '#212529',
    width: '100%',
  },
  sparkleLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: NavigationViewportHeight,
    zIndex: 0,
  },
  sparkle: {
    backgroundColor: '#8DBBFF',
    borderRadius: 999,
    height: 4,
    position: 'absolute',
    width: 4,
  },
  nebula: {
    borderRadius: 999,
    height: 190,
    position: 'absolute',
    width: 190,
  },
  nebulaOne: {
    backgroundColor: '#365FCC',
    left: -105,
    top: '16%',
  },
  nebulaTwo: {
    backgroundColor: '#703AC5',
    bottom: '10%',
    right: -115,
  },
  sparkleOne: {
    left: 18,
    top: '18%',
  },
  sparkleTwo: {
    right: 24,
    top: '42%',
  },
  sparkleThree: {
    bottom: '16%',
    left: 30,
  },
  sparkleFour: {
    height: 7,
    right: 52,
    top: '24%',
    width: 7,
  },
  sparkleFive: {
    bottom: '29%',
    height: 6,
    left: 68,
    width: 6,
  },
  container: {
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    width: '100%',
  },
  navigationSection: {
    width: '100%',
  },
  navigationBar: {
    alignItems: 'center',
    backgroundColor: '#212529',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
  },
  navBrand: {
    color: '#F4F7FF',
    fontSize: 18,
  },
  navActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  accountEmail: {
    maxWidth: 180,
  },
  menuButton: {
    alignItems: 'center',
    borderColor: '#7FA9DD',
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 44,
    width: 48,
  },
  menuLine: {
    backgroundColor: '#F4F7FF',
    borderRadius: 2,
    height: 2,
    width: 20,
  },
  navigationMenu: {
    alignSelf: 'flex-end',
    borderRadius: Spacing.two,
    gap: Spacing.one,
    marginTop: -Spacing.three,
    minWidth: 160,
    padding: Spacing.one,
  },
  menuItem: {
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    color: '#1D5FD1',
    textTransform: 'uppercase',
  },
  title: {
    maxWidth: 680,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 620,
  },
  panel: {
    borderRadius: Spacing.two,
    gap: Spacing.two,
    overflow: 'hidden',
    padding: Spacing.three,
    position: 'relative',
    shadowColor: '#0B3A75',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  animatedBackground: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backgroundOrb: {
    borderRadius: 999,
    height: 240,
    opacity: 0.28,
    position: 'absolute',
    width: 240,
  },
  backgroundOrbPrimary: {
    backgroundColor: '#4D91FF',
    left: -110,
    top: -80,
  },
  backgroundOrbSecondary: {
    backgroundColor: '#8E6CFF',
    bottom: -110,
    right: -90,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  field: {
    flex: 1,
    gap: Spacing.one,
    minWidth: 240,
  },
  mediaSection: {
    gap: Spacing.two,
    width: '100%',
  },
  captionField: {
    marginBottom: Spacing.two,
    marginTop: -Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputInvalid: {
    borderColor: '#D14343',
  },
  validationError: {
    color: '#B42318',
    fontSize: 13,
  },
  captionInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  segmentedControl: {
    backgroundColor: '#D6E5FF',
    borderRadius: Spacing.two,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    padding: Spacing.one,
    width: '100%',
  },
  modeButton: {
    borderRadius: Spacing.two,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modeButtonActive: {
    backgroundColor: '#185ABC',
  },
  modeButtonText: {
    color: '#31527F',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  filePickerBox: {
    alignItems: 'center',
    borderColor: '#9DB7E8',
    borderRadius: Spacing.two,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 80,
    padding: Spacing.two,
    width: '100%',
  },
  fileSelectionStatus: {
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#185ABC',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  publishAction: {
    alignItems: 'center',
    marginTop: Spacing.three,
    width: '100%',
  },
  buttonMuted: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 700,
  },
  statusBox: {
    borderLeftColor: '#2F80ED',
    borderLeftWidth: 4,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  errorBox: {
    borderLeftColor: '#D14343',
    borderLeftWidth: 4,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
