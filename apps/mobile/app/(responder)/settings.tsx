import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function ResponderSettingsScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Responder mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)' as any);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Responder Profile',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
        }}
      />
      
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'R'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Ambulance Responder'}</Text>
        <Text style={styles.role}>Ambulance Driver & First Responder</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone:</Text>
          <Text style={styles.infoValue}>{user?.phone || '+91 98765 43210'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Assigned Base:</Text>
          <Text style={styles.infoValue}>SERS Central Emergency Fleet</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, { color: '#16a34a' }]}>Active Service Verified</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Log Out of Responder Mode</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  avatarText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  role: { fontSize: 13, color: '#2563eb', fontWeight: '700', marginBottom: 24 },
  
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  infoLabel: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  infoValue: { color: '#0f172a', fontSize: 14, fontWeight: '800' },

  logoutBtn: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutText: { color: '#dc2626', fontWeight: '800', fontSize: 15 },
});
