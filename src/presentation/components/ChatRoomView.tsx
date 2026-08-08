import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { ChatMessage, ConversationItem } from '../../application/services/MessagingService';
import { useAuth } from '../../application/context/AuthContext';
import { useChatRoom } from '../hooks/useChatRoom';

export interface ChatRoomViewProps {
  activeChat: ConversationItem;
  onBack: () => void;
  onClose?: () => void;
  onMarkAsRead?: (targetId: string) => void;
  onMessageSent?: (msg: ChatMessage) => void;
}

type ChatListItem =
  | { type: 'MESSAGE'; data: ChatMessage; id: string }
  | { type: 'DATE_SEPARATOR'; dateLabel: string; id: string };

function formatChatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - targetDay.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hoy';
  } else if (diffDays === 1) {
    return 'Ayer';
  } else if (diffDays > 1 && diffDays < 7) {
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
    return dayName.charAt(0).toUpperCase() + dayName.slice(1);
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  } else {
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

export const ChatRoomView = ({
  activeChat,
  onBack,
  onClose,
  onMarkAsRead,
  onMessageSent,
}: ChatRoomViewProps) => {
  const { identity } = useAuth();

  const {
    messages,
    inputText,
    setInputText,
    isSending,
    isLoading,
    handleSendMessage,
    encryptionInfo,
  } = useChatRoom({
    activeChat,
    identity,
    onMarkAsRead,
    onMessageSent,
  });

  const listItems = useMemo<ChatListItem[]>(() => {
    if (messages.length === 0) return [];

    const items: ChatListItem[] = [];
    for (let i = 0; i < messages.length; i++) {
      const currentMsg = messages[i];
      items.push({
        type: 'MESSAGE',
        data: currentMsg,
        id: currentMsg.id,
      });

      const nextMsg = messages[i + 1];
      const currentDateKey = new Date(currentMsg.timestamp).toDateString();
      const nextDateKey = nextMsg ? new Date(nextMsg.timestamp).toDateString() : null;

      if (!nextMsg || currentDateKey !== nextDateKey) {
        items.push({
          type: 'DATE_SEPARATOR',
          dateLabel: formatChatDate(currentMsg.timestamp),
          id: `date_sep_${currentDateKey}`,
        });
      }
    }
    return items;
  }, [messages]);

  const renderItem = ({ item }: { item: ChatListItem }) => {
    if (item.type === 'DATE_SEPARATOR') {
      return (
        <View style={styles.dateSeparatorContainer}>
          <View style={styles.dateSeparatorPill}>
            <Text style={styles.dateSeparatorText}>{item.dateLabel}</Text>
          </View>
        </View>
      );
    }

    const msg = item.data;
    return (
      <View
        style={[
          styles.msgBubble,
          msg.isMe ? styles.msgMe : styles.msgOther,
        ]}
      >
        {!msg.isMe && <Text style={styles.msgSender}>{msg.senderAlias}</Text>}
        <Text style={styles.msgText}>{msg.content}</Text>
        <Text style={styles.msgTime}>
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Fijo de la Sala de Chat */}
      <View style={styles.chatHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backBtnText}>‹ Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {activeChat.title}
          </Text>
          <Text style={styles.chatSubtitle}>
            {encryptionInfo.label}
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cuerpo Central del Chat con Scroll en Todo el Bloque */}
      <View style={styles.contentBody}>
        {isLoading ? (
          <View style={styles.centeredStateBox}>
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={styles.loadingTitle}>Cargando mensajes cifrados...</Text>
            <Text style={styles.loadingSubtitle}>Conectando con relays soberanos</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centeredStateBox}>
            <Text style={styles.emptyIcon}>🔒</Text>
            <Text style={styles.emptyTitle}>Conversación Cifrada</Text>
            <Text style={styles.emptyDescription}>
              {activeChat.type === 'DIRECT'
                ? 'Los mensajes enviados en este chat privado están cifrados de extremo a extremo con el protocolo NIP-04.'
                : 'Espacio soberano protegido. Los mensajes se sincronizan inmutablemente en la red Nostr.'}
            </Text>
          </View>
        ) : (
          <BottomSheetFlatList
            data={listItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
          />
        )}
      </View>

      {/* Barra de Entrada Fija al Fondo */}
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
          style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isSending}
          activeOpacity={0.8}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#020617" />
          ) : (
            <Text style={styles.sendBtnIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 4,
    flexShrink: 0,
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
  headerInfo: {
    flex: 1,
    marginLeft: 10,
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
  closeBtn: {
    padding: 6,
    marginLeft: 6,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentBody: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  centeredStateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  loadingTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  loadingSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptyDescription: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  chatList: {
    flex: 1,
    width: '100%',
  },
  chatListContent: {
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
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: '#1e293b',
    flexShrink: 0,
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
  sendBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#475569',
  },
  sendBtnIcon: {
    color: '#020617',
    fontSize: 18,
    marginLeft: 2,
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    width: '100%',
  },
  dateSeparatorPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 1,
  },
  dateSeparatorText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
