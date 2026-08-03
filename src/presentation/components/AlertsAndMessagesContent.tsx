import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetTextInput,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { CivicAlert, CivicAlertService } from '../../application/services/CivicAlertService';
import {
  ChatMessage,
  ConversationItem,
  ConversationType,
  messagingService,
} from '../../application/services/MessagingService';
import { useAuth } from '../../application/context/AuthContext';
import { useDependencies } from '../../application/context/DependencyContext';
import { MessageReadTracker } from '../../application/services/MessageReadTracker';

const { width } = Dimensions.get('window');

type AlertsAndMessagesContentProps = {
  onClose: () => void;
  initialTarget?: {
    type: ConversationType;
    id: string;
    title: string;
    targetNpub?: string;
  } | null;
  unreadMessagesMap?: Record<string, number>;
  onMarkAsRead?: (targetId: string) => void;
  onMarkAllAsRead?: () => void;
  onAlertsCleared?: () => void;
};

export const AlertsAndMessagesContent = ({
  onClose,
  initialTarget,
  unreadMessagesMap,
  onMarkAsRead,
  onMarkAllAsRead,
  onAlertsCleared,
}: AlertsAndMessagesContentProps) => {
  const { identity } = useAuth();
  const { citizenRepository } = useDependencies();

  const [activeTab, setActiveTab] = useState<'alerts' | 'messages'>(
    initialTarget ? 'messages' : 'alerts'
  );
  const [msgFilter, setMsgFilter] = useState<ConversationType>('DIRECT');

  // Estado de secciones desplegables para la pestaña de Ciudadanos
  const [isNetworkExpanded, setIsNetworkExpanded] = useState(true);
  const [isUnlinkedExpanded, setIsUnlinkedExpanded] = useState(true);

  // Alertas State
  const [alerts, setAlerts] = useState<CivicAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Conversaciones State
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeChat, setActiveChat] = useState<ConversationItem | null>(
    initialTarget
      ? {
          id: initialTarget.id,
          type: initialTarget.type,
          title: initialTarget.title,
          subtitle: initialTarget.type === 'DIRECT' ? 'Mensaje Privado 1 a 1' : 'Canal Comunitario',
          avatarIcon: initialTarget.type === 'DIRECT' ? '👤' : initialTarget.type === 'PROVINCE' ? '🏛️' : '🌐',
          targetNpub: initialTarget.targetNpub,
          provinceId: initialTarget.type === 'PROVINCE' ? initialTarget.id : undefined,
          causeId: initialTarget.type === 'CAUSE' ? initialTarget.id : undefined,
        }
      : null
  );

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (activeChat && onMarkAsRead) {
      if (activeChat.targetNpub) onMarkAsRead(activeChat.targetNpub);
      if (activeChat.provinceId) onMarkAsRead(activeChat.provinceId);
      if (activeChat.causeId) onMarkAsRead(activeChat.causeId);
      onMarkAsRead(activeChat.id);
      if (identity?.npub) {
        MessageReadTracker.markAsRead(
          identity.npub,
          activeChat.targetNpub || activeChat.provinceId || activeChat.causeId || activeChat.id,
          Date.now()
        );
      }
    }
  }, [activeChat, onMarkAsRead, identity?.npub]);

  // 1. Cargar Alertas Cívicas
  const loadAlerts = useCallback(async () => {
    if (!identity?.npub) return;
    setLoadingAlerts(true);
    try {
      const data = await CivicAlertService.getAlerts(identity.npub);
      setAlerts(data);
      await CivicAlertService.markAllAsRead(identity.npub);
    } catch (e) {
      console.error('Error cargando alertas cívicas:', e);
    } finally {
      setLoadingAlerts(false);
    }
  }, [identity?.npub]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 2. Cargar Conversaciones Disponibles
  const loadConversations = useCallback(async () => {
    if (!identity?.npub) return;
    try {
      const topology = await citizenRepository.getHydratedCitizens(identity.npub);
      const items: ConversationItem[] = [];

      // A. Contactos en el Grafo (Nivel 1, 2, 3)
      const networkNpubSet = new Set<string>();
      topology.citizens
        .filter((c) => c.level >= 1 && c.networkData.npub && c.networkData.npub !== identity.npub)
        .forEach((c) => {
          const npub = c.networkData.npub!;
          networkNpubSet.add(npub);
          items.push({
            id: `dm_${npub}`,
            type: 'DIRECT',
            title: c.localData?.localName || c.networkData.alias,
            subtitle:
              c.level === 1
                ? `Contacto Directo • ID: Amarata-${npub.substring(5, 9).toUpperCase()}`
                : `Red Nivel ${c.level} • ID: Amarata-${npub.substring(5, 9).toUpperCase()}`,
            avatarIcon: '👤',
            targetNpub: npub,
            isUnlinked: false,
            level: c.level,
          });
        });

      // A2. Historial de Contactos Desvinculados / Externos (nunca se eliminan del historial)
      const knownNpubs = MessageReadTracker.getKnownChats(identity.npub);
      const unlinkedNpubSet = new Set<string>();

      knownNpubs.forEach((npub) => {
        if (
          !networkNpubSet.has(npub) &&
          npub !== identity.npub &&
          npub.startsWith('npub1') &&
          npub.length >= 50
        ) {
          unlinkedNpubSet.add(npub);
        }
      });

      if (unreadMessagesMap) {
        Object.keys(unreadMessagesMap).forEach((npub) => {
          if (
            !networkNpubSet.has(npub) &&
            npub !== identity.npub &&
            npub.startsWith('npub1') &&
            npub.length >= 50
          ) {
            unlinkedNpubSet.add(npub);
          }
        });
      }

      unlinkedNpubSet.forEach((npub) => {
        items.push({
          id: `dm_${npub}`,
          type: 'DIRECT',
          title: `Amarata-${npub.substring(5, 9).toUpperCase()}`,
          subtitle: 'Contacto no vinculado • Historial',
          avatarIcon: '👤',
          targetNpub: npub,
          isUnlinked: true,
        });
      });

      // B. Provincias
      topology.provinces.forEach((p) => {
        items.push({
          id: `prov_${p.id}`,
          type: 'PROVINCE',
          title: p.name,
          subtitle: 'Asamblea Provincial',
          avatarIcon: '🏛️',
          provinceId: p.id,
        });
      });

      // C. Causas
      if (topology.causes) {
        topology.causes.forEach((cause) => {
          items.push({
            id: `cause_${cause.id}`,
            type: 'CAUSE',
            title: cause.title,
            subtitle: 'Foro Federal Interprovincial',
            avatarIcon: '🌐',
            causeId: cause.id,
          });
        });
      }

      setConversations(items);
    } catch (e) {
      console.error('Error cargando conversaciones:', e);
    }
  }, [citizenRepository, identity?.npub, unreadMessagesMap]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleMarkAllMessagesRead = async () => {
    if (identity?.npub) {
      await MessageReadTracker.markAllAsRead(identity.npub);
    }
    onMarkAllAsRead?.();
  };

  // 3. Suscripción a Mensajes del Chat Activo
  useEffect(() => {
    if (!activeChat || !identity?.nsec) return;

    setChatMessages([]);
    let unsubscribe: () => void = () => {};

    if (activeChat.type === 'DIRECT' && activeChat.targetNpub) {
      unsubscribe = messagingService.subscribeToDirectChat(
        identity.nsec,
        activeChat.targetNpub,
        (msg) => {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [msg, ...prev].sort((a, b) => b.timestamp - a.timestamp);
          });
        }
      );
    } else {
      const channelId = activeChat.provinceId || activeChat.causeId || activeChat.id;
      unsubscribe = messagingService.subscribeToChannel(
        channelId,
        identity.nsec,
        (msg) => {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [msg, ...prev].sort((a, b) => b.timestamp - a.timestamp);
          });
        }
      );
    }

    return () => unsubscribe();
  }, [activeChat, identity?.nsec]);

  // 4. Enviar Mensaje
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat || !identity?.nsec || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      if (activeChat.type === 'DIRECT' && activeChat.targetNpub) {
        if (identity?.npub) {
          MessageReadTracker.recordChat(identity.npub, activeChat.targetNpub);
        }
        await messagingService.sendDirectMessage(
          identity.nsec,
          activeChat.targetNpub,
          identity.alias || 'Ciudadano',
          text
        );
      } else {
        const channelId = activeChat.provinceId || activeChat.causeId || activeChat.id;
        await messagingService.sendChannelMessage(
          channelId,
          identity.nsec,
          identity.alias || 'Ciudadano',
          text
        );
      }
    } catch (e) {
      console.error('Error enviando mensaje:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearAlerts = async () => {
    if (!identity?.npub) return;
    await CivicAlertService.clearAlerts(identity.npub);
    setAlerts([]);
    onAlertsCleared?.();
  };

  // Render Alert Item
  const renderAlertItem = ({ item }: { item: CivicAlert }) => {
    const icon =
      item.type === 'VISA_GRANTED'
        ? '🟢'
        : item.type === 'VISA_RECEIVED'
        ? '🛡️'
        : item.type === 'VISA_REVOKED'
        ? '🔴'
        : '🏛️';

    const dateStr = new Date(item.timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.alertCard}>
        <View style={styles.alertIconBox}>
          <Text style={{ fontSize: 20 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.alertCardHeader}>
            <Text style={styles.alertTitle}>{item.title}</Text>
            <Text style={styles.alertDate}>{dateStr}</Text>
          </View>
          <Text style={styles.alertDesc}>{item.description}</Text>
        </View>
      </View>
    );
  };

  // Conversaciones filtradas
  const networkConversations = useMemo(
    () => conversations.filter((c) => c.type === 'DIRECT' && !c.isUnlinked),
    [conversations]
  );
  const unlinkedConversations = useMemo(
    () => conversations.filter((c) => c.type === 'DIRECT' && c.isUnlinked),
    [conversations]
  );
  const filteredConversations = useMemo(
    () => conversations.filter((c) => c.type === msgFilter),
    [conversations, msgFilter]
  );

  const networkUnreadTotal = useMemo(() => {
    if (!unreadMessagesMap) return 0;
    return networkConversations.reduce((sum, item) => {
      const count = (item.targetNpub && unreadMessagesMap[item.targetNpub]) || 0;
      return sum + count;
    }, 0);
  }, [networkConversations, unreadMessagesMap]);

  const unlinkedUnreadTotal = useMemo(() => {
    if (!unreadMessagesMap) return 0;
    return unlinkedConversations.reduce((sum, item) => {
      const count = (item.targetNpub && unreadMessagesMap[item.targetNpub]) || 0;
      return sum + count;
    }, 0);
  }, [unlinkedConversations, unreadMessagesMap]);

  const renderConversationItem = ({ item }: { item: ConversationItem }) => {
    const unreadCount =
      (unreadMessagesMap &&
        ((item.targetNpub && unreadMessagesMap[item.targetNpub]) ||
          (item.provinceId && unreadMessagesMap[item.provinceId]) ||
          (item.causeId && unreadMessagesMap[item.causeId]) ||
          unreadMessagesMap[item.id])) ||
      0;

    return (
      <TouchableOpacity
        style={styles.convCard}
        onPress={() => {
          if (onMarkAsRead) {
            if (item.targetNpub) onMarkAsRead(item.targetNpub);
            if (item.provinceId) onMarkAsRead(item.provinceId);
            if (item.causeId) onMarkAsRead(item.causeId);
            onMarkAsRead(item.id);
          }
          setActiveChat(item);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.convAvatar}>
          <Text style={{ fontSize: 22 }}>{item.avatarIcon}</Text>
          {unreadCount > 0 && <View style={styles.avatarUnreadDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.convTitle}>{item.title}</Text>
          <Text style={styles.convSubtitle}>{item.subtitle}</Text>
        </View>
        {unreadCount > 0 ? (
          <View style={styles.unreadBadgeBox}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        ) : (
          <View style={styles.convArrow}>
            <Text style={{ color: '#64748b', fontSize: 16 }}>›</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabecera Principal */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>COMUNICACIÓN & ALERTAS</Text>
        <TouchableOpacity style={styles.closeHeaderBtn} onPress={onClose}>
          <Text style={styles.closeHeaderBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Selector de Pestañas Superiores */}
      {!activeChat && (
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'alerts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('alerts')}
          >
            <Text
              style={[styles.tabButtonText, activeTab === 'alerts' && styles.tabButtonTextActive]}
            >
              🔔 Alertas Cívicas ({alerts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'messages' && styles.tabButtonActive]}
            onPress={() => setActiveTab('messages')}
          >
            <Text
              style={[styles.tabButtonText, activeTab === 'messages' && styles.tabButtonTextActive]}
            >
              💬 Mensajería
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CONTENIDO PESTAÑA: ALERTAS */}
      {activeTab === 'alerts' && !activeChat && (
        <View style={{ flex: 1 }}>
          <View style={styles.subHeaderRow}>
            <Text style={styles.subHeaderTitle}>Bitácora de Eventos de Red</Text>
            {alerts.length > 0 && (
              <TouchableOpacity onPress={handleClearAlerts}>
                <Text style={styles.clearBtnText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingAlerts ? (
            <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
          ) : alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyTitle}>Sin Alertas Pendientes</Text>
              <Text style={styles.emptySubtitle}>
                Los eventos de visas otorgadas, recibidas y actualizaciones de red aparecerán aquí.
              </Text>
            </View>
          ) : (
            <BottomSheetFlatList
              data={alerts}
              keyExtractor={(item) => item.id}
              renderItem={renderAlertItem}
              contentContainerStyle={{ paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* CONTENIDO PESTAÑA: MENSAJERÍA (LISTA) */}
      {activeTab === 'messages' && !activeChat && (
        <View style={{ flex: 1 }}>
          <View style={styles.subHeaderRow}>
            <Text style={styles.subHeaderTitle}>Canales y Conversaciones Cívicas</Text>
            {Object.values(unreadMessagesMap || {}).some((c) => c > 0) && (
              <TouchableOpacity onPress={handleMarkAllMessagesRead}>
                <Text style={styles.clearBtnText}>Marcar leídos</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Subfiltros: Ciudadanos / Provincias / Causas */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, msgFilter === 'DIRECT' && styles.filterChipActive]}
              onPress={() => setMsgFilter('DIRECT')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  msgFilter === 'DIRECT' && styles.filterChipTextActive,
                ]}
              >
                👥 Ciudadanos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, msgFilter === 'PROVINCE' && styles.filterChipActive]}
              onPress={() => setMsgFilter('PROVINCE')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  msgFilter === 'PROVINCE' && styles.filterChipTextActive,
                ]}
              >
                🏛️ Provincias
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, msgFilter === 'CAUSE' && styles.filterChipActive]}
              onPress={() => setMsgFilter('CAUSE')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  msgFilter === 'CAUSE' && styles.filterChipTextActive,
                ]}
              >
                🌐 Causas
              </Text>
            </TouchableOpacity>
          </View>

          {msgFilter === 'DIRECT' ? (
            <BottomSheetScrollView
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {/* 1. SECCIÓN: MI RED DE CONFIANZA */}
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setIsNetworkExpanded(!isNetworkExpanded)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionChevron}>{isNetworkExpanded ? '▾' : '▸'}</Text>
                  <Text style={styles.sectionTitle}>Mi Red de Confianza</Text>
                  <View style={styles.sectionCountBadge}>
                    <Text style={styles.sectionCountText}>{networkConversations.length}</Text>
                  </View>
                </View>
                {networkUnreadTotal > 0 && (
                  <View style={styles.sectionUnreadBadge}>
                    <Text style={styles.sectionUnreadText}>{networkUnreadTotal} no leídos</Text>
                  </View>
                )}
              </TouchableOpacity>

              {isNetworkExpanded && (
                <View style={styles.sectionContent}>
                  {networkConversations.length === 0 ? (
                    <View style={styles.sectionEmptyBox}>
                      <Text style={styles.sectionEmptyText}>No hay ciudadanos vinculados en tu red.</Text>
                    </View>
                  ) : (
                    networkConversations.map((item) => (
                      <View key={item.id}>
                        {renderConversationItem({ item })}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* 2. SECCIÓN: CONTACTOS DESVINCULADOS / HISTORIAL */}
              <TouchableOpacity
                style={[styles.sectionHeader, { marginTop: 12 }]}
                onPress={() => setIsUnlinkedExpanded(!isUnlinkedExpanded)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionChevron}>{isUnlinkedExpanded ? '▾' : '▸'}</Text>
                  <Text style={styles.sectionTitle}>Contactos Desvinculados / Historial</Text>
                  <View style={styles.sectionCountBadge}>
                    <Text style={styles.sectionCountText}>{unlinkedConversations.length}</Text>
                  </View>
                </View>
                {unlinkedUnreadTotal > 0 && (
                  <View style={styles.sectionUnreadBadge}>
                    <Text style={styles.sectionUnreadText}>{unlinkedUnreadTotal} no leídos</Text>
                  </View>
                )}
              </TouchableOpacity>

              {isUnlinkedExpanded && (
                <View style={styles.sectionContent}>
                  {unlinkedConversations.length === 0 ? (
                    <View style={styles.sectionEmptyBox}>
                      <Text style={styles.sectionEmptyText}>No hay conversaciones con contactos externos.</Text>
                    </View>
                  ) : (
                    unlinkedConversations.map((item) => (
                      <View key={item.id}>
                        {renderConversationItem({ item })}
                      </View>
                    ))
                  )}
                </View>
              )}
            </BottomSheetScrollView>
          ) : (
            filteredConversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {msgFilter === 'PROVINCE' ? 'No perteneces a provincias' : 'No hay causas activas'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {msgFilter === 'PROVINCE'
                    ? 'Crea una provincia para debatir en asamblea.'
                    : 'Súmate a una causa para participar en los foros.'}
                </Text>
              </View>
            ) : (
              <BottomSheetFlatList
                data={filteredConversations}
                keyExtractor={(item) => item.id}
                renderItem={renderConversationItem}
                contentContainerStyle={{ paddingBottom: 30 }}
                showsVerticalScrollIndicator={false}
              />
            )
          )}
        </View>
      )}

      {/* CONTENIDO CHAT ACTIVO (SALA DE CONVERSACIÓN) */}
      {activeChat && (
        <View style={{ flex: 1 }}>
          {/* Header de la Sala de Chat */}
          <View style={styles.chatHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setActiveChat(null)}>
              <Text style={styles.backBtnText}>‹ Volver</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {activeChat.title}
              </Text>
              <Text style={styles.chatSubtitle}>
                {activeChat.type === 'DIRECT' ? '🔒 Cifrado E2EE • NIP-04' : '🏛️ Canal Comunitario'}
              </Text>
            </View>
          </View>

          {/* Mensajes */}
          <BottomSheetFlatList
            data={chatMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.msgBubble,
                  item.isMe ? styles.msgMe : styles.msgOther,
                ]}
              >
                {!item.isMe && <Text style={styles.msgSender}>{item.senderAlias}</Text>}
                <Text style={styles.msgText}>{item.content}</Text>
                <Text style={styles.msgTime}>
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            inverted
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Input de Envío */}
          <View style={styles.inputBar}>
            <BottomSheetTextInput
              style={styles.chatInput}
              placeholder="Escribe un mensaje cifrado..."
              placeholderTextColor="#64748b"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity
              style={[styles.sendBtn, isSending && { opacity: 0.5 }]}
              onPress={handleSendMessage}
              disabled={isSending}
            >
              <Text style={styles.sendBtnIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    paddingBottom: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 10,
  },
  headerTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  closeHeaderBtn: {
    padding: 6,
  },
  closeHeaderBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  tabButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#f8fafc',
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subHeaderTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  alertIconBox: {
    marginRight: 12,
    justifyContent: 'center',
  },
  alertCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertDate: {
    color: '#64748b',
    fontSize: 10,
  },
  alertDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#020617',
  },
  // Secciones desplegables de Ciudadanos
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionChevron: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    width: 14,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCountBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  sectionCountText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionUnreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionUnreadText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sectionContent: {
    marginBottom: 8,
  },
  sectionEmptyBox: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b55',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#33415544',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionEmptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  convTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
  },
  convSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  convArrow: {
    paddingLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Sala de Chat
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 10,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0f172a',
  },
  backBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  chatTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatSubtitle: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  chatListContent: {
    flexGrow: 1,
    paddingVertical: 10,
  },
  msgBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  msgMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#0284c7',
    borderBottomRightRadius: 4,
  },
  msgOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  msgSender: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: 'bold',
    marginBottom: 3,
  },
  msgText: {
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 19,
  },
  msgTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnIcon: {
    color: '#020617',
    fontSize: 18,
    marginLeft: 2,
  },
  avatarUnreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#06b6d4',
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  unreadBadgeBox: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#020617',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
