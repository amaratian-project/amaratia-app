import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ChatMessage, provinceChatService } from '../../application/services/ProvinceChatService';

type ProvinceChatUIProps = {
  provinceId: string;
  provinceName: string;
};

export const ProvinceChatUI = ({ provinceId, provinceName }: ProvinceChatUIProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    // Suscribirse a mensajes entrantes
    const unsubscribe = provinceChatService.subscribeToProvinceChat(provinceId, (msg) => {
      setMessages(prev => {
        // Evitar duplicados simples
        if (prev.find(m => m.id === msg.id)) return prev;
        return [msg, ...prev].sort((a, b) => b.timestamp - a.timestamp);
      });
    });

    return () => unsubscribe();
  }, [provinceId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');

    try {
      const msg = await provinceChatService.sendMessage(provinceId, text);
      setMessages(prev => [msg, ...prev]);
    } catch (e) {
      console.warn("Fallo al enviar mensaje", e);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderAlias === 'Yo';
    return (
      <View style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageOther]}>
        {!isMe && <Text style={styles.senderAlias}>{item.senderAlias}</Text>}
        <Text style={styles.messageText}>{item.content}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Text style={styles.title}>{provinceName}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Activa</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Chat Seguro NIP-04 • Red de Provincia</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Ciudadanos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Proyectos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Salud</Text>
          </View>
        </View>
      </View>

      <BottomSheetFlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.inputContainer}>
        <BottomSheetTextInput
          style={styles.input}
          placeholder="Escribe un mensaje seguro..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    paddingBottom: 20,
  },
  infoCard: {
    padding: 20,
    backgroundColor: '#334155',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginBottom: 5,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  badge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#020617',
    fontSize: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#475569',
    paddingTop: 15,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  listContent: {
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  senderAlias: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 15,
    color: '#f8fafc',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendIcon: {
    color: '#020617',
    fontSize: 18,
    marginLeft: 2, // optical alignment
  },
});
