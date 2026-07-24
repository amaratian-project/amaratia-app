import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';

interface CitizenSheetProps {
  onClose?: () => void;
}

export const CitizenSheet: React.FC<CitizenSheetProps> = ({ onClose }) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1 && onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChanges}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.indicator}
    >
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder} />
          <View style={styles.info}>
            <Text style={styles.title}>Ciudadano #7A3F</Text>
            <Text style={styles.subtitle}>Nivel de Mérito: 1,450 ⭐️</Text>
          </View>
        </View>

        <View style={styles.kanbanPreview}>
          <Text style={styles.sectionTitle}>Kanban Cívico (Resumen)</Text>
          <View style={styles.ticket}>
            <Text style={styles.ticketTitle}>Reparar tubería comunal</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>EN PROCESO</Text></View>
          </View>
          <View style={styles.ticket}>
            <Text style={styles.ticketTitle}>Auditoría del tesoro</Text>
            <View style={[styles.badge, styles.badgeTodo]}><Text style={styles.badgeText}>POR HACER</Text></View>
          </View>
        </View>
        
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>Abrir Tablero Completo</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1e293b', // Slate 800
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  indicator: {
    backgroundColor: '#475569',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6', // Blue 500
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  info: {
    marginLeft: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  kanbanPreview: {
    marginBottom: 24,
  },
  ticket: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketTitle: {
    color: '#f1f5f9',
    fontSize: 16,
  },
  badge: {
    backgroundColor: '#ca8a04',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTodo: {
    backgroundColor: '#475569',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionBtn: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
