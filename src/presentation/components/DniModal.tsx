import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { nip19, finalizeEvent } from 'nostr-tools';
import * as Clipboard from 'expo-clipboard';
import type { KeyPair } from '../../domain/identity/IIdentityUseCase';
import { CitizenRepositoryImpl } from '../../infrastructure/database/repositories/CitizenRepositoryImpl';
import { CivicProfile } from '../../domain/models/Title';

const { width } = Dimensions.get('window');

type DniModalProps = {
  identity: KeyPair;
  onClose: () => void;
};

export const DniModal = ({ identity, onClose }: DniModalProps) => {
  const [qrData, setQrData] = useState<string | null>(null);
  const [profile, setProfile] = useState<CivicProfile | null>(null);
  const [showAllProvinces, setShowAllProvinces] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Cargar Perfil Cívico y Títulos Evaluados Criptográficamente
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const repo = new CitizenRepositoryImpl();
        const prof = await repo.getMyCivicProfile(identity.npub);
        setProfile(prof);
      } catch (err) {
        console.error('Error cargando perfil cívico:', err);
      }
    };
    loadProfile();
  }, [identity.npub]);

  // Generador de Token QR Dinámico (Kind 21000 con rotación de 30s)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const generateToken = () => {
      try {
        const { type, data } = nip19.decode(identity.nsec);
        if (type !== 'nsec') throw new Error('Invalid nsec');

        const privateKeyBytes = data as Uint8Array;

        const event = {
          kind: 21000,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: 'Amaratia Visa Handshake',
        };

        const signedEvent = finalizeEvent(event, privateKeyBytes);
        setQrData(JSON.stringify(signedEvent));
      } catch (e) {
        console.error('Error firmando QR del DNI:', e);
      }
    };

    generateToken();
    timer = setInterval(generateToken, 30000);

    return () => clearInterval(timer);
  }, [identity.nsec]);

  const shortNpub = identity.npub
    ? `${identity.npub.substring(0, 12)}...${identity.npub.substring(identity.npub.length - 6)}`
    : '';

  const handleCopyNpub = async () => {
    if (!identity.npub) return;
    try {
      await Clipboard.setStringAsync(identity.npub);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  // Avatar Nostr generado con monograma soberano
  const avatarInitials = identity.alias
    ? identity.alias.replace('Amarata-', '').substring(0, 2).toUpperCase()
    : 'AM';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Cabecera del DNI */}
        <View style={styles.header}>
          <Text style={styles.headerBadge}>DOCUMENTO NACIONAL DE IDENTIDAD</Text>
          <Text style={styles.republicTitle}>REPÚBLICA DE AMARATIA</Text>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Nostr & Identidad */}
          <View style={styles.identityRow}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarGlow}>
                <Text style={styles.avatarText}>{avatarInitials}</Text>
              </View>
            </View>
            <View style={styles.identityDetails}>
              <Text style={styles.aliasText}>{identity.alias}</Text>
              <TouchableOpacity
                style={[styles.npubChip, copiedKey && styles.npubChipCopied]}
                onPress={handleCopyNpub}
                activeOpacity={0.7}
              >
                <Text style={[styles.npubText, copiedKey && styles.npubTextCopied]}>
                  {copiedKey ? '✓ ¡Llave Copiada!' : shortNpub}
                </Text>
                <Text style={styles.copyIcon}>{copiedKey ? '✅' : '📋'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* QR Céntrico Estratégico (Escaneo Inmediato) */}
          <View style={styles.qrSection}>
            <View style={styles.qrWrapper}>
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={170}
                  color="#090d16"
                  backgroundColor="white"
                />
              ) : (
                <View style={{ width: 170, height: 170, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#38bdf8" />
                </View>
              )}
            </View>
            <Text style={styles.qrCaption}>Presenta este QR para recibir o intercambiar visas</Text>
          </View>

          {/* Sección de Títulos Cívicos Condensados */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeader}>🏛️ TÍTULOS CÍVICOS & DIGNIDADES</Text>

            {profile ? (
              <View style={styles.titlesList}>
                {profile.titles.map((title) => {
                  if (title.category === 'CONSUL' && title.details && title.details.length > 0) {
                    const visibleProvinces = showAllProvinces
                      ? title.details
                      : title.details.slice(0, 3);
                    const remaining = title.details.length - 3;

                    return (
                      <View key={title.id} style={styles.titleItem}>
                        <Text style={styles.titleIcon}>{title.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.titleName}>
                            Cónsul de: {visibleProvinces.join(', ')}
                          </Text>
                          {title.details.length > 3 && (
                            <TouchableOpacity
                              onPress={() => setShowAllProvinces(!showAllProvinces)}
                              style={{ marginTop: 2 }}
                            >
                              <Text style={styles.toggleText}>
                                {showAllProvinces
                                  ? '▲ Mostrar menos'
                                  : `+ ${remaining} provincia${remaining > 1 ? 's' : ''} más...`}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={title.id} style={styles.titleItem}>
                      <Text style={styles.titleIcon}>{title.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.titleName}>{title.name}</Text>
                        <Text style={styles.titleDesc}>{title.description}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <ActivityIndicator size="small" color="#38bdf8" />
            )}
          </View>

          {/* Estadísticas de Red de Visas */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeader}>🌐 RED DE VISAS & CONFIANZA</Text>
            {profile ? (
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: '#10b981' }]}>
                    {profile.networkStats.level1}
                  </Text>
                  <Text style={styles.statLabel}>1er Nivel{'\n'}(Visas Directas)</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: '#3b82f6' }]}>
                    {profile.networkStats.level2}
                  </Text>
                  <Text style={styles.statLabel}>2do Nivel{'\n'}(Conexiones)</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
                    {profile.networkStats.level3}
                  </Text>
                  <Text style={styles.statLabel}>3er Nivel{'\n'}(Alcance)</Text>
                </View>
              </View>
            ) : (
              <ActivityIndicator size="small" color="#38bdf8" />
            )}
          </View>
        </ScrollView>

        {/* Botón de Cerrar */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Cerrar DNI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(5, 10, 20, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 28,
    width: width * 0.92,
    maxHeight: '92%',
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
    marginBottom: 12,
  },
  headerBadge: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  republicTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  scrollContainer: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatarGlow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  identityDetails: {
    flex: 1,
  },
  aliasText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  npubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 6,
  },
  npubChipCopied: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  npubText: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  npubTextCopied: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  copyIcon: {
    fontSize: 12,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 14,
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  qrCaption: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  sectionBox: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  titlesList: {
    gap: 8,
  },
  titleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  titleName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  titleDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  toggleText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 12,
  },
  closeBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
