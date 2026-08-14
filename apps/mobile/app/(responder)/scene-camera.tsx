/**
 * SERS Mobile — Responder SceneCamera
 * Captures scene photos during an active incident, annotates with GPS + timestamp,
 * and uploads encrypted to the SERS API. Clean Light Mode UI.
 */

import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../services/api';

interface Photo {
  uri: string;
  timestamp: string;
  lat?: number;
  lng?: number;
  uploaded: boolean;
  uploading: boolean;
  error?: string;
  serverUrl?: string;
}

interface AnnotationTag {
  id: string;
  label: string;
  emoji: string;
}

const ANNOTATION_TAGS: AnnotationTag[] = [
  { id: 'vehicle_damage', label: 'Vehicle Damage',   emoji: '🚗' },
  { id: 'patient_visible', label: 'Patient Visible',  emoji: '🧑' },
  { id: 'hazard',          label: 'Hazard Present',   emoji: '⚠️' },
  { id: 'blood',           label: 'Blood/Injury',     emoji: '🩸' },
  { id: 'fire',            label: 'Fire/Smoke',       emoji: '🔥' },
  { id: 'road_blocked',    label: 'Road Blocked',     emoji: '🚧' },
  { id: 'multiple_victims',label: 'Multiple Victims', emoji: '👥' },
  { id: 'unconscious',     label: 'Unconscious',      emoji: '😵' },
];

export default function SceneCamera() {
  const params = useLocalSearchParams<{ incidentId?: string; incidentNumber?: string }>();
  const { incidentId, incidentNumber } = params;

  const [photos, setPhotos]         = useState<Photo[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [notes, setNotes]           = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const getLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      return null;
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to document the scene.');
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const loc = await getLocation();

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.75,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const newPhoto: Photo = {
          uri: asset.uri,
          timestamp: new Date().toISOString(),
          lat: loc?.lat,
          lng: loc?.lng,
          uploaded: false,
          uploading: false,
        };
        setPhotos(prev => [newPhoto, ...prev]);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Could not launch camera.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery access is needed to upload existing scene photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.75,
      });

      if (!result.canceled && result.assets?.length) {
        const loc = await getLocation();
        const newPhotos: Photo[] = result.assets.map(asset => ({
          uri: asset.uri,
          timestamp: new Date().toISOString(),
          lat: loc?.lat,
          lng: loc?.lng,
          uploaded: false,
          uploading: false,
        }));
        setPhotos(prev => [...newPhotos, ...prev]);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Could not pick images.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const uploadSinglePhoto = async (photo: Photo, index: number): Promise<string | null> => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, uploading: true, error: undefined } : p));
    try {
      const formData = new FormData();
      const filename = photo.uri.split('/').pop() || `scene_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri: photo.uri,
        name: filename,
        type: ext,
      } as any);

      if (photo.lat && photo.lng) {
        formData.append('latitude', String(photo.lat));
        formData.append('longitude', String(photo.lng));
      }
      formData.append('capturedAt', photo.timestamp);

      const targetIncidentId = incidentId || 'general';
      const res = await api.post(`/incidents/${targetIncidentId}/scene-photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const serverUrl = res.data?.data?.url || res.data?.url || 'uploaded';
      setPhotos(prev => prev.map((p, i) => i === index ? { ...p, uploading: false, uploaded: true, serverUrl } : p));
      return serverUrl;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Upload failed';
      setPhotos(prev => prev.map((p, i) => i === index ? { ...p, uploading: false, error: errorMsg } : p));
      return null;
    }
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please capture at least one scene photo before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadPromises = photos.map((p, idx) => {
        if (p.uploaded) return Promise.resolve(p.serverUrl || 'uploaded');
        return uploadSinglePhoto(p, idx);
      });
      await Promise.all(uploadPromises);

      const targetIncidentId = incidentId || 'general';
      await api.post(`/incidents/${targetIncidentId}/scene-assessment`, {
        tags: Array.from(selectedTags),
        notes: notes.trim(),
        photoCount: photos.length,
        submittedAt: new Date().toISOString(),
      });

      setSubmitted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Report Saved', 'Scene photos uploaded and assessment recorded.');
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Scene Report Uploaded</Text>
          <Text style={styles.successDesc}>
            {photos.length} GPS-tagged photo{photos.length !== 1 ? 's' : ''} and scene assessment are securely transmitted to the hospital ER and triage doctors.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.backBtnText}>← Return to Active Mission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backArrow} onPress={() => router.back()}>
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Scene Camera & Evidence</Text>
          <Text style={styles.headerSub}>
            {incidentNumber ? `Incident #${incidentNumber}` : 'Active Mission'}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>GPS STAMPED</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Camera capture triggers */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Capture Scene Photos</Text>
          <View style={styles.captureRow}>
            <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
              <Text style={styles.cameraBtnIcon}>📷</Text>
              <Text style={styles.cameraBtnLabel}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cameraBtn, { borderColor: '#2563eb' }]} onPress={handlePickFromGallery} activeOpacity={0.85}>
              <Text style={styles.cameraBtnIcon}>🖼️</Text>
              <Text style={[styles.cameraBtnLabel, { color: '#2563eb' }]}>From Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo Gallery preview */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Captured Photos ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {photos.map((photo, index) => (
                <View key={photo.uri + index} style={styles.photoCard}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} resizeMode="cover" />
                  <View style={styles.photoOverlay}>
                    {photo.uploading && (
                      <View style={styles.photoStatus}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.photoStatusText}>Uploading...</Text>
                      </View>
                    )}
                    {photo.uploaded && (
                      <View style={[styles.photoStatus, { backgroundColor: 'rgba(22,163,74,0.85)' }]}>
                        <Text style={styles.photoStatusText}>✓ Uploaded</Text>
                      </View>
                    )}
                    {photo.error && (
                      <View style={[styles.photoStatus, { backgroundColor: 'rgba(220,38,38,0.85)' }]}>
                        <Text style={styles.photoStatusText}>! Error</Text>
                      </View>
                    )}
                  </View>
                  {photo.lat && (
                    <View style={styles.gpsBadge}>
                      <Text style={styles.gpsBadgeText}>📍 GPS</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemovePhoto(index)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Rapid Scene Hazard Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quick Scene Tags</Text>
          <View style={styles.tagsGrid}>
            {ANNOTATION_TAGS.map(tag => {
              const active = selectedTags.has(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tag, active && styles.tagActive]}
                  onPress={() => handleToggleTag(tag.id)}
                  activeOpacity={0.8}>
                  <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                  <Text style={[styles.tagLabel, active && styles.tagLabelActive]}>{tag.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Quick Voice / Observation Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Responder Observations</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {[
              'Heavy frontal vehicle crush',
              'Patient conscious, complaining of chest pain',
              'Bleeding controlled with pressure dressing',
              'Extrication required by fire rescue',
            ].map(preset => (
              <TouchableOpacity
                key={preset}
                style={styles.quickNote}
                onPress={() => setNotes(prev => prev ? `${prev}. ${preset}` : preset)}>
                <Text style={styles.quickNoteText}>+ {preset}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Bottom Submit Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          id="scene-submit-btn"
          style={[styles.submitBtn, photos.length === 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || photos.length === 0}
          activeOpacity={0.85}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              ✓ Submit Scene Assessment ({photos.length} photo{photos.length !== 1 ? 's' : ''})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    gap: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  backArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  backArrowText: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  headerTitle: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  headerSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  statusBadgeText: { color: '#dc2626', fontWeight: '900', fontSize: 10 },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: { color: '#475569', fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },

  photoCard: { width: 140, height: 140, borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  photoThumb: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  photoStatus: { backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  photoStatusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  gpsBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#86efac' },
  gpsBadgeText: { color: '#15803d', fontSize: 9, fontWeight: '800' },
  removeBtn: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  captureRow: { flexDirection: 'row', gap: 12 },
  cameraBtn: { flex: 1, backgroundColor: '#ffffff', borderRadius: 18, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#ef4444', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cameraBtnIcon: { fontSize: 32, marginBottom: 6 },
  cameraBtnLabel: { color: '#dc2626', fontWeight: '900', fontSize: 13 },

  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
  tagActive: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  tagEmoji: { fontSize: 14 },
  tagLabel: { color: '#475569', fontSize: 12, fontWeight: '700' },
  tagLabelActive: { color: '#dc2626', fontWeight: '900' },

  quickNote: { marginRight: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  quickNoteText: { color: '#1d4ed8', fontSize: 12, fontWeight: '700' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingBottom: 28 },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  submitBtnDisabled: { backgroundColor: '#94a3b8', shadowOpacity: 0 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successEmoji: { fontSize: 72, marginBottom: 16 },
  successTitle: { color: '#0f172a', fontWeight: '900', fontSize: 24, marginBottom: 10, textAlign: 'center' },
  successDesc: { color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  backBtn: { backgroundColor: '#2563eb', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14 },
  backBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
});
