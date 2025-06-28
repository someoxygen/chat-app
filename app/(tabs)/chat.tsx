import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert } from 'react-native';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BASE_URL from '@/constants/api';
//const socket = io(BASE_URL); // ← Sunucunun IP adresini güncel tut
const socket = io(BASE_URL, {
  transports: ['websocket'],
  secure: true,
});
interface Message {
  username: string;
  text: string;
  timestamp: string;
}

export default function ChatScreen() { 
  const { username } = useLocalSearchParams();
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    checkTokenAndFetchMessages();

    const handleMessage = (msg: string) => {
      const [sender, ...rest] = msg.split(': ');
      const text = rest.join(': ');
      setMessages(prev => [...prev, { username: sender, text, timestamp: new Date().toISOString() }]);
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
    };
  }, []);

  const checkTokenAndFetchMessages = async () => {
    const token = await AsyncStorage.getItem('token');

    if (!token) {
      Alert.alert('Oturum süresi dolmuş', 'Lütfen tekrar giriş yapın.');
      router.replace('/login');
      return;
    }

    fetchMessages(token);
  };

  const fetchMessages = async (token: string) => {
    try {
      const response = await fetch(`${BASE_URL}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json(); // mesaj objeleri [{ username, text, timestamp }]
        setMessages(data);
      } else {
        Alert.alert('Hata', 'Mesajlar alınamadı. Oturum geçersiz olabilir.');
      }
    } catch (err: any) {
      Alert.alert('Sunucu hatası', err.message || 'Bir hata oluştu');
    }
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    const fullMessage = `${username}: ${message}`;
    socket.emit('message', fullMessage);
    setMessage('');
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token'); // JWT token silinir
    router.replace('/login');               // Login sayfasına yönlendirme
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageContainer}>
            <Text style={styles.username}>{item.username}:</Text>
            <Text style={styles.message}>{item.text}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      <TextInput
        placeholder="Mesaj"
        value={message}
        onChangeText={setMessage}
        style={styles.input}
      />
      <Button title="Gönder" onPress={sendMessage} />
      <View style={{ marginTop: 20 }}>
        <Button title="Çıkış Yap" onPress={handleLogout} color="#e53935" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  input: { borderWidth: 1, padding: 10, marginVertical: 10, borderRadius: 5 },
  messageContainer: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    padding: 8,
    borderRadius: 5,
  },
  username: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  message: {
    flexShrink: 1,
  },
});
