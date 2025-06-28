// app/(auth)/login.tsx

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const response = await fetch('http://192.168.1.101:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('username', username);
        Alert.alert('🎉 Başarılı', 'Giriş yapıldı');

        // Login'den sonra tabs yapısına geçiş
        router.replace('/users');
      } else {
        Alert.alert('❌ Hata', data.message || 'Giriş başarısız');
      }
    } catch (err: any) {
      Alert.alert('🚫 Sunucu hatası', err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>🚀 Giriş Yap</Text>

        <TextInput
          placeholder="Kullanıcı adı"
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />
        <TextInput
          placeholder="Şifre"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Giriş Yap</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/register')}>
          <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f5f9',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 25,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 25,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    backgroundColor: '#f1f1f1',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#4C9AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#4C9AFF',
    marginTop: 20,
    textAlign: 'center',
    fontSize: 15,
  },
});
