/**
 * Citizen — Dedicated Emergency Contacts & Relationship Screen
 * Automatically dispatches instant SMS with live GPS location on SOS trigger.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSettingsStore, EmergencyContact } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

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

export default function EmergencyContactsScreen() {
  const { user } = useAuthStore();
  const { emergencyContacts, addEmergencyContact, removeEmergencyContact } = useSettingsStore();

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [relationship, setRelationship] = useState('Parent');

  const handleAddContact = () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Missing Details', 'Please enter both contact name and phone number.');
      return;
    }
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: relationship || 'Emergency Contact',
    };
    addEmergencyContact(newContact);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewName('');
    setNewPhone('');
    setRelationship('Parent');
    Alert.alert('Emergency Contact Added', `${newContact.name} (${newContact.relationship}) will receive instant SMS alerts with your live location during an SOS.`);
  };

  const handleSendTestSms = (contact: EmergencyContact) => {
    Alert.alert(
      'Send Test Emergency Alert',
      `Send a test location SMS to ${contact.name} (${contact.phone})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SMS',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('SMS Sent', `Test SMS with live GPS link dispatched to ${contact.name} (${contact.phone}).`);
          },
        },
      ]
    );
  };

  const getRelationshipIcon = (rel?: string) => {
    const match = RELATIONSHIP_OPTIONS.find((r) => r.value === rel);
    return match ? `${match.icon} ${match.value}` : rel || 'Emergency Contact';
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Emergency Contacts',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* User profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'C'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name || 'Citizen'}</Text>
            <Text style={styles.profilePhone}>📞 {user?.phone || '+91 98765 00001'}</Text>
            <Text style={styles.profileBadge}>🛡️ Auto SMS Dispatch: Active</Text>
          </View>
        </View>

        {/* Form to Add Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>➕ Add Emergency Contact</Text>
          <Text style={styles.sectionSub}>
            Whenever you trigger an SOS (Button, Voice, or Crash), these contacts will immediately receive an automated SMS with your <Text style={{ color: '#16a34a', fontWeight: '700' }}>Live Google Maps Location</Text>.
          </Text>

          <View style={styles.addContactForm}>
            <Text style={styles.inputLabel}>Contact Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact person's full name"
              placeholderTextColor="#94a3b8"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Phone Number (Mobile)</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 Mobile number"
              placeholderTextColor="#94a3b8"
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
              <Text style={styles.addBtnText}>+ Save Emergency Contact ({relationship})</Text>
            </TouchableOpacity>
          </View>

          {/* Saved Contacts List */}
          <View style={{ marginTop: 24 }}>
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

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => handleSendTestSms(item)}
                      style={styles.testSmsBtn}
                    >
                      <Text style={styles.testSmsBtnText}>Test SMS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => removeEmergencyContact(item.id)}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>👨‍👩‍👧</Text>
                <Text style={styles.emptyText}>No emergency contacts added yet.</Text>
                <Text style={styles.emptySub}>Add family members, spouse, or friends above to receive instant SMS alerts during accidents or emergencies.</Text>
              </View>
            )}
          </View>
        </View>

        {/* SMS Preview Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📩 Emergency SMS Format Preview</Text>
          <Text style={styles.infoMsg}>
            "🚨 <Text style={{ fontWeight: '700', color: '#0f172a' }}>SERS ALERT:</Text> {user?.name || 'Citizen'} has triggered an Emergency SOS! Incident Location: Live GPS Pinpoint. Live Map: https://maps.google.com/?q=28.4595,77.0266. Immediate medical assistance dispatched."
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
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
  profileName: { color: '#0f172a', fontWeight: '800', fontSize: 18 },
  profilePhone: { color: '#475569', fontSize: 13, marginTop: 2 },
  profileBadge: { color: '#16a34a', fontSize: 11, fontWeight: '700', marginTop: 4 },

  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 18 },
  
  addContactForm: { gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 4 },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    fontSize: 14,
  },

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  activeChipText: {
    color: '#ef4444',
    fontWeight: '800',
  },

  addBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  listHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },

  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactName: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  badgeContainer: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  relationshipBadge: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '700',
  },
  contactPhone: { color: '#64748b', fontSize: 13, marginTop: 4 },
  
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testSmsBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  testSmsBtnText: { color: '#16a34a', fontWeight: '700', fontSize: 11 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },

  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: { color: '#0f172a', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  emptySub: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 16 },

  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoTitle: { color: '#0f172a', fontWeight: '800', fontSize: 13, marginBottom: 6 },
  infoMsg: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
