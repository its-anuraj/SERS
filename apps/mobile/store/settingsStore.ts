import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

interface SettingsState {
  // Master Switch
  appEnabled: boolean;
  
  // Citizen Settings
  emergencyContacts: EmergencyContact[];
  
  // Responder Settings
  dutyStatus: 'on_duty' | 'on_leave';

  // Actions
  toggleAppEnabled: (enabled: boolean) => Promise<void>;
  addEmergencyContact: (contact: EmergencyContact) => Promise<void>;
  removeEmergencyContact: (id: string) => Promise<void>;
  setDutyStatus: (status: 'on_duty' | 'on_leave') => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  appEnabled: true, // Default to true
  emergencyContacts: [],
  dutyStatus: 'on_duty',

  loadSettings: async () => {
    try {
      const storedAppEnabled = await SecureStore.getItemAsync('sers_app_enabled');
      const storedContacts = await SecureStore.getItemAsync('sers_emergency_contacts');
      const storedDutyStatus = await SecureStore.getItemAsync('sers_duty_status');

      set({
        appEnabled: storedAppEnabled !== null ? storedAppEnabled === 'true' : true,
        emergencyContacts: storedContacts ? JSON.parse(storedContacts) : [],
        dutyStatus: (storedDutyStatus as 'on_duty' | 'on_leave') || 'on_duty',
      });
    } catch (error) {
      console.error('Failed to load settings', error);
    }
  },

  toggleAppEnabled: async (enabled: boolean) => {
    set({ appEnabled: enabled });
    await SecureStore.setItemAsync('sers_app_enabled', enabled ? 'true' : 'false');
  },

  addEmergencyContact: async (contact: EmergencyContact) => {
    const contacts = [...get().emergencyContacts, contact];
    set({ emergencyContacts: contacts });
    await SecureStore.setItemAsync('sers_emergency_contacts', JSON.stringify(contacts));
  },

  removeEmergencyContact: async (id: string) => {
    const contacts = get().emergencyContacts.filter(c => c.id !== id);
    set({ emergencyContacts: contacts });
    await SecureStore.setItemAsync('sers_emergency_contacts', JSON.stringify(contacts));
  },

  setDutyStatus: async (status: 'on_duty' | 'on_leave') => {
    set({ dutyStatus: status });
    await SecureStore.setItemAsync('sers_duty_status', status);
  }
}));
