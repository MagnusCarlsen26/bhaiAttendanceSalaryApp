import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { AttendanceProvider, useAttendance } from './src/context/AttendanceContext';
import RootNavigator from './src/navigation/RootNavigator';
import Screen from './src/components/ui/Screen';
import PrimaryButton from './src/components/ui/PrimaryButton';
import { colors, radius, shadows, spacing, type } from './src/theme/tokens';

const BiometricGate = ({ children }) => {
  const appState = useRef(AppState.currentState);
  const isAuthenticatingRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [biometricLabel, setBiometricLabel] = useState('fingerprint');

  const authenticate = useCallback(async () => {
    if (isAuthenticatingRef.current) {
      return;
    }

    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setErrorMessage('');

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFingerprint = supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT
      );

      setBiometricLabel(hasFingerprint ? 'fingerprint' : 'biometrics');

      if (!hasHardware || !isEnrolled) {
        setErrorMessage(
          'Biometric authentication is not available on this phone. Enroll a fingerprint or face unlock in device settings.'
        );
        setIsUnlocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Attendance & Salary',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsUnlocked(true);
        return;
      }

      setIsUnlocked(false);
      setErrorMessage(
        result.error === 'user_cancel'
          ? 'Authentication was cancelled.'
          : 'Authentication failed. Try again to unlock the app.'
      );
    } catch (error) {
      setIsUnlocked(false);
      setErrorMessage('Unable to start biometric authentication on this device.');
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackgrounded =
        appState.current === 'background' || appState.current === 'inactive';

      if (wasBackgrounded && nextAppState === 'active') {
        setIsUnlocked(false);
        authenticate();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [authenticate]);

  if (!isReady && isAuthenticating) {
    return (
      <Screen>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingEyebrow}>Secure Access</Text>
          <Text style={styles.loadingTitle}>Checking your identity</Text>
          <ActivityIndicator size="large" color={colors.accentStrong} style={styles.spinner} />
        </View>
      </Screen>
    );
  }

  if (!isUnlocked) {
    return (
      <Screen>
        <View style={styles.lockWrap}>
          <View style={styles.lockCard}>
            <Text style={styles.lockEyebrow}>App Locked</Text>
            <Text style={styles.lockTitle}>Unlock with your {biometricLabel}</Text>
            <Text style={styles.lockBody}>
              Protect payroll and attendance records with on-device biometric authentication.
            </Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            <PrimaryButton
              label={isAuthenticating ? 'Checking...' : 'Unlock App'}
              onPress={authenticate}
              disabled={isAuthenticating}
              style={styles.unlockButton}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return children;
};

const AppContent = () => {
  const { loading } = useAttendance();

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingEyebrow}>Attendance & Salary</Text>
          <Text style={styles.loadingTitle}>Preparing your desk</Text>
          <ActivityIndicator size="large" color={colors.accentStrong} style={styles.spinner} />
        </View>
      </Screen>
    );
  }

  return (
    <BiometricGate>
      <RootNavigator />
    </BiometricGate>
  );
};

export default function App() {
  return (
    <AttendanceProvider>
      <AppContent />
    </AttendanceProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingEyebrow: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginBottom: 12,
  },
  loadingTitle: {
    ...type.hero,
    fontSize: 28,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 22,
  },
  lockWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  lockCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.card,
  },
  lockEyebrow: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginBottom: 12,
  },
  lockTitle: {
    ...type.hero,
    fontSize: 30,
    marginBottom: 12,
  },
  lockBody: {
    ...type.body,
    marginBottom: 18,
  },
  errorText: {
    ...type.body,
    color: colors.absent,
    marginBottom: 18,
  },
  unlockButton: {
    marginTop: 4,
  },
});
