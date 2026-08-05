import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapNode } from '../../types/canvas';

export interface ProvinceInfoContentProps {
  provinceNode: MapNode;
  onOpenChat?: () => void;
}

export const ProvinceInfoContent = ({
  provinceNode,
  onOpenChat,
}: ProvinceInfoContentProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>🏛️</Text>
          <Text style={styles.title}>{provinceNode.alias}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Asamblea Activa</Text>
        </View>
      </View>

      <Text style={styles.description}>
        {provinceNode.localName ||
          'Provincia federada de Amaratia. Espacio soberano de deliberación, gobernanza local y desarrollo comunitario.'}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{provinceNode.merit || 12}</Text>
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

      {onOpenChat && (
        <TouchableOpacity style={styles.chatButton} onPress={onOpenChat} activeOpacity={0.8}>
          <Text style={styles.chatButtonText}>💬 Entrar a la Asamblea Provincial</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    flexShrink: 1,
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
  description: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 15,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  chatButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
