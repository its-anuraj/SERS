/**
 * SERS Mobile — Auth Screen (Login + Register)
 */

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [name, setName]         = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass]   = useState('');
  const [role, setRole]         = useState<'citizen' | 'responder'>('citizen');
  const [bloodGroup, setBloodGroup] = useState('');

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter phone and password.');
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
      Alert.alert('Login Failed', err?.response?.data?.message || 'Invalid credentials.');
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
          <Text style={styles.logo}>🆘</Text>
          <Text style={styles.title}>SERS</Text>
          <Text style={styles.subtitle}>Smart Emergency Response System</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.activeTab]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>Login</Text>
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
          {mode === 'login' ? (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#475569"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Login →</Text>
                }
              </TouchableOpacity>

              {/* Demo Credentials Helper */}
              <View style={styles.demoHelper}>
                <Text style={styles.demoHelperText}>Demo Accounts</Text>
                <View style={styles.demoChips}>
                  <TouchableOpacity
                    style={styles.demoChip}
                    onPress={() => { setPhone('+919876500001'); setPassword('Test@1234'); }}
                  >
                    <Text style={styles.demoChipText}>👤 Citizen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.demoChip}
                    onPress={() => { setPhone('+919876500003'); setPassword('Test@1234'); }}
                  >
                    <Text style={styles.demoChipText}>🚑 Responder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#475569"
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                value={regPhone}
                onChangeText={setRegPhone}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor="#475569"
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
          By using SERS, you agree to share your location during emergencies.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0e1a' },
  scroll:         { flexGrow: 1, padding: 24, paddingTop: 60 },
  header:         { alignItems: 'center', marginBottom: 32 },
  logo:           { fontSize: 56 },
  title:          { fontSize: 36, fontWeight: '900', color: '#ef4444', letterSpacing: 4 },
  subtitle:       { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center' },
  tabs:           { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 14, padding: 4, marginBottom: 20 },
  tab:            { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab:      { backgroundColor: '#ef4444' },
  tabText:        { color: '#64748b', fontWeight: '600', fontSize: 15 },
  activeTabText:  { color: '#fff' },
  card:           { backgroundColor: '#111827', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  label:          { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input:          { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  rolePicker:     { flexDirection: 'row', gap: 12, marginTop: 4 },
  roleBtn:        { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  activeRole:     { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  roleIcon:       { fontSize: 28, marginBottom: 4 },
  roleText:       { color: '#64748b', fontWeight: '600' },
  activeRoleText: { color: '#ef4444' },
  btn:            { marginTop: 24, backgroundColor: '#ef4444', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 12 },
  btnText:        { color: '#fff', fontWeight: '900', fontSize: 16 },
  footer:         { color: '#334155', fontSize: 12, textAlign: 'center', marginTop: 24 },
  bloodGroupContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  bgChip:         { backgroundColor: '#1e293b', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  bgChipActive:   { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#ef4444' },
  bgText:         { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  bgTextActive:   { color: '#ef4444' },
  demoHelper:     { marginTop: 32, alignItems: 'center' },
  demoHelperText: { color: '#64748b', fontSize: 13, marginBottom: 12, fontWeight: '600', textTransform: 'uppercase' },
  demoChips:      { flexDirection: 'row', gap: 12 },
  demoChip:       { backgroundColor: '#1e293b', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  demoChipText:   { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
});
