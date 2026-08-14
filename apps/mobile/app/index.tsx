/**
 * SERS Mobile — Main Root Screen
 * Dynamically renders AuthScreen, CitizenHomeScreen, or ResponderDashboard
 * Eliminates all Expo Router redirect loops and ensures instantaneous first-frame render.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import AuthScreen from './(auth)/index';
import CitizenHomeScreen from './(citizen)/index';
import ResponderDashboard from './(responder)/index';

export default function RootIndex() {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.splashLogo}>🆘 SERS</Text>
        <Text style={styles.splashSub}>Smart Emergency Response System</Text>
        <ActivityIndicator size="large" color="#ef4444" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // Not logged in -> Show Login / Register Screen
  if (!isAuthenticated || !user) {
    return <AuthScreen />;
  }

  // Logged in as Responder -> Show Ambulance Responder Dashboard
  if (user.role === 'responder') {
    return <ResponderDashboard />;
  }

  // Logged in as Citizen -> Show Main Citizen SOS Dashboard
  return <CitizenHomeScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashLogo: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 2,
  },
  splashSub: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
    fontWeight: '600',
  },
});
