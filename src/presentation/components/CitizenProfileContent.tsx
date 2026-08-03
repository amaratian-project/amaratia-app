import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { database } from '../../infrastructure/database';

type CitizenProfileContentProps = {
  citizen: {
    id: string;
    alias: string;
    npub?: string;
    localName?: string;
    merit: number;
    level: number;
  };
  onClose: () => void;
  onViewProfile: () => void;
  onUpdateLocalName: (newName: string | undefined) => void;
  onRevokeVisa?: () => void;
  onOpenChat?: () => void;
};

export const CitizenProfileContent = ({
  citizen,
  onClose,
  onViewProfile,
  onUpdateLocalName,
  onRevokeVisa,
  onOpenChat,
}: CitizenProfileContentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(citizen.localName || '');

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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          {isEditing ? (
            <BottomSheetTextInput 
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
            {citizen.level === 0 ? 'Tú (Nodo Raíz)' : `Conexión de Grado ${citizen.level}`}
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

            {citizen.level !== 0 && onOpenChat && (
              <TouchableOpacity
                style={styles.btnChat}
                onPress={onOpenChat}
              >
                <Text style={styles.btnChatText}>💬 Mensaje</Text>
              </TouchableOpacity>
            )}

            {citizen.level === 1 && onRevokeVisa && (
              <TouchableOpacity
                style={styles.btnDanger}
                onPress={onRevokeVisa}
              >
                <Text style={styles.btnDangerText}>Revocar</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.btnPrimary} onPress={onViewProfile}>
              <Text style={styles.btnPrimaryText}>Perfil</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
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
    color: '#3b82f6', 
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
    color: '#10b981', 
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
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnChat: {
    flex: 1.3,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    alignItems: 'center',
  },
  btnChatText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnDanger: {
    flex: 1.1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  btnDangerText: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  },
});

