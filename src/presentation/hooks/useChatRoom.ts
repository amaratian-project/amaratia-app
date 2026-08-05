import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChatMessage,
  ConversationItem,
  messagingService,
} from '../../application/services/MessagingService';
import { MessageReadTracker } from '../../application/services/MessageReadTracker';

export interface UseChatRoomProps {
  activeChat: ConversationItem | null;
  identity: { npub: string; nsec?: string; alias?: string } | null;
  onMessageSent?: (msg: ChatMessage) => void;
  onMarkAsRead?: (targetId: string) => void;
}

export function useChatRoom({
  activeChat,
  identity,
  onMessageSent,
  onMarkAsRead,
}: UseChatRoomProps) {
  const chatKey = activeChat
    ? activeChat.targetNpub || activeChat.provinceId || activeChat.causeId || activeChat.id
    : null;
  const chatType = activeChat?.type;
  const targetNpub = activeChat?.targetNpub;
  const channelId = activeChat
    ? activeChat.provinceId || activeChat.causeId || activeChat.id
    : null;

  // 1. Inicialización instantánea desde la memoria caché
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return chatKey ? messagingService.getCachedMessages(chatKey) : [];
  });
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(() => {
    if (!chatKey) return false;
    return messagingService.getCachedMessages(chatKey).length === 0;
  });

  // Marcar como leído al entrar a la conversación (depende de claves primitivas estables)
  useEffect(() => {
    if (!chatKey || !identity?.npub) return;

    if (onMarkAsRead) {
      if (targetNpub) onMarkAsRead(targetNpub);
      onMarkAsRead(chatKey);
    }

    MessageReadTracker.markAsRead(identity.npub, chatKey, Date.now());
  }, [chatKey, targetNpub, identity?.npub]);

  // Suscripción reactiva a mensajes de la conversación activa
  useEffect(() => {
    if (!chatKey || !identity?.nsec) {
      setIsLoading(false);
      return;
    }

    // Si ya tenemos mensajes en caché para este chatKey, los mostramos de inmediato sin pantalla de carga
    const cached = messagingService.getCachedMessages(chatKey);
    if (cached.length > 0) {
      setMessages(cached);
      setIsLoading(false);
    } else {
      setMessages([]);
      setIsLoading(true);
    }

    // Timeout de carga defensivo según principios de UX progresiva
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);

    let unsubscribe: () => void = () => {};

    const handleIncomingMessage = (msg: ChatMessage) => {
      setIsLoading(false);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev].sort((a, b) => b.timestamp - a.timestamp);
      });
    };

    if (chatType === 'DIRECT' && targetNpub && targetNpub.startsWith('npub1')) {
      unsubscribe = messagingService.subscribeToDirectChat(
        identity.nsec,
        targetNpub,
        handleIncomingMessage
      );
    } else if (channelId) {
      unsubscribe = messagingService.subscribeToChannel(
        channelId,
        identity.nsec,
        handleIncomingMessage
      );
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [chatKey, chatType, targetNpub, channelId, identity?.nsec]);

  // Enviar mensaje (Directo o Canal)
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !activeChat || !identity?.nsec || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      let sentMsg: ChatMessage;

      if (activeChat.type === 'DIRECT' && activeChat.targetNpub) {
        if (identity?.npub) {
          MessageReadTracker.recordChat(identity.npub, activeChat.targetNpub);
        }
        sentMsg = await messagingService.sendDirectMessage(
          identity.nsec,
          identity.alias || 'Ciudadano',
          activeChat.targetNpub,
          text
        );
      } else {
        const targetChannelId = activeChat.provinceId || activeChat.causeId || activeChat.id;
        sentMsg = await messagingService.sendChannelMessage(
          targetChannelId,
          text,
          identity.nsec,
          identity.alias || 'Ciudadano'
        );
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [sentMsg, ...prev].sort((a, b) => b.timestamp - a.timestamp);
      });

      onMessageSent?.(sentMsg);
    } catch (e) {
      console.error('[useChatRoom] Error enviando mensaje:', e);
    } finally {
      setIsSending(false);
    }
  }, [inputText, activeChat, identity?.nsec, identity?.alias, identity?.npub, isSending, onMessageSent]);

  // Etiqueta de cifrado y contexto de seguridad
  const encryptionInfo = useMemo(() => {
    if (!activeChat) return { label: '', icon: '🔒' };
    switch (activeChat.type) {
      case 'DIRECT':
        return { label: '🔒 Cifrado E2EE • NIP-04', icon: '👤' };
      case 'PROVINCE':
        return { label: '🏛️ Asamblea Provincial • Cifrado Simétrico', icon: '🏛️' };
      case 'CAUSE':
        return { label: '🌐 Foro Federal de Causa • Cifrado Simétrico', icon: '🌐' };
      case 'SUBGROUP':
        return { label: '👥 Subgrupo Comunitario • Cifrado Simétrico', icon: '👥' };
      default:
        return { label: '🔒 Canal Protegido', icon: '💬' };
    }
  }, [activeChat?.type]);

  return {
    messages,
    inputText,
    setInputText,
    isSending,
    isLoading,
    handleSendMessage,
    encryptionInfo,
  };
}
