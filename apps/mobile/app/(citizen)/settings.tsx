import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  TextInput, FlatList, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Stack } from 'expo-router';
import { useSettingsStore, EmergencyContact } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';

export default function CitizenSettingsScreen() {
  const { logout } = useAuthStore();
  const { appEnabled, toggleAppEnabled, emergencyContacts, addEmergencyContact, removeEmergencyContact } = useSettingsStore();

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
          title: 'Settings',
          headerStyle: { backgroundColor: '#0a0e1a' },
          headerTintColor: '#fff',
        }}
      />
      
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.sectionTitle}>SERS Protection</Text>
            <Text style={styles.sectionSub}>Enable AI crash, voice & health monitoring.</Text>
          </View>
          <Switch
            value={appEnabled}
            onValueChange={toggleAppEnabled}
            trackColor={{ false: '#334155', true: '#ef4444' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contacts</Text>
        <Text style={styles.sectionSub}>These contacts will receive an SMS and your live location when SOS is triggered.</Text>

        <View style={styles.addContactForm}>
          <TextInput
            style={styles.input}
            placeholder="Name (e.g. Mom)"
            placeholderTextColor="#64748b"
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={newPhone}
            onChangeText={setNewPhone}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddContact}>
            <Text style={styles.addBtnText}>+ Add Contact</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={emergencyContacts}
          keyExtractor={(item) => item.id}
          style={{ marginTop: 16 }}
          renderItem={({ item }) => (
            <View style={styles.contactItem}>
              <View>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.contactPhone}>{item.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => removeEmergencyContact(item.id)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No emergency contacts added yet.</Text>}
        />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', padding: 20 },
  section: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: '80%' },
  
  addContactForm: { gap: 10 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155'
  },
  addBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4
  },
  addBtnText: { color: '#fff', fontWeight: '700' },

  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  contactName: { color: '#f1f5f9', fontWeight: '600', fontSize: 15 },
  contactPhone: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  removeBtn: { padding: 8 },
  removeBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  emptyText: { color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  logoutBtn: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: '#334155'
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },
});
