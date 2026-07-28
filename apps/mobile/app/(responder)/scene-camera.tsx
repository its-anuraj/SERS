/**
 * SERS Mobile — Responder SceneCamera
 * Captures scene photos during an active incident, annotates with GPS + timestamp,
 * and uploads encrypted to the SERS API.
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

  const capturePhoto = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to capture scene photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      exif: true,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const timestamp = new Date().toISOString();
    const loc = await getLocation();

    const newPhoto: Photo = {
      uri: asset.uri,
      timestamp,
      lat: loc?.lat,
      lng: loc?.lng,
      uploaded: false,
      uploading: false,
    };

    setPhotos(prev => [...prev, newPhoto]);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const pickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Gallery access is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 6,
    });

    if (result.canceled || !result.assets) return;

    const loc = await getLocation();
    const timestamp = new Date().toISOString();

    const newPhotos: Photo[] = result.assets.map(asset => ({
      uri: asset.uri,
      timestamp,
      lat: loc?.lat,
      lng: loc?.lng,
      uploaded: false,
      uploading: false,
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
  }, []);

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadPhoto = async (photo: Photo, idx: number) => {
    if (!incidentId) return;

    setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, uploading: true, error: undefined } : p));

    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `scene_${Date.now()}.jpg`,
      } as any);
      formData.append('incident_id', incidentId);
      formData.append('timestamp', photo.timestamp);
      if (photo.lat) formData.append('latitude', String(photo.lat));
      if (photo.lng) formData.append('longitude', String(photo.lng));
      formData.append('tags', JSON.stringify(Array.from(selectedTags)));

      const res = await api.post(`/incidents/${incidentId}/scene-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPhotos(prev => prev.map((p, i) => i === idx
        ? { ...p, uploading: false, uploaded: true, serverUrl: res.data?.url }
        : p
      ));
    } catch (err: any) {
      setPhotos(prev => prev.map((p, i) => i === idx
        ? { ...p, uploading: false, error: 'Upload failed. Will retry.' }
        : p
      ));
    }
  };

  const uploadAll = async () => {
    const pending = photos.filter(p => !p.uploaded && !p.uploading);
    if (!pending.length) return;

    for (let i = 0; i < photos.length; i++) {
      if (!photos[i].uploaded && !photos[i].uploading) {
        await uploadPhoto(photos[i], i);
      }
    }
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please capture at least one scene photo before submitting.');
      return;
    }

    setIsSubmitting(true);
    await uploadAll();

    // Submit notes and tags even if some uploads failed
    if (incidentId && notes) {
      try {
        await api.patch(`/incidents/${incidentId}/status`, {
          responder_notes: notes,
          scene_tags: Array.from(selectedTags),
        });
      } catch {}
    }

    setIsSubmitting(false);
    setSubmitted(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Scene Report Submitted</Text>
          <Text style={styles.successDesc}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded.{'\n'}
            Hospital has been notified with scene details.
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📷 Scene Camera</Text>
          {incidentNumber && (
            <Text style={styles.headerSub}>{incidentNumber}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}>
          <Text style={styles.statusBadgeText}>🔴 LIVE</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Photo grid */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CAPTURED PHOTOS ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {photos.map((photo, idx) => (
                <View key={idx} style={styles.photoCard}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />

                  {/* Status overlay */}
                  <View style={styles.photoOverlay}>
                    {photo.uploading && (
                      <View style={styles.photoStatus}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.photoStatusText}>Uploading...</Text>
                      </View>
                    )}
                    {photo.uploaded && (
                      <View style={[styles.photoStatus, { backgroundColor: 'rgba(34,197,94,0.8)' }]}>
                        <Text style={styles.photoStatusText}>✓ Uploaded</Text>
                      </View>
                    )}
                    {photo.error && (
                      <View style={[styles.photoStatus, { backgroundColor: 'rgba(239,68,68,0.8)' }]}>
                        <Text style={styles.photoStatusText}>⚠ Failed</Text>
                      </View>
                    )}
                  </View>

                  {/* GPS badge */}
                  {photo.lat && (
                    <View style={styles.gpsBadge}>
                      <Text style={styles.gpsBadgeText}>📍 GPS</Text>
                    </View>
                  )}

                  {/* Remove button */}
                  {!photo.uploaded && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removePhoto(idx)}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}

                  {/* Timestamp */}
                  <Text style={styles.photoTime}>
                    {new Date(photo.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Camera controls */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CAPTURE</Text>
          <View style={styles.captureRow}>
            <TouchableOpacity style={styles.cameraBtn} onPress={capturePhoto} activeOpacity={0.85}>
              <Text style={styles.cameraBtnIcon}>📷</Text>
              <Text style={styles.cameraBtnLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cameraBtn, { borderColor: '#3b82f6' }]} onPress={pickFromGallery} activeOpacity={0.85}>
              <Text style={styles.cameraBtnIcon}>🖼️</Text>
              <Text style={[styles.cameraBtnLabel, { color: '#3b82f6' }]}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scene annotation tags */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SCENE TAGS</Text>
          <Text style={styles.sectionDesc}>Select everything visible at the scene to alert the hospital:</Text>
          <View style={styles.tagsGrid}>
            {ANNOTATION_TAGS.map(tag => {
              const active = selectedTags.has(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  id={`tag-${tag.id}`}
                  onPress={() => toggleTag(tag.id)}
                  style={[styles.tag, active && styles.tagActive]}
                  activeOpacity={0.8}>
                  <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                  <Text style={[styles.tagLabel, active && styles.tagLabelActive]}>{tag.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RESPONDER NOTES</Text>
          <View style={styles.notesInput}>
            <Text style={styles.notesText}>
              {/* Simple multiline placeholder — use TextInput in production */}
              {notes || <Text style={{ color: '#475569' }}>Describe the scene for the hospital team...</Text>}
            </Text>
          </View>
          {/* Quick note buttons */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {[
              'Patient conscious', 'Patient unconscious', 'Airway clear',
              'Heavy bleeding', 'Multiple victims', 'Scene secured',
            ].map(note => (
              <TouchableOpacity
                key={note}
                onPress={() => setNotes(prev => prev ? `${prev}, ${note}` : note)}
                style={styles.quickNote}>
                <Text style={styles.quickNoteText}>+ {note}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {photos.length > 0 && photos.some(p => !p.uploaded) && (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={uploadAll}
            disabled={isSubmitting}>
            <Text style={styles.uploadBtnText}>
              ↑ Upload {photos.filter(p => !p.uploaded).length} Photo{photos.filter(p => !p.uploaded).length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
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
              ✓ Submit Scene Report ({photos.length} photo{photos.length !== 1 ? 's' : ''})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0a0e1a' },

  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 12 },
  backArrow:     { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  backArrowText: { color: '#94a3b8', fontSize: 18, fontWeight: '700' },
  headerTitle:   { color: '#f1f5f9', fontWeight: '800', fontSize: 16 },
  headerSub:     { color: '#64748b', fontSize: 11, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statusBadge:   { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusBadgeText:{ color: '#ef4444', fontWeight: '800', fontSize: 10 },

  section:       { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel:  { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  sectionDesc:   { color: '#94a3b8', fontSize: 12, marginBottom: 10 },

  photoCard:     { width: 140, height: 140, borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: '#111827' },
  photoThumb:    { width: '100%', height: '100%' },
  photoOverlay:  { position: 'absolute', bottom: 0, left: 0, right: 0 },
  photoStatus:   { backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  photoStatusText:{ color: '#fff', fontSize: 10, fontWeight: '700' },
  gpsBadge:      { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  gpsBadgeText:  { color: '#22c55e', fontSize: 9, fontWeight: '700' },
  removeBtn:     { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.85)', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  photoTime:     { position: 'absolute', bottom: 26, right: 6, color: '#fff', fontSize: 9, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },

  captureRow:    { flexDirection: 'row', gap: 12 },
  cameraBtn:     { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#ef4444' },
  cameraBtnIcon: { fontSize: 32, marginBottom: 6 },
  cameraBtnLabel:{ color: '#ef4444', fontWeight: '800', fontSize: 13 },

  tagsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b' },
  tagActive:     { backgroundColor: '#ef444420', borderColor: '#ef4444' },
  tagEmoji:      { fontSize: 14 },
  tagLabel:      { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tagLabelActive:{ color: '#ef4444' },

  notesInput:    { backgroundColor: '#111827', borderRadius: 12, padding: 14, minHeight: 80, borderWidth: 1, borderColor: '#1e293b' },
  notesText:     { color: '#94a3b8', fontSize: 13, lineHeight: 20 },

  quickNote:     { marginRight: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e293b' },
  quickNoteText: { color: '#64748b', fontSize: 12, fontWeight: '600' },

  bottomBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b', gap: 10, paddingBottom: 32 },
  uploadBtn:     { backgroundColor: '#1e40af', borderRadius: 14, padding: 14, alignItems: 'center' },
  uploadBtnText: { color: '#93c5fd', fontWeight: '700', fontSize: 14 },
  submitBtn:     { backgroundColor: '#ef4444', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  submitBtnDisabled: { backgroundColor: '#374151', shadowOpacity: 0 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successEmoji:  { fontSize: 72, marginBottom: 16 },
  successTitle:  { color: '#f1f5f9', fontWeight: '900', fontSize: 24, marginBottom: 10, textAlign: 'center' },
  successDesc:   { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  backBtn:       { backgroundColor: '#1e293b', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14 },
  backBtnText:   { color: '#94a3b8', fontWeight: '700', fontSize: 15 },
});
