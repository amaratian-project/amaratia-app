import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Vibration, Platform, Text, Pressable, Alert } from 'react-native';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, useAnimatedReaction, runOnJS, withSpring, withTiming, useAnimatedStyle, interpolate, Extrapolation, interpolateColor } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useDependencies } from '../../application/context/DependencyContext';
import { useAuth } from '../../application/context/AuthContext';
import { IdentityUseCase } from '../../application/use-cases/IdentityUseCase';
import { VisaSyncService } from '../../application/services/VisaSyncService';
import { GraphTopology } from '../../domain/models/GraphTopology';

import { MapNode } from '../../types/canvas';
import { useForceDirectedGraph } from '../hooks/useForceDirectedGraph';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { useCanvasUIState } from '../hooks/useCanvasUIState';
import { FastCanvasRenderer, getRadius, buildOverlayCluster } from './canvas/FastCanvasRenderer';
import type { OverlayClusterPaths } from './canvas/FastCanvasRenderer';
import { DniModal } from './DniModal';
import { FloatingDock } from './FloatingDock';
import { ContextualBottomSheet } from './ContextualBottomSheet';
import { CitizenProfileContent } from './CitizenProfileContent';
import { ActionMenuContent } from './ActionMenuContent';
import { CreateProvinceForm } from './CreateProvinceForm';
import { ProvinceChatUI } from './ProvinceChatUI';
import { CauseInfoContent } from './CauseInfoContent';
import { AlertsAndMessagesContent } from './AlertsAndMessagesContent';
import { CivicAlertService } from '../../application/services/CivicAlertService';
import { messagingService } from '../../application/services/MessagingService';
import { MessageReadTracker } from '../../application/services/MessageReadTracker';

const { width, height } = Dimensions.get('window');
const SCREEN_HEIGHT = height;

const LodSegmentButton = ({ item, animMode, onPress }: any) => {
  const animStyle = useAnimatedStyle(() => {
    const diff = Math.abs(animMode.value - item.level);
    const isSelected = diff < 0.5;
    const scaleVal = interpolate(diff, [0, 0.6], [1.1, 0.95], Extrapolation.CLAMP);
    const opacityVal = interpolate(diff, [0, 0.6], [1, 0.5], Extrapolation.CLAMP);

    return {
      backgroundColor: isSelected ? item.color : 'transparent',
      transform: [{ scale: scaleVal }],
      opacity: opacityVal,
    };
  });

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View style={[styles.lodSegment, animStyle]}>
        <Text style={styles.lodSegmentIcon}>{item.icon}</Text>
      </Animated.View>
    </Pressable>
  );
};

export const CanvasMap = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const fontNormal = useFont(require('../../../assets/Modelica-Regular.ttf'), 11);
  const fontBold = useFont(require('../../../assets/Modelica-Bold.ttf'), 14);

  const { citizenRepository } = useDependencies();
  const { identity } = useAuth();
  const [fullTopology, setFullTopology] = useState<GraphTopology | null>(null);

  const activeIdentity = React.useMemo(() => {
    if (identity) return identity;
    const identityUseCase = new IdentityUseCase();
    const mnemonic = identityUseCase.generateMnemonic();
    return { ...identityUseCase.deriveKeysFromMnemonic(mnemonic), alias: 'Ciudadano (Dev)' };
  }, [identity]);

  // 1. Data Fetching & Dynamic Refresh
  const fetchTopology = useCallback(async () => {
    const topology = await citizenRepository.getHydratedCitizens(activeIdentity?.npub);
    setFullTopology(topology);
  }, [citizenRepository, activeIdentity?.npub]);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(false);
  const [unreadMessagesMap, setUnreadMessagesMap] = useState<Record<string, number>>({});

  // Cargar estado inicial de alertas (sin inicializar MessageReadTracker aquí - se hace en el efecto de mensajes)
  useEffect(() => {
    if (!activeIdentity?.npub) return;
    CivicAlertService.getAlerts(activeIdentity.npub).then((alerts) => {
      const hasUnread = alerts.some((a) => !a.read);
      setHasUnreadAlerts(hasUnread);
    });
  }, [activeIdentity?.npub]);

  const markTargetAsRead = useCallback((targetId: string) => {
    if (activeIdentity?.npub) {
      MessageReadTracker.markAsRead(activeIdentity.npub, targetId, Date.now());
    }
    setUnreadMessagesMap((prev) => {
      const cleanId = targetId.replace(/^dm_/, '').replace(/^prov_/, '').replace(/^cause_/, '');
      const next = { ...prev };
      delete next[targetId];
      delete next[cleanId];
      return next;
    });
  }, [activeIdentity?.npub]);

  const markAllMessagesAsRead = useCallback(() => {
    if (activeIdentity?.npub) {
      MessageReadTracker.markAllAsRead(activeIdentity.npub);
    }
    setUnreadMessagesMap({});
  }, [activeIdentity?.npub]);

  // Efecto 0: Escuchar mensajes directos entrantes en tiempo real para activar balizas y badges
  //
  // DISEÑO: Usamos un Set de IDs de mensajes ya procesados para garantizar idempotencia.
  // Los relays Nostr reenvían mensajes históricos al reconectar, y sin deduplicación
  // el contador se inflaría cada vez. Con el Set, cada mensaje se evalúa exactamente una vez
  // por ciclo de vida del componente.
  useEffect(() => {
    if (!activeIdentity?.nsec || !activeIdentity?.npub) return;

    let isMounted = true;
    let unsubscribe = () => {};
    const processedMsgIds = new Set<string>();

    const setup = async () => {
      // ÚNICO punto de inicialización de MessageReadTracker
      await MessageReadTracker.initialize(activeIdentity.npub);
      if (!isMounted) return;

      unsubscribe = messagingService.subscribeToAllIncomingDirectMessages(
        activeIdentity.nsec,
        (msg) => {
          // Deduplicar: si ya procesamos este event ID, ignorar
          if (processedMsgIds.has(msg.id)) return;
          processedMsgIds.add(msg.id);

          // Registrar la conversación en el historial persistente de chats conocidos
          MessageReadTracker.recordChat(activeIdentity.npub, msg.senderNpub);

          const isNew = MessageReadTracker.isUnread(activeIdentity.npub, msg.senderNpub, msg.timestamp);
          if (isNew) {
            setUnreadMessagesMap((prev) => ({
              ...prev,
              [msg.senderNpub]: (prev[msg.senderNpub] || 0) + 1,
            }));
          }
        }
      );
    };

    setup();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeIdentity?.nsec, activeIdentity?.npub]);

  // Efecto 1: Otorgar Visa (Padrino -> Turista vía DB local + Nostr Relay)
  useEffect(() => {
    if (route.params?.addCitizen) {
      const npubToAdd = route.params.addCitizen;
      const processAdd = async () => {
        try {
          // 1. Guardar localmente en SQLite
          await citizenRepository.addCitizenToLevel1(npubToAdd, undefined, activeIdentity?.npub);
          await fetchTopology();

          // 2. Publicar la Visa en los Relays de Nostr para que el Turista la reciba automáticamente
          if (activeIdentity?.nsec) {
            const visaSync = new VisaSyncService();
            await visaSync.publishVisa(
              activeIdentity.nsec,
              activeIdentity.alias || 'Padrino',
              npubToAdd
            );

            // 3. Registrar en la bitácora cívica local
            await CivicAlertService.addAlert(activeIdentity.npub, {
              type: 'VISA_GRANTED',
              title: 'Has otorgado una Visa',
              description: `Has acreditado al ciudadano Amarata-${npubToAdd.substring(5, 9).toUpperCase()} en tu red de Nivel 1.`,
              relatedNpub: npubToAdd,
            });
          }
        } catch (e) {
          console.error("Error acreditando ciudadano en canvas:", e);
        }
      };
      processAdd();
    }
  }, [route.params?.addCitizen, citizenRepository, fetchTopology, activeIdentity]);

  // Efecto 2: Escuchar Eventos Cívicos entrantes (Visas y Revocaciones en 1º, 2º y 3er Grado)
  useEffect(() => {
    if (!activeIdentity?.npub) return;

    const visaSync = new VisaSyncService();
    const unsubscribe = visaSync.subscribeToCivicEvents(activeIdentity.npub, {
      onVisaGranted: async (sponsorNpub, sponsorAlias, targetNpub) => {
        try {
          if (targetNpub === activeIdentity.npub) {
            const wasNew = await citizenRepository.receiveVisaFrom(
              sponsorNpub,
              sponsorAlias,
              activeIdentity.npub
            );

            if (wasNew) {
              await CivicAlertService.addAlert(activeIdentity.npub, {
                type: 'VISA_RECEIVED',
                title: '¡Ciudadanía de Amaratia Otorgada!',
                description: `Has recibido una Visa cívica de ${sponsorAlias || `Amarata-${sponsorNpub.substring(5, 9).toUpperCase()}`}. ¡Tu DNI ha sido promovido a Ciudadano!`,
                relatedNpub: sponsorNpub,
                relatedAlias: sponsorAlias,
              });
              setHasUnreadAlerts(true);
              Alert.alert(
                '🏛️ ¡Ciudadanía de Amaratia Otorgada!',
                `Has recibido una Visa cívica de ${sponsorAlias || `Amarata-${sponsorNpub.substring(5, 9).toUpperCase()}`}.\n\n¡Tu DNI ha sido promovido a Ciudadano de Amaratia y tu garante ha sido agregado a tu red!`,
                [{ text: '¡Excelente!' }]
              );
              await fetchTopology();
            }
          } else {
            // Evento de red (Descubrimiento dinámico de 2º y 3er Grado)
            const changed = await citizenRepository.processNetworkVisa(
              sponsorNpub,
              sponsorAlias,
              targetNpub,
              activeIdentity.npub
            );
            if (changed) {
              await fetchTopology();
            }
          }
        } catch (err) {
          console.error('Error procesando visa recibida en UI:', err);
        }
      },
      onVisaRevoked: async (revokerNpub, revokerAlias, targetNpub) => {
        try {
          if (targetNpub === activeIdentity.npub) {
            if (activeIdentity?.npub && revokerNpub) {
              MessageReadTracker.markAsRead(activeIdentity.npub, revokerNpub, Date.now());
              setUnreadMessagesMap((prev) => {
                const next = { ...prev };
                delete next[revokerNpub];
                return next;
              });
            }

            const res = await citizenRepository.processVisaRevocation(
              revokerNpub,
              activeIdentity.npub
            );

            if (res.success) {
              await CivicAlertService.addAlert(activeIdentity.npub, {
                type: 'VISA_REVOKED',
                title: 'Visa Cívica Revocada',
                description: `El ciudadano ${revokerAlias || `Amarata-${revokerNpub.substring(5, 9).toUpperCase()}`} ha revocado su visa. Tu nuevo rol cívico es ${res.newRole === 'CITIZEN' ? 'Ciudadano' : 'Turista'} (${res.remainingVisas} visas activas restantes).`,
                relatedNpub: revokerNpub,
                relatedAlias: revokerAlias,
              });
              setHasUnreadAlerts(true);
              Alert.alert(
                '⚠️ Actualización de Red Cívica',
                `El ciudadano ${revokerAlias || `Amarata-${revokerNpub.substring(5, 9).toUpperCase()}`} ha revocado su visa cívica.\n\nTu red de confianza y títulos cívicos han sido actualizados bilateralmente.`,
                [{ text: 'Entendido' }]
              );
              await fetchTopology();
            }
          } else {
            // Revocación en la red (2º o 3er Grado)
            const changed = await citizenRepository.processNetworkRevocation(
              revokerNpub,
              targetNpub,
              activeIdentity.npub
            );
            if (changed) {
              await fetchTopology();
            }
          }
        } catch (err) {
          console.error('Error procesando revocación en UI:', err);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [activeIdentity?.npub, citizenRepository, fetchTopology]);

  // 2. Physics & Graph
  const {
    nodes,
    setNodes,
    links,
    bounds,
    isLoading,
  } = useForceDirectedGraph(fullTopology);

  // 3. UI State Hook
  const {
    showQR,
    setShowQR,
    showActionMenu,
    setShowActionMenu,
    showProvinceForm,
    setShowProvinceForm,
    showAlertsAndMessages,
    setShowAlertsAndMessages,
    initialChatTarget,
    openAlertsAndMessages,
    currentLOD,
    setCurrentLOD,
    selectedNode,
    setSelectedNode,
    animatedPosition,
    bottomSheetRef,
    focusTransition,
    overlayClusterData,
    openActionMenu,
    closePanels,
    handleNodePress,
  } = useCanvasUIState({ nodes, links, fontBold });

  // 5. Gestures
  const { composed, globalTransform, scale, translateX, translateY, goToLOD, scales } = useCanvasGestures({
    bounds,
    nodes,
    handleNodePress,
    closePanels
  });

  const animMode = useDerivedValue(() => {
    return interpolate(
      scale.value,
      [scales.scaleLOD3, scales.scaleLOD2, scales.scaleLOD1],
      [3, 2, 1],
      Extrapolation.CLAMP
    );
  });

  useAnimatedReaction(
    () => Math.round(animMode.value),
    (nextLOD, prevLOD) => {
      if (nextLOD !== prevLOD && nextLOD >= 1 && nextLOD <= 3) {
        runOnJS(setCurrentLOD)(nextLOD);
      }
    }
  );

  const animatedBackground = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      animMode.value,
      [1, 2, 3],
      ['#020617', '#0f172a', '#1e293b']
    ) as string;
    return { backgroundColor: bgColor };
  });

  const lodControlsStyle = useAnimatedStyle(() => {
    let sheetHeight = 0;

    if (animatedPosition.value > 0 && animatedPosition.value <= SCREEN_HEIGHT) {
      const rawSheetHeight = SCREEN_HEIGHT - animatedPosition.value;
      const PANEL_VISUAL_OFFSET = 45;
      sheetHeight = Math.max(0, rawSheetHeight - PANEL_VISUAL_OFFSET);
    }

    const maxUpload = SCREEN_HEIGHT * 0.5;
    const elementTopFromBottom = Math.min(maxUpload, Math.max(100, sheetHeight));

    const GAP = 5;
    const translateY = -(elementTopFromBottom + GAP);

    return {
      transform: [{ translateY }]
    };
  });

  const CENTER = React.useMemo(() => ({ x: width / 2, y: height / 2 }), []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedBackground]}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvasWrapper}>

          <Canvas style={StyleSheet.absoluteFill}>
            <Group origin={CENTER} transform={globalTransform}>
              <FastCanvasRenderer
                nodes={nodes}
                links={links}
                overlayClusterData={overlayClusterData}
                focusTransition={focusTransition}
                animMode={animMode}
                fontBold={fontBold}
                scale={scale}
                unreadNodes={unreadMessagesMap}
              />
            </Group>
          </Canvas>

        </View>
      </GestureDetector>

      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', justifyContent: 'flex-end' }]}>

        <Animated.View style={[{ alignItems: 'flex-end', paddingRight: 20, paddingBottom: 10, pointerEvents: 'box-none' }, lodControlsStyle]}>
          <View style={styles.lodControlsContainer}>
            {[
              { level: 3, label: 'Causas', icon: '⚖️', color: '#ec4899' },
              { level: 2, label: 'Provincias', icon: '🏛️', color: '#f59e0b' },
              { level: 1, label: 'Ciudadanos', icon: '👤', color: '#3b82f6' },
            ].map((item) => {
              return (
                <LodSegmentButton
                  key={item.level}
                  item={item}
                  animMode={animMode}
                  onPress={() => {
                    setCurrentLOD(item.level);
                    goToLOD(item.level);
                  }}
                />
              );
            })}
          </View>
        </Animated.View>

        {/* Panel Activo */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

          {/* El Dock se renderiza ANTES que el BottomSheet para que este último lo tape al subir */}
          <View style={{ position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingBottom: 30, pointerEvents: 'box-none' }}>
            <FloatingDock
              onAddPress={openActionMenu}
              onMessagePress={() => {
                // NO limpiar hasUnreadAlerts aquí prematuramente.
                // Se limpia a través del callback onAlertsCleared cuando
                // AlertsAndMessagesContent confirme que markAllAsRead completó.
                openAlertsAndMessages();
              }}
              onMarketPress={() => console.log('Mercado')}
              onVotePress={() => console.log('Votaciones')}
              onProfilePress={() => setShowQR(true)}
              hasUnreadAlerts={hasUnreadAlerts || Object.values(unreadMessagesMap).some((c) => c > 0)}
            />
          </View>

          <ContextualBottomSheet
            ref={bottomSheetRef}
            animatedPosition={animatedPosition}
            onClose={closePanels}
            mode={
              showAlertsAndMessages ? 'alertsAndMessages' :
                showProvinceForm ? 'provinceForm' :
                  showActionMenu ? 'actionMenu' :
                    (selectedNode?.level === -1 ? 'province' :
                      selectedNode?.level === -2 ? 'cause' : 'citizen')
            }
          >
            {showAlertsAndMessages && (
              <AlertsAndMessagesContent
                onClose={closePanels}
                initialTarget={initialChatTarget}
                unreadMessagesMap={unreadMessagesMap}
                onMarkAsRead={markTargetAsRead}
                onMarkAllAsRead={markAllMessagesAsRead}
                onAlertsCleared={() => setHasUnreadAlerts(false)}
              />
            )}
            {!showAlertsAndMessages && selectedNode && selectedNode.level >= 0 && (
              <CitizenProfileContent
                citizen={selectedNode}
                onClose={closePanels}
                onViewProfile={() => { }}
                onOpenChat={() => {
                  if (selectedNode.npub) markTargetAsRead(selectedNode.npub);
                  markTargetAsRead(selectedNode.id);
                  openAlertsAndMessages({
                    type: 'DIRECT',
                    id: selectedNode.id,
                    title: selectedNode.localName || selectedNode.alias,
                    targetNpub: selectedNode.npub,
                  });
                }}
                onUpdateLocalName={(newName) => {
                  setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, localName: newName } : n));
                  setSelectedNode({ ...selectedNode, localName: newName });
                }}
                onRevokeVisa={async () => {
                  try {
                    const targetNpub = await citizenRepository.revokeVisa(selectedNode.id, activeIdentity?.npub);
                    if (targetNpub) {
                      if (activeIdentity?.npub) {
                        MessageReadTracker.markAsRead(activeIdentity.npub, targetNpub, Date.now());
                        setUnreadMessagesMap((prev) => {
                          const next = { ...prev };
                          delete next[targetNpub];
                          delete next[selectedNode.id];
                          return next;
                        });
                      }

                      if (activeIdentity?.nsec) {
                        const visaSync = new VisaSyncService();
                        await visaSync.publishRevokeVisa(
                          activeIdentity.nsec,
                          activeIdentity.alias || 'Padrino',
                          targetNpub
                        );

                        if (activeIdentity?.npub) {
                          await CivicAlertService.addAlert(activeIdentity.npub, {
                            type: 'VISA_REVOKED',
                            title: 'Has revocado una Visa',
                            description: `Has revocado la visa al ciudadano ${selectedNode.localName || selectedNode.alias}. El enlace bilateral ha sido disuelto.`,
                            relatedNpub: targetNpub,
                            relatedAlias: selectedNode.alias,
                          });
                          setHasUnreadAlerts(true);
                        }
                      }
                    }
                    closePanels();
                    await fetchTopology();
                  } catch (e) {
                    console.error("Error revocando visa en canvas:", e);
                  }
                }}
              />
            )}
            {!showAlertsAndMessages && selectedNode && selectedNode.level === -1 && (
              <ProvinceChatUI provinceId={selectedNode.id} provinceName={selectedNode.alias} />
            )}
            {!showAlertsAndMessages && selectedNode && selectedNode.level === -2 && (
              <CauseInfoContent
                causeNode={selectedNode}
                onOpenChat={() => {
                  markTargetAsRead(selectedNode.id);
                  openAlertsAndMessages({
                    type: 'CAUSE',
                    id: selectedNode.id,
                    title: selectedNode.alias,
                  });
                }}
              />
            )}
            {!showAlertsAndMessages && showActionMenu && (
              <ActionMenuContent
                onScanCitizen={() => {
                  closePanels();
                  navigation.navigate('Scanner' as never);
                }}
                onCreateProvince={() => {
                  setShowActionMenu(false);
                  setShowProvinceForm(true);
                }}
              />
            )}
            {!showAlertsAndMessages && showProvinceForm && (
              <CreateProvinceForm
                onClose={closePanels}
                onSuccess={async () => {
                  closePanels();
                  const topology = await citizenRepository.getHydratedCitizens();
                  setFullTopology(topology);
                }}
              />
            )}
          </ContextualBottomSheet>
        </View>
      </View>

      {showQR && activeIdentity && (
        <View style={StyleSheet.absoluteFill}>
          <DniModal
            identity={activeIdentity}
            onClose={() => setShowQR(false)}
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617'
  },
  canvasWrapper: {
    flex: 1,
  },
  lodControlsContainer: {
    flexDirection: 'column',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    gap: 8,
  },
  lodSegment: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  lodSegmentIcon: {
    fontSize: 24,
    opacity: 0.6,
  },
  backdrop: {
    backgroundColor: '#000000',
  }
});
