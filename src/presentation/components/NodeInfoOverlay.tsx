import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../../infrastructure/database';

type NodeInfoOverlayProps = {
  citizen: {
    id: string;
    alias: string;
    localName?: string;
    merit: number;
    level: number;
  };
  onClose: () => void;
  onViewProfile: () => void;
  onUpdateLocalName: (newName: string | undefined) => void;
};

export const NodeInfoOverlay = ({ citizen, onClose, onViewProfile, onUpdateLocalName }: NodeInfoOverlayProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(citizen.localName || '');
  const insets = useSafeAreaInsets();

  // Si cambia el nodo seleccionado, resetear el estado
  useEffect(() => {
    setIsEditing(false);
    setEditValue(citizen.localName || '');
  }, [citizen.id, citizen.localName]);

  const handleSave = async () => {
    try {
      const finalName = editValue.trim() === '' ? undefined : editValue.trim();
      const citRecord = await database.collections.get('citizens').find(citizen.id);
      
      await database.write(async () => {
        await citRecord.update((record: any) => {
          record.localName = finalName;
        });
      });
      
      setIsEditing(false);
      onUpdateLocalName(finalName);
    } catch (error) {
      console.error('Error actualizando nombre local:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      style={[styles.overlayContainer, { paddingBottom: Math.max(insets.bottom, 40) + 20 }]}
      pointerEvents="box-none"
    >
      <Animated.View 
        entering={FadeInDown.duration(300).springify()} 
        exiting={FadeOutDown.duration(200)}
      >
        <View style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            {isEditing ? (
              <TextInput 
                style={styles.input}
                value={editValue}
                onChangeText={setEditValue}
                placeholder="Nombre de confianza..."
                placeholderTextColor="#64748b"
                autoFocus
                onSubmitEditing={handleSave}
              />
            ) : (
              <View style={styles.nameRow}>
                {citizen.localName ? (
                  <>
                    <Text style={styles.localName} numberOfLines={1}>{citizen.localName}</Text>
                    {citizen.level !== 0 && (
                      <TouchableOpacity onPress={() => setIsEditing(true)}>
                        <Text style={styles.editIcon}>✏️</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.aliasPublicMain} numberOfLines={1}>{citizen.alias}</Text>
                    {citizen.level !== 0 && (
                      <TouchableOpacity onPress={() => setIsEditing(true)}>
                        <Text style={styles.editIcon}>✏️</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {!isEditing && citizen.localName && (
              <Text style={styles.aliasPublic}>{citizen.alias} (Público)</Text>
            )}

            <Text style={styles.levelText}>
              {citizen.level === 0 ? 'Tú' : `Conexión de Grado ${citizen.level}`}
            </Text>
          </View>
          
          <View style={styles.meritBadge}>
            <Text style={styles.meritText}>{citizen.merit}</Text>
            <Text style={styles.meritLabel}>Mérito</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {isEditing ? (
            <>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setIsEditing(false)}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
                <Text style={styles.btnPrimaryText}>Guardar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={onViewProfile}>
                <Text style={styles.btnPrimaryText}>Ver Perfil</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  card: {
    backgroundColor: '#0f172a', // Slate 900
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b', // Slate 800
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  localName: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  editIcon: {
    fontSize: 16,
    opacity: 0.8,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 8,
  },
  aliasPublic: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  aliasPublicMain: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  levelText: {
    color: '#3b82f6', // Azul
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  meritBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  meritText: {
    color: '#10b981', // Verde
    fontSize: 20,
    fontWeight: '900',
  },
  meritLabel: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
