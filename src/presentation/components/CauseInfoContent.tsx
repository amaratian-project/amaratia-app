import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapNode } from '../../types/canvas';

type CauseInfoContentProps = {
  causeNode: MapNode;
};

export const CauseInfoContent = ({ causeNode }: CauseInfoContentProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>⚖️</Text>
          <Text style={styles.title}>{causeNode.alias}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Gobernanza</Text>
        </View>
      </View>

      <Text style={styles.description}>
        {causeNode.localName || 'Causa social y política respaldada por provincias libres en Amaratia.'}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{causeNode.merit || 120}</Text>
          <Text style={styles.statLabel}>Apoyos</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>3</Text>
          <Text style={styles.statLabel}>Provincias</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>Activa</Text>
          <Text style={styles.statLabel}>Estado</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    fontSize: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
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
});
