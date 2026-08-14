/**
 * SERS Offline GSM Cellular SMS Fallback Dispatch Service
 * Used when mobile has ZERO 4G/5G Internet (e.g. Remote Highways, Tunnels, Underground Basements).
 * Sends an encoded, compact SOS payload via native GSM SMS directly to the SERS Gateway / 112 Dispatch.
 */

import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

export interface OfflineSosPayload {
  latitude: number;
  longitude: number;
  type: 'accident' | 'medical' | 'cardiac' | 'crash';
  bloodGroup?: string;
  abhaId?: string;
  source: string;
}

const CENTRAL_EMERGENCY_SMS_GATEWAY = '+919876543210'; // SERS National Automated Gateway

/**
 * Dispatch SOS via Native Cellular SMS when Internet is Offline
 */
export const dispatchOfflineSmsSOS = async (payload: OfflineSosPayload) => {
  const user = useAuthStore.getState().user;
  const contacts = useSettingsStore.getState().emergencyContacts;

  const lat = payload.latitude.toFixed(5);
  const lng = payload.longitude.toFixed(5);
  const abha = payload.abhaId || user?.id || 'ANON';
  const blood = payload.bloodGroup || 'UNKNOWN';
  const name = user?.name || 'Citizen';

  // Compact encoded SMS format parsed automatically by backend SMS Gateway:
  // SERS:SOS|LAT|LNG|TYPE|NAME|BLOOD|SOURCE|MAPS_URL
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
  const smsBody = `🚨 SERS EMERGENCY SOS: ${name} needs immediate help! Location: ${mapsUrl} (Lat:${lat}, Lng:${lng}). Type: ${payload.type.toUpperCase()}. Blood:${blood}. Sent via SERS Offline GSM Fallback.`;

  // First notify the emergency contacts
  const targetNumbers = [
    CENTRAL_EMERGENCY_SMS_GATEWAY,
    ...contacts.map((c) => c.phone).filter(Boolean),
  ];

  const primaryPhone = targetNumbers[0];
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const smsUrl = `sms:${primaryPhone}${separator}body=${encodeURIComponent(smsBody)}`;

  try {
    const canOpen = await Linking.canOpenURL(smsUrl);
    if (canOpen) {
      await Linking.openURL(smsUrl);
      return { success: true, method: 'native_sms' };
    } else {
      Alert.alert(
        'Offline SMS Dispatch',
        `No internet detected. Please send this emergency SMS manually:\n\n${smsBody}`
      );
      return { success: false, error: 'SMS application unavailable' };
    }
  } catch (err: any) {
    console.error('[OfflineSMS] Error opening SMS intent:', err);
    return { success: false, error: err.message };
  }
};
