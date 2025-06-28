import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Picker } from 'emoji-mart-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import moment from 'moment';
import { Audio, Video } from 'expo-av'; // Video da buradan!
const socket = io('http://192.168.1.101:3000');
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Message {
  _id: string;
  sender: string;
  receiver: string;
  text: string;
  timestamp: string;
  edited?: boolean;
}

export default function PrivateChatScreen() {
  const { receiver } = useLocalSearchParams();
  const [sender, setSender] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const token = await AsyncStorage.getItem('token');
    const username = await AsyncStorage.getItem('username');
    if (!token || !username) {
      router.replace('/login');
      return;
    }

    setSender(username);
    await fetchMessages(username, receiver as string, token);

    socket.emit('join', username);

    socket.on('private-message', (msg: Message) => {
      if (
        (msg.sender === receiver && msg.receiver === username) ||
        (msg.sender === username && msg.receiver === receiver)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });
  };

  const fetchMessages = async (user1: string, user2: string, token: string) => {
    try {
      const res = await fetch(`http://192.168.1.101:3000/private-messages/${user1}/${user2}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else {
        Alert.alert('Hata', 'Mesajlar yüklenemedi.');
      }
    } catch (err: any) {
      Alert.alert('Sunucu hatası', err.message || 'Bir hata oluştu');
    }
  };

  const sendMessage = async (customText?: string) => {
    const token = await AsyncStorage.getItem('token');
    const textToSend = editingId ? editingText.trim() : (customText ?? message.trim());
    if (!textToSend || !sender || !receiver) return;

    if (editingId) {
      try {
        await fetch(`http://192.168.1.101:3000/private-message/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: textToSend, edited: true }),
        });

        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === editingId ? { ...msg, text: textToSend, edited: true } : msg
          )
        );
        setEditingId(null);
        setEditingText('');
      } catch (err) {
        Alert.alert('Hata', 'Mesaj güncellenemedi.');
      }
    } else {
      const newMessage: Omit<Message, '_id' | 'timestamp'> = {
        sender,
        receiver: receiver as string,
        text: textToSend,
      };

      socket.emit('private-message', newMessage);

      await fetch('http://192.168.1.101:3000/private-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newMessage),
      });

      setMessages((prev) => [
        ...prev,
        {
          ...newMessage,
          timestamp: new Date().toISOString(),
          _id: Math.random().toString(),
          edited: false,
        },
      ]);
      setMessage('');
    }
  };

  const deleteMessage = async (id: string) => {
    const token = await AsyncStorage.getItem('token');
    try {
      await fetch(`http://192.168.1.101:3000/private-message/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setMessages((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      Alert.alert('Hata', 'Mesaj silinemedi.');
    }
  };

  const deleteAllMessages = async () => {
    const token = await AsyncStorage.getItem('token');
    try {
      await fetch(`http://192.168.1.101:3000/private-messages/${sender}/${receiver}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages([]);
      setShowMenu(false);
    } catch (err) {
      Alert.alert('Hata', 'Mesajlar silinemedi.');
    }
  };

  // GALERİDEN RESİM SEÇİP GÖNDERME
  const pickImageAndSend = async () => {
    setShowActions(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin gerekli', 'Galeriye erişim izni verilmedi.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const token = await AsyncStorage.getItem('token');

      try {
        const res = await fetch('http://192.168.1.101:3000/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ base64 }),
        });

        const data = await res.json();
        if (data.imageUrl) {
          await sendMessage(data.imageUrl);
        } else {
          Alert.alert('Hata', 'Sunucudan resim URL\'si alınamadı.');
        }
      } catch (err) {
        Alert.alert('Hata', 'Resim gönderilemedi');
        console.error(err);
      }
    }
  };

  // GALERİDEN VİDEO SEÇİP GÖNDERME  (YENİ EKLENDİ)
  const pickVideoAndSend = async () => {
    setShowActions(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin gerekli', 'Galeriye erişim izni verilmedi.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const token = await AsyncStorage.getItem('token');
      try {
        const res = await fetch('http://192.168.1.101:3000/upload-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ base64, extension: 'mp4' }), // uzantı önemli!
        });

        const data = await res.json();
        if (data.videoUrl) {
          await sendMessage(data.videoUrl);
        } else {
          Alert.alert('Hata', 'Sunucudan video URL\'si alınamadı.');
        }
      } catch (err) {
        Alert.alert('Hata', 'Video gönderilemedi');
        console.error(err);
      }
    }
  };

  // KAMERADAN FOTOĞRAF ÇEKİP GÖNDERME
  const takePhotoAndSend = async () => {
    setShowActions(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin gerekli', 'Kameraya erişim izni verilmedi.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const token = await AsyncStorage.getItem('token');

      try {
        const res = await fetch('http://192.168.1.101:3000/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ base64 }),
        });

        const data = await res.json();
        if (data.imageUrl) {
          await sendMessage(data.imageUrl);
        } else {
          Alert.alert('Hata', 'Sunucudan resim URL\'si alınamadı.');
        }
      } catch (err) {
        Alert.alert('Hata', 'Resim gönderilemedi');
        console.error(err);
      }
    }
  };

  // KAMERADAN VİDEO ÇEKİP GÖNDERME (YENİ EKLENDİ)
  const takeVideoAndSend = async () => {
    setShowActions(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin gerekli', 'Kameraya erişim izni verilmedi.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const token = await AsyncStorage.getItem('token');
      try {
        const res = await fetch('http://192.168.1.101:3000/upload-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ base64, extension: 'mp4' }),
        });

        const data = await res.json();
        if (data.videoUrl) {
          await sendMessage(data.videoUrl);
        } else {
          Alert.alert('Hata', 'Sunucudan video URL\'si alınamadı.');
        }
      } catch (err) {
        Alert.alert('Hata', 'Video gönderilemedi');
        console.error(err);
      }
    }
  };

  // SES KAYDI - Başlat
  const startRecording = async () => {
    setShowActions(false);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin gerekli', 'Mikrofon izni verilmedi.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Hata', 'Kayıt başlatılamadı');
      setIsRecording(false);
    }
  };

  // SES KAYDI - Durdur ve Gönder
  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      setIsRecording(false);

      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const token = await AsyncStorage.getItem('token');
        const res = await fetch('http://192.168.1.101:3000/upload-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ base64, extension: 'm4a' }),
        });

        const data = await res.json();
        if (data.audioUrl) {
          await sendMessage(data.audioUrl);
        } else {
          Alert.alert('Hata', 'Sunucudan ses URL\'si alınamadı.');
        }
      }
    } catch (err) {
      Alert.alert('Hata', 'Kayıt bitirilemedi');
      setIsRecording(false);
      setRecording(null);
    }
  };

  // Açılır menü için
  const handleActionPress = (action: 'emoji' | 'gallery' | 'galleryVideo' | 'camera' | 'cameraVideo' | 'audio') => {
    setShowActions(false);
    if (action === 'emoji') setShowEmojiPicker((prev) => !prev);
    if (action === 'gallery') pickImageAndSend();
    if (action === 'galleryVideo') pickVideoAndSend();
    if (action === 'camera') takePhotoAndSend();
    if (action === 'cameraVideo') takeVideoAndSend();
    // audio için özel fonksiyon (altta)
  };

  // Menü dışında bir yere tıklanınca menüyü kapatmak için
  const handleBackgroundPress = () => {
    setShowMenu(false);
    setShowActions(false);
  };

  // Sesi oynatmak için
  const playAudio = async (audioUrl: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      Alert.alert('Hata', 'Ses dosyası çalınamadı.');
    }
  };

  // Video oynatıcıya tıklandığında oynatma
  const playVideo = async (videoUrl: string) => {
    // Oynatma logic’i ister istemez Video bileşeninde, ayrıca burada gerek yok
  };

  return (
    <TouchableWithoutFeedback onPress={handleBackgroundPress}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{receiver}</Text>
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuBtn}>
            <Text style={styles.menuDots}>⋮</Text>
          </TouchableOpacity>
          {showMenu && (
            <View style={styles.menuDropdown}>
              <TouchableOpacity
                onPress={() => {
                  setShowMenu(false);
                  Alert.alert(
                    'Uyarı',
                    'Tüm mesajları silmek istediğine emin misin?',
                    [
                      { text: 'Vazgeç', style: 'cancel' },
                      {
                        text: 'Sil',
                        style: 'destructive',
                        onPress: deleteAllMessages,
                      },
                    ]
                  );
                }}
                style={styles.menuDropdownItem}
              >
                <Text style={{ color: '#d32f2f', fontWeight: '600', fontSize: 16 }}>Tüm Mesajları Sil</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* MESAJ LİSTESİ */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() => {
                if (item.sender === sender) {
                  Alert.alert('Mesaj Seçimi', 'Bu mesajı düzenlemek mi yoksa silmek mi istiyorsun?', [
                    { text: 'İptal', style: 'cancel' },
                    {
                      text: 'Düzenle',
                      onPress: () => {
                        setEditingId(item._id);
                        setEditingText(item.text);
                      },
                    },
                    {
                      text: 'Sil',
                      style: 'destructive',
                      onPress: () => deleteMessage(item._id),
                    },
                  ]);
                }
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.messageContainer,
                  item.sender === sender ? styles.sent : styles.received,
                ]}
              >
                {/* SES MESAJI */}
                {item.text.endsWith('.m4a') || item.text.endsWith('.mp3') ? (
                  <TouchableOpacity onPress={() => playAudio(item.text)}>
                    <Text style={{ fontSize: 18, color: '#355C7D' }}>🔊 Ses mesajı (Dinle)</Text>
                  </TouchableOpacity>
                )
                  // VİDEO MESAJI GÖSTERİMİ (URL ve uzantı kontrolü)
                  : (item.text.startsWith('http') && (item.text.endsWith('.mp4') || item.text.endsWith('.mov') || item.text.endsWith('.webm'))) ? (
                    <Video
                      source={{ uri: item.text }}
                      style={styles.videoMessage}
                      resizeMode="contain"
                      useNativeControls
                      shouldPlay={false}
                      isLooping={false}
                    />
                  )
                    // FOTO MESAJI
                    : item.text.startsWith('http') && item.text.includes('/uploads/') ? (
                      <Image source={{ uri: item.text }} style={styles.imageMessage} />
                    ) : (
                      <Text style={styles.messageText}>
                        {item.text}{' '}
                        {item.edited ? <Text style={styles.edited}>(düzenlendi)</Text> : ''}
                      </Text>
                    )}
                <Text style={styles.meta}>
                  {item.sender} • {moment(item.timestamp).format('HH:mm')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {showEmojiPicker && (
          <View style={styles.emojiPickerContainer}>
            <Picker
              onSelect={(emoji: any) => {
                if (editingId) {
                  setEditingText((prev) => prev + emoji.native);
                } else {
                  setMessage((prev) => prev + emoji.native);
                }
              }}
              theme="light"
            />
          </View>
        )}

        {/* MESAJ GÖNDERME BAR */}
        <View style={styles.inputRow}>
          <View style={{ position: 'relative', justifyContent: 'center' }}>
            {/* Ana buton */}
            <TouchableOpacity
              onPress={() => setShowActions((prev) => !prev)}
              style={styles.mainIconBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.iconText}>➕</Text>
            </TouchableOpacity>
            {/* Yukarı açılır menü */}
            {showActions && (
              <View style={styles.actionsMenu}>
                <TouchableOpacity
                  style={styles.menuIconBtn}
                  onPress={() => handleActionPress('emoji')}
                >
                  <Text style={styles.iconText}>😀</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuIconBtn}
                  onPress={() => handleActionPress('gallery')}
                >
                  <Text style={styles.iconText}>📎</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuIconBtn}
                  onPress={() => handleActionPress('galleryVideo')}
                >
                  <Text style={styles.iconText}>🎞️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuIconBtn}
                  onPress={() => handleActionPress('camera')}
                >
                  <Text style={styles.iconText}>📷</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuIconBtn}
                  onPress={() => handleActionPress('cameraVideo')}
                >
                  <Text style={styles.iconText}>🎥</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuIconBtn}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <Text style={[styles.iconText, isRecording && { color: '#d32f2f' }]}>
                    {isRecording ? '⏹️' : '🎤'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <TextInput
            placeholder="Mesaj yaz..."
            value={editingId ? editingText : message}
            onChangeText={(text) => (editingId ? setEditingText(text) : setMessage(text))}
            style={styles.input}
            multiline
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            style={styles.sendBtn}
            activeOpacity={0.8}
          >
            <Icon
              name="send"     // Üçgen, klasik "paper plane" ikonu
              size={28}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FF',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    marginBottom: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#355C7D',
  },
  menuBtn: {
    padding: 8,
    marginLeft: 6,
    borderRadius: 20,
  },
  menuDots: {
    fontSize: 26,
    color: '#333',
    fontWeight: 'bold',
  },
  menuDropdown: {
    position: 'absolute',
    top: 38,
    right: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 8,
    minWidth: 180,
    zIndex: 100,
  },
  menuDropdownItem: {
    padding: 16,
  },
  emojiPickerContainer: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 5,
    maxHeight: 300,
  },
  imageMessage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  videoMessage: {
    width: 200,
    height: 240,
    borderRadius: 12,
    backgroundColor: '#000',
    marginVertical: 8,
  },
  sent: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 15,
  },
  received: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 15,
  },
  messageContainer: {
    padding: 12,
    marginBottom: 10,
    maxWidth: '80%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#222',
  },
  meta: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
  },
  edited: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#555',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    gap: 4,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 30,
    elevation: 2,
    minHeight: 48,
  },
  mainIconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#F3F8FF',
    elevation: 1,
    marginRight: 4,
  },
  actionsMenu: {
    position: 'absolute',
    bottom: 46,
    left: 0,
    alignItems: 'center',
    zIndex: 999,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14,
    paddingVertical: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 4,
  },
  menuIconBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 17,
    backgroundColor: '#F3F8FF',
  },
  iconText: {
    fontSize: 20,
    color: '#355C7D',
  },
  input: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderColor: '#EEE',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    minHeight: 40,
    maxHeight: 90,
    marginHorizontal: 4,
  },
  sendText: {
    fontSize: 20,
    color: '#fff',
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#355C7D',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    elevation: 3,
  },

});
