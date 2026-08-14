import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Stack } from 'expo-router';
import { useSettingsStore, EmergencyContact } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';

const RELATIONSHIP_OPTIONS = [
  { label: 'Parent (Mata/Pita)', icon: '👨‍👩‍👧', value: 'Parent' },
  { label: 'Spouse (Pati/Patni)', icon: '💍', value: 'Spouse' },
  { label: 'Sibling (Bhai/Behen)', icon: '👫', value: 'Sibling' },
  { label: 'Child (Beta/Beti)', icon: '👶', value: 'Child' },
  { label: 'Friend (Dost)', icon: '🤝', value: 'Friend' },
  { label: 'Doctor', icon: '🩺', value: 'Doctor' },
  { label: 'Guardian', icon: '🛡️', value: 'Guardian' },
  { label: 'Other Relative', icon: '👥', value: 'Other' },
];

export default function CitizenSettingsScreen() {
  const { user, logout } = useAuthStore();
  const { emergencyContacts, addEmergencyContact, removeEmergencyContact } = useSettingsStore();

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [relationship, setRelationship] = useState('Parent');

  const handleAddContact = () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Error', 'Please enter both name and phone number.');
      return;
    }
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: relationship || 'Emergency Contact',
    };
    addEmergencyContact(newContact);
    setNewName('');
    setNewPhone('');
    setRelationship('Parent');
    Alert.alert('Contact Added', `${newName.trim()} (${relationship}) added to emergency alert list.`);
  };

  const getRelationshipIcon = (rel?: string) => {
    const match = RELATIONSHIP_OPTIONS.find(r => r.value === rel);
    return match ? `${match.icon} ${match.value}` : rel || 'Emergency Contact';
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
          <Text style={styles.sectionTitle}>👨‍👩‍👧 Emergency Contacts & Relationship</Text>
          <Text style={styles.sectionSub}>
            Whenever you trigger an SOS, these contacts instantly receive an SMS alert with your live GPS location and relationship details.
          </Text>

          <View style={styles.addContactForm}>
            <Text style={styles.inputLabel}>Contact Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ramesh Kumar, Sunita Devi, Dr. Sharma"
              placeholderTextColor="#64748b"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />

            {/* Relationship Chips */}
            <Text style={styles.inputLabel}>Relationship (Rishta)</Text>
            <View style={styles.chipContainer}>
              {RELATIONSHIP_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.chip,
                    relationship === item.value && styles.activeChip,
                  ]}
                  onPress={() => setRelationship(item.value)}
                >
                  <Text style={[styles.chipText, relationship === item.value && styles.activeChipText]}>
                    {item.icon} {item.value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAddContact}>
              <Text style={styles.addBtnText}>+ Add Emergency Contact ({relationship})</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 20 }}>
            <Text style={styles.listHeader}>
              Saved Emergency Contacts ({emergencyContacts?.length || 0})
            </Text>

            {emergencyContacts && emergencyContacts.length > 0 ? (
              emergencyContacts.map((item) => (
                <View key={item.id} style={styles.contactItem}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <View style={styles.badgeContainer}>
                        <Text style={styles.relationshipBadge}>{getRelationshipIcon(item.relationship)}</Text>
                      </View>
                    </View>
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
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 18 },
  
  addContactForm: { gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginTop: 4 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeChipText: {
    color: '#ef4444',
    fontWeight: '800',
  },

  addBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  listHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 10,
  },

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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactName: { color: '#f1f5f9', fontWeight: '700', fontSize: 15 },
  badgeContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  relationshipBadge: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
  },
  contactPhone: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  removeBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8 },
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
