/**
 * SERS Mobile — Auth Screen (Password Login, Secure OTP, and Verified Citizen/Responder Registration)
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
  const [showOtpPreview, setShowOtpPreview] = useState(false);

  // Registration Common fields
  const [name, setName]         = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass]   = useState('');
  const [role, setRole]         = useState<'citizen' | 'responder'>('citizen');

  // Citizen Specific fields
  const [bloodGroup, setBloodGroup]     = useState('');
  const [govtIdType, setGovtIdType]     = useState<'Aadhaar' | 'PAN Card' | 'Driving License' | 'Voter ID'>('Aadhaar');
  const [govtIdNumber, setGovtIdNumber] = useState('');
  const [abhaId, setAbhaId]             = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Responder Specific fields
  const [badgeId, setBadgeId]                   = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [drivingLicense, setDrivingLicense]     = useState('');

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handlePasswordLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your registered phone/email and password.');
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
      Alert.alert('Error', 'Please enter your registered Mobile number or Gmail address.');
      return;
    }
    setLoading(true);
    setShowOtpPreview(false);
    try {
      const res = await sendOTP(clean);
      setOtpStep('verify');
      setOtpCountdown(60);
      if (res?.previewOtp) {
        setPreviewOtpHint(res.previewOtp);
      }
      Alert.alert('Verification Code Sent', `A 6-digit verification code has been dispatched to ${clean}. Please check your phone or inbox.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message;
      if (msg?.toLowerCase().includes('not registered') || msg?.toLowerCase().includes('not found')) {
        Alert.alert(
          'Account Not Found',
          'This mobile number or email is not registered with SERS. Please register your account first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Register Now', onPress: () => { setMode('register'); setRegPhone(clean); } }
          ]
        );
      } else {
        Alert.alert('Failed to send OTP', msg || 'Please check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otpCode.trim();
    if (cleanOtp.length < 6) {
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
      Alert.alert('Verification Failed', err?.response?.data?.message || err?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !regPhone.trim() || !regPass.trim()) {
      Alert.alert('Error', 'Full name, phone number, and password are required.');
      return;
    }

    if (role === 'responder') {
      if (!badgeId.trim() || !vehicleRegNumber.trim() || !drivingLicense.trim()) {
        Alert.alert('Responder Verification Required', 'Please provide Badge ID, Ambulance Registration Number, and Emergency License.');
        return;
      }
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim() || undefined,
        password: regPass,
        role,
        bloodGroup: role === 'citizen' ? bloodGroup || undefined : undefined,
        govtIdType: role === 'citizen' ? govtIdType : undefined,
        govtIdNumber: role === 'citizen' ? govtIdNumber.trim() || undefined : undefined,
        abhaId: role === 'citizen' ? abhaId.trim() || undefined : undefined,
        vehicleNumber: role === 'citizen' ? vehicleNumber.trim() || undefined : undefined,
        badgeId: role === 'responder' ? badgeId.trim() : undefined,
        vehicleRegNumber: role === 'responder' ? vehicleRegNumber.trim() : undefined,
        drivingLicense: role === 'responder' ? drivingLicense.trim() : undefined,
      });

      Alert.alert('Registration Successful', `Welcome to SERS! Your verified ${role === 'responder' ? 'Paramedic / Driver' : 'Citizen'} account is active.`);

      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'responder') {
        router.replace('/(responder)');
      } else {
        router.replace('/(citizen)');
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.message || err?.response?.data?.error || 'Something went wrong during registration.');
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
            <Text style={[styles.tabText, mode === 'otp' && styles.activeTabText]}>🔐 Secure OTP</Text>
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
              <Text style={styles.label}>Registered Phone Number or Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter registered mobile or email"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                value={phone}
                onChangeText={setPhone}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
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
                    <Text style={styles.demoChipText}>👤 Citizen Demo Account (+919876500001)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.demoChip}
                    onPress={() => { setPhone('+919876500003'); setPassword('Test@1234'); }}
                  >
                    <Text style={styles.demoChipText}>🚑 Responder Demo Account (+919876500003)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {mode === 'otp' && (
            <>
              {otpStep === 'input' ? (
                <>
                  <Text style={styles.label}>Enter Registered Mobile (+91) or Gmail</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter registered mobile or email"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    value={otpIdentifier}
                    onChangeText={setOtpIdentifier}
                  />
                  <Text style={styles.helperText}>
                    🔒 A secure 6-digit verification code will be sent to your registered number or email inbox.
                  </Text>

                  <TouchableOpacity style={styles.btn} onPress={handleSendOtp} disabled={loading}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnText}>Send Verification Code →</Text>
                    }
                  </TouchableOpacity>
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
                    <View style={{ marginTop: 10, alignItems: 'center' }}>
                      {!showOtpPreview ? (
                        <TouchableOpacity
                          style={styles.showOtpBtn}
                          onPress={() => setShowOtpPreview(true)}
                        >
                          <Text style={styles.showOtpBtnText}>👁️ Show Verification Code (Preview)</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.previewBox}>
                          <Text style={styles.previewText}>
                            🔑 Code: <Text style={styles.previewCode}>{previewOtpHint}</Text>
                          </Text>
                          <TouchableOpacity
                            style={styles.autoFillBtn}
                            onPress={() => setOtpCode(previewOtpHint)}
                          >
                            <Text style={styles.autoFillText}>Auto-Fill</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
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

                  <TouchableOpacity style={styles.btnGreen} onPress={handleVerifyOtp} disabled={loading || otpCode.length < 6}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnText}>Verify Code & Sign In ✓</Text>
                    }
                  </TouchableOpacity>

                  <View style={styles.resendRow}>
                    {otpCountdown > 0 ? (
                      <Text style={styles.countdownText}>Resend code in {otpCountdown}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleSendOtp}>
                        <Text style={styles.resendLink}>🔄 Resend Verification Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </>
          )}

          {mode === 'register' && (
            <>
              {/* Role Selection */}
              <Text style={styles.label}>Account Classification</Text>
              <View style={styles.rolePicker}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'citizen' && styles.activeRole]}
                  onPress={() => setRole('citizen')}
                >
                  <Text style={styles.roleIcon}>👤</Text>
                  <Text style={[styles.roleText, role === 'citizen' && styles.activeRoleText]}>Citizen / Patient</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'responder' && styles.activeRole]}
                  onPress={() => setRole('responder')}
                >
                  <Text style={styles.roleIcon}>🚑</Text>
                  <Text style={[styles.roleText, role === 'responder' && styles.activeRoleText]}>Ambulance / EMS</Text>
                </TouchableOpacity>
              </View>

              {/* Common Fields */}
              <Text style={styles.label}>Full Legal Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter full legal name"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Primary Contact Number (+91) *</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 Mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={regPhone}
                onChangeText={setRegPhone}
              />

              <Text style={styles.label}>Email Address (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="email@domain.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={regEmail}
                onChangeText={setRegEmail}
              />

              <Text style={styles.label}>Account Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Choose a secure password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={regPass}
                onChangeText={setRegPass}
              />

              {/* Citizen Specific Verification */}
              {role === 'citizen' && (
                <>
                  <Text style={styles.label}>Blood Group (Emergency Profiling)</Text>
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

                  <Text style={styles.label}>Government ID Document Type</Text>
                  <View style={styles.idTypeContainer}>
                    {(['Aadhaar', 'PAN Card', 'Driving License', 'Voter ID'] as const).map(idType => (
                      <TouchableOpacity
                        key={idType}
                        style={[styles.idChip, govtIdType === idType && styles.idChipActive]}
                        onPress={() => setGovtIdType(idType)}
                      >
                        <Text style={[styles.idChipText, govtIdType === idType && styles.idChipTextActive]}>{idType}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>{govtIdType} Number (Identity Verification)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter valid ${govtIdType} number`}
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={govtIdNumber}
                    onChangeText={setGovtIdNumber}
                  />

                  <Text style={styles.label}>ABDM ABHA Health ID / Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 91-1234-5678-9012 or citizen@abdm"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    value={abhaId}
                    onChangeText={setAbhaId}
                  />

                  <Text style={styles.label}>Personal Vehicle Number (Emergency Clearance)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. KA-01-AB-1234 (Optional)"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={vehicleNumber}
                    onChangeText={setVehicleNumber}
                  />
                </>
              )}

              {/* Responder Specific Verification */}
              {role === 'responder' && (
                <>
                  <Text style={styles.label}>Unique Responder Badge ID / EMS Operator Code *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. AMB-BLR-104 or EMS-892"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={badgeId}
                    onChangeText={setBadgeId}
                  />

                  <Text style={styles.label}>Ambulance Vehicle Registration Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. KA-01-EA-1088 / DL-01-AX-9999"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={vehicleRegNumber}
                    onChangeText={setVehicleRegNumber}
                  />

                  <Text style={styles.label}>Emergency Medical / Heavy Driving License No. *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. DL-1420110012345"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={drivingLicense}
                    onChangeText={setDrivingLicense}
                  />
                </>
              )}

              <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Register Verified {role === 'responder' ? 'Responder' : 'Citizen'} Node →</Text>
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
  otpHeaderBox:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff1f2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecdd3', marginTop: 4 },
  otpTargetText:  { color: '#9f1239', fontWeight: '800', fontSize: 12 },
  changeText:     { color: '#e11d48', fontWeight: '800', fontSize: 12, textDecorationLine: 'underline' },
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
  idTypeContainer:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  idChip:         { backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  idChipActive:   { backgroundColor: '#fff1f2', borderColor: '#e11d48' },
  idChipText:     { color: '#475569', fontWeight: '700', fontSize: 11 },
  idChipTextActive:{ color: '#e11d48', fontWeight: '800' },
  demoHelper:     { marginTop: 24, alignItems: 'center' },
  demoHelperText: { color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  demoChips:      { flexDirection: 'column', gap: 6, width: '100%' },
  demoChip:       { backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  demoChipText:   { color: '#475569', fontWeight: '700', fontSize: 12 },
  showOtpBtn:     { paddingVertical: 6, paddingHorizontal: 12 },
  showOtpBtnText: { color: '#64748b', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  previewBox:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fef3c7', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', width: '100%' },
  previewText:    { color: '#92400e', fontSize: 12, fontWeight: '700' },
  previewCode:    { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 14, fontWeight: '900', color: '#78350f', letterSpacing: 1 },
  autoFillBtn:    { backgroundColor: '#fde68a', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  autoFillText:   { color: '#78350f', fontSize: 11, fontWeight: '800' },
});
