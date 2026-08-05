import React, { useState } from 'react';
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

  const renderMessageBubble = ({ item }: { item: ChatMessage }) => {
    return (
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
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageBubble}
            inverted
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
});
