import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, FlatList, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Stack } from 'expo-router';
import { useSettingsStore, EmergencyContact } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';

export default function CitizenSettingsScreen() {
  const { user, logout } = useAuthStore();
  const { emergencyContacts, addEmergencyContact, removeEmergencyContact } = useSettingsStore();

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const handleAddContact = () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Error', 'Please enter both name and phone number.');
      return;
    }
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newName.trim(),
      phone: newPhone.trim(),
    };
    addEmergencyContact(newContact);
    setNewName('');
    setNewPhone('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Emergency Contacts & Settings',
          headerStyle: { backgroundColor: '#0a0e1a' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* User profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name || 'Citizen'}</Text>
            <Text style={styles.profilePhone}>📞 {user?.phone || '+91 98765 00001'}</Text>
            <Text style={styles.profileBadge}>🛡️ ABDM Health ID: Linked & Verified</Text>
          </View>
        </View>

        {/* Emergency Contacts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👨‍👩‍👧 Emergency Contacts</Text>
          <Text style={styles.sectionSub}>
            These contacts will automatically receive an SMS alert and your live GPS location whenever you trigger an SOS.
          </Text>

          <View style={styles.addContactForm}>
            <TextInput
              style={styles.input}
              placeholder="Contact Name (e.g. Mom, Brother, Doctor)"
              placeholderTextColor="#64748b"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number (e.g. +91 98765 43210)"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddContact}>
              <Text style={styles.addBtnText}>+ Add Emergency Contact</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16 }}>
            {emergencyContacts && emergencyContacts.length > 0 ? (
              emergencyContacts.map((item) => (
                <View key={item.id} style={styles.contactItem}>
                  <View>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactPhone}>📞 {item.phone}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeEmergencyContact(item.id)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No emergency contacts added yet. Add family or friends above.</Text>
            )}
          </View>
        </View>

        {/* Log Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', padding: 20 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 22 },
  profileName: { color: '#f1f5f9', fontWeight: '800', fontSize: 18 },
  profilePhone: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  profileBadge: { color: '#22c55e', fontSize: 11, fontWeight: '700', marginTop: 4 },

  section: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 18 },
  
  addContactForm: { gap: 10 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 4
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  contactName: { color: '#f1f5f9', fontWeight: '700', fontSize: 15 },
  contactPhone: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  removeBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8 },
  removeBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },
  emptyText: { color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginVertical: 14 },

  logoutBtn: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 10,
  },
  logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
});
