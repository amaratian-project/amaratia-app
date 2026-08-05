import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { useDependencies } from '../../application/context/DependencyContext';
import { useAuth } from '../../application/context/AuthContext';

type CreateProvinceFormProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export const CreateProvinceForm = ({ onClose, onSuccess }: CreateProvinceFormProps) => {
  const { citizenRepository } = useDependencies();
  const { identity } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('El nombre de la provincia es requerido');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await citizenRepository.createProvince(name, description, identity?.npub);
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Error al fundar la provincia');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Fundar Provincia</Text>
      <Text style={styles.subtitle}>Crea una nueva organización multifirma (Modo Fase 1)</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre de la Provincia"
        placeholderTextColor="#64748b"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Propósito / Descripción (Opcional)"
        placeholderTextColor="#64748b"
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isLoading}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#020617" />
          ) : (
            <Text style={styles.createText}>Fundar</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 15,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#334155',
  },
  cancelText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    flex: 2,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#10b981',
  },
  createText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
