/**
 * Citizen — Hospitals & ICU Beds Screen (Coming Soon)
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';

export default function HospitalsScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Hospitals & Beds',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Coming Soon Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 44 }}>🏥</Text>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>🚀 COMING SOON</Text>
          </View>

          <Text style={styles.title}>Live Hospital & ICU Beds</Text>
          <Text style={styles.subtitle}>
            We are integrating with Government (ABDM) and Private Hospital networks across India to bring you real-time verified ICU & Emergency bed availability.
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.returnBtn} onPress={() => router.back()}>
          <Text style={styles.returnBtnText}>← Return to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingTop: 40, alignItems: 'center' },

  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  badge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginBottom: 12,
  },
  badgeText: { color: '#dc2626', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 20 },

  returnBtn: {
    backgroundColor: '#2563eb',
    width: '100%',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  returnBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
