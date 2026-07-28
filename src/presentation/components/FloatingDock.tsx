import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FloatingDockProps = {
  onAddPress: () => void;
  onMessagePress: () => void;
  onMarketPress: () => void;
  onVotePress: () => void;
  onProfilePress: () => void;
  onLayout?: (event: any) => void;
};

export const FloatingDock = ({ 
  onAddPress, 
  onMessagePress, 
  onMarketPress, 
  onVotePress, 
  onProfilePress,
  onLayout
}: FloatingDockProps) => {
  return (
    <View style={styles.dockWrapper} onLayout={onLayout}>
      <View style={styles.dockContainer}>
        
        <TouchableOpacity style={styles.iconButton} onPress={onMessagePress}>
          <Ionicons name="chatbubbles-outline" size={24} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={onMarketPress}>
          <Ionicons name="cart-outline" size={24} color="#94a3b8" />
        </TouchableOpacity>

        {/* Botón Central de Acción (+) */}
        <TouchableOpacity style={styles.centerButton} onPress={onAddPress}>
          <View style={styles.centerButtonInner}>
            <Ionicons name="add" size={32} color="white" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={onVotePress}>
          <Ionicons name="podium-outline" size={24} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={onProfilePress}>
          <Ionicons name="person-outline" size={24} color="#94a3b8" />
        </TouchableOpacity>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    width: '100%',
  },
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 70,
    width: '90%',
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  iconButton: {
    padding: 10,
  },
  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  centerButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3b82f6', // Azul tecnológico
    justifyContent: 'center',
    alignItems: 'center',
  }
});
