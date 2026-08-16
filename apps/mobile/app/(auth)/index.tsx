/**
 * SERS Mobile — Auth Screen (Password Login, 1-Click OTP, and Registration)
 */

import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

type Mode = 'login' | 'otp' | 'register';

export default function AuthScreen() {
  const { login, sendOTP, verifyOTP, register } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);

  // Password Login fields
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');

  // OTP Login fields
  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'input' | 'verify'>('input');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [previewOtpHint, setPreviewOtpHint] = useState<string | null>(null);

  // Register fields
  const [name, setName]         = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass]   = useState('');
  const [role, setRole]         = useState<'citizen' | 'responder'>('citizen');
  const [bloodGroup, setBloodGroup] = useState('');

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handlePasswordLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter phone/email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(phone.trim(), password);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'responder') {
        router.replace('/(responder)');
      } else {
        router.replace('/(citizen)');
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err?.response?.data?.message || err?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const clean = otpIdentifier.trim();
    if (!clean) {
      Alert.alert('Error', 'Please enter your Mobile number or Gmail address.');
      return;
    }
    setLoading(true);
    setPreviewOtpHint(null);
    try {
      const res = await sendOTP(clean);
      setOtpStep('verify');
      setOtpCountdown(60);
      if (res.previewOtp) {
        setPreviewOtpHint(res.previewOtp);
      }
      Alert.alert('OTP Dispatched', `Verification code sent to ${clean}`);
    } catch (err: any) {
      Alert.alert('Failed to send OTP', err?.response?.data?.message || err?.message || 'Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otpCode.trim();
    if (cleanOtp.length < 4) {
      Alert.alert('Error', 'Please enter the complete 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      await verifyOTP(otpIdentifier.trim(), cleanOtp);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'responder') {
        router.replace('/(responder)');
      } else {
        router.replace('/(citizen)');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.response?.data?.message || err?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !regPhone.trim() || !regPass.trim()) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    setLoading(true);
    try {
      await register({ name: name.trim(), phone: regPhone.trim(), password: regPass, role, bloodGroup: role === 'citizen' ? bloodGroup : undefined });
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'responder') {
        router.replace('/(responder)');
      } else {
        router.replace('/(citizen)');
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🚨</Text>
          <Text style={styles.title}>SERS</Text>
          <Text style={styles.subtitle}>Smart Emergency Response System</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.activeTab]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>Password</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'otp' && styles.activeTab]}
            onPress={() => { setMode('otp'); setOtpStep('input'); }}
          >
            <Text style={[styles.tabText, mode === 'otp' && styles.activeTabText]}>⚡ Free OTP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'register' && styles.activeTab]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {mode === 'login' && (
            <>
              <Text style={styles.label}>Phone Number or Email</Text>
              <TextInput
                style={styles.input}
                placeholder="+919876500001 or email@domain.com"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                value={phone}
                onChangeText={setPhone}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password (e.g. Test@1234)"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.btn} onPress={handlePasswordLogin} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Login to SERS →</Text>
                }
              </TouchableOpacity>

              {/* Demo Credentials Helper */}
              <View style={styles.demoHelper}>
                <Text style={styles.demoHelperText}>One-Tap Demo Logins</Text>
                <View style={styles.demoChips}>
                  <TouchableOpacity
                    style={styles.demoChip}
                    onPress={() => { setPhone('+919876500001'); setPassword('Test@1234'); }}
                  >
                    <Text style={styles.demoChipText}>👤 Citizen (+919876500001)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.demoChip}
                    onPress={() => { setPhone('+919876500003'); setPassword('Test@1234'); }}
                  >
                    <Text style={styles.demoChipText}>🚑 Responder (+919876500003)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {mode === 'otp' && (
            <>
              {otpStep === 'input' ? (
                <>
                  <Text style={styles.label}>Enter Mobile Number (+91) or Gmail</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. yourname@gmail.com or +919876500001"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    value={otpIdentifier}
                    onChangeText={setOtpIdentifier}
                  />
                  <Text style={styles.helperText}>
                    💡 A 6-digit verification code will be sent to your Phone or Gmail.
                  </Text>

                  <TouchableOpacity style={styles.btn} onPress={handleSendOtp} disabled={loading}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnText}>Send 6-Digit OTP Code →</Text>
                    }
                  </TouchableOpacity>

                  {/* Preset Buttons */}
                  <View style={styles.demoHelper}>
                    <Text style={styles.demoHelperText}>Quick Test Identifiers</Text>
                    <View style={styles.demoChips}>
                      <TouchableOpacity
                        style={styles.demoChip}
                        onPress={() => setOtpIdentifier('+919876500001')}
                      >
                        <Text style={styles.demoChipText}>📱 +919876500001</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.demoChip}
                        onPress={() => setOtpIdentifier('admin@sers.in')}
                      >
                        <Text style={styles.demoChipText}>📧 admin@sers.in</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.otpHeaderBox}>
                    <Text style={styles.otpTargetText}>Sent code to: {otpIdentifier}</Text>
                    <TouchableOpacity onPress={() => setOtpStep('input')}>
                      <Text style={styles.changeText}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  {previewOtpHint && (
                    <TouchableOpacity
                      style={styles.hintBox}
                      onPress={() => setOtpCode(previewOtpHint)}
                    >
                      <Text style={styles.hintText}>🔑 Instant Code: {previewOtpHint} (Tap to autofill)</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.label}>Enter 6-Digit Verification Code</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="••••••"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />
                  <Text style={styles.helperTextCenter}>
                    (Universal Demo OTP: <Text style={{ fontWeight: 'bold' }}>123456</Text>)
                  </Text>

                  <TouchableOpacity style={styles.btnGreen} onPress={handleVerifyOtp} disabled={loading}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnText}>Verify & Sign In ✓</Text>
                    }
                  </TouchableOpacity>

                  <View style={styles.resendRow}>
                    {otpCountdown > 0 ? (
                      <Text style={styles.countdownText}>Resend code in {otpCountdown}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleSendOtp}>
                        <Text style={styles.resendLink}>🔄 Resend OTP Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </>
          )}

          {mode === 'register' && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Dr. Arjun Kumar"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+919876543210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={regPhone}
                onChangeText={setRegPhone}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={regPass}
                onChangeText={setRegPass}
              />

              {role === 'citizen' && (
                <>
                  <Text style={styles.label}>Blood Group (Optional)</Text>
                  <View style={styles.bloodGroupContainer}>
                    {['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'].map(bg => (
                      <TouchableOpacity
                        key={bg}
                        style={[styles.bgChip, bloodGroup === bg && styles.bgChipActive]}
                        onPress={() => setBloodGroup(bg === bloodGroup ? '' : bg)}
                      >
                        <Text style={[styles.bgText, bloodGroup === bg && styles.bgTextActive]}>{bg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>I am a...</Text>
              <View style={styles.rolePicker}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'citizen' && styles.activeRole]}
                  onPress={() => setRole('citizen')}
                >
                  <Text style={styles.roleIcon}>👤</Text>
                  <Text style={[styles.roleText, role === 'citizen' && styles.activeRoleText]}>Citizen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'responder' && styles.activeRole]}
                  onPress={() => setRole('responder')}
                >
                  <Text style={styles.roleIcon}>🚑</Text>
                  <Text style={[styles.roleText, role === 'responder' && styles.activeRoleText]}>Responder</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Create Account →</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          By using SERS, you agree to secure emergency response protocols.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f7ff' },
  scroll:         { flexGrow: 1, padding: 24, paddingTop: 50 },
  header:         { alignItems: 'center', marginBottom: 24 },
  logo:           { fontSize: 50 },
  title:          { fontSize: 32, fontWeight: '900', color: '#e11d48', letterSpacing: 3 },
  subtitle:       { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center', fontWeight: '600' },
  tabs:           { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 14, padding: 4, marginBottom: 16 },
  tab:            { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab:      { backgroundColor: '#e11d48' },
  tabText:        { color: '#64748b', fontWeight: '700', fontSize: 13 },
  activeTabText:  { color: '#fff', fontWeight: '800' },
  card:           { backgroundColor: '#ffffff', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  label:          { color: '#334155', fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 12 },
  input:          { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, color: '#0f172a', fontSize: 14, borderWidth: 1, borderColor: '#cbd5e1', fontWeight: '600' },
  otpInput:       { textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: '900', color: '#e11d48' },
  helperText:     { color: '#64748b', fontSize: 11, marginTop: 6, fontWeight: '500' },
  helperTextCenter: { color: '#64748b', fontSize: 11, marginTop: 6, fontWeight: '600', textAlign: 'center' },
  otpHeaderBox:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff1f2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecdd3', marginTop: 4 },
  otpTargetText:  { color: '#9f1239', fontWeight: '800', fontSize: 12 },
  changeText:     { color: '#e11d48', fontWeight: '800', fontSize: 12, textDecorationLine: 'underline' },
  hintBox:        { backgroundColor: '#fef3c7', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a', marginTop: 10, alignItems: 'center' },
  hintText:       { color: '#92400e', fontWeight: '800', fontSize: 12 },
  resendRow:      { alignItems: 'center', marginTop: 16 },
  countdownText:  { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  resendLink:     { color: '#e11d48', fontSize: 13, fontWeight: '800' },
  rolePicker:     { flexDirection: 'row', gap: 12, marginTop: 4 },
  roleBtn:        { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  activeRole:     { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  roleIcon:       { fontSize: 26, marginBottom: 4 },
  roleText:       { color: '#64748b', fontWeight: '700', fontSize: 13 },
  activeRoleText: { color: '#e11d48', fontWeight: '800' },
  btn:            { marginTop: 20, backgroundColor: '#e11d48', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#e11d48', shadowOpacity: 0.35, shadowRadius: 10 },
  btnGreen:       { marginTop: 20, backgroundColor: '#059669', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#059669', shadowOpacity: 0.35, shadowRadius: 10 },
  btnText:        { color: '#fff', fontWeight: '900', fontSize: 15 },
  footer:         { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 24, fontWeight: '500' },
  bloodGroupContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  bgChip:         { backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  bgChipActive:   { backgroundColor: '#fff1f2', borderColor: '#e11d48' },
  bgText:         { color: '#475569', fontWeight: '700', fontSize: 13 },
  bgTextActive:   { color: '#e11d48' },
  demoHelper:     { marginTop: 24, alignItems: 'center' },
  demoHelperText: { color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  demoChips:      { flexDirection: 'column', gap: 6, width: '100%' },
  demoChip:       { backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  demoChipText:   { color: '#475569', fontWeight: '700', fontSize: 12 },
});
