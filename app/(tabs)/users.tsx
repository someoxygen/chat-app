import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const windowHeight = Dimensions.get('window').height;

export default function UsersScreen() {
  const [users, setUsers] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch('http://192.168.1.101:3000/users')
      .then(res => res.json())
      .then(data => {
        const usernames = data.map((user: any) => user.username);
        setUsers(usernames);
      });
  }, []);

  const openChat = (receiver: string) => {
    router.push({
      pathname: '/chat/[receiver]',
      params: { receiver },
    });
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    Alert.alert('Çıkış Yapıldı', 'Başarıyla çıkış yaptınız.');
    router.replace('/login');
  };

  const getColorForUser = (username: string) => {
    const colors = ['#FF8A65', '#4DB6AC', '#BA68C8', '#7986CB', '#FFD54F'];
    const index = username.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>👥 Kullanıcı Listesi</Text>

        {users.length === 0 && (
          <Text style={styles.emptyText}>Kullanıcı bulunamadı</Text>
        )}

        <FlatList
          data={users}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userItem} onPress={() => openChat(item)}>
              <Text style={[styles.avatar, { backgroundColor: getColorForUser(item) }]}>
                {item[0]?.toUpperCase()}
              </Text>
              <Text style={styles.username}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f8fb',
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 38,
    backgroundColor: '#f6f8fb',
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#222a36',
    marginBottom: 18,
    letterSpacing: 1,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    marginTop: 30,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 13,
    shadowColor: '#0d182b',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e6ecf5',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    color: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
    fontSize: 20,
    marginRight: 14,
    lineHeight: 44,
    borderWidth: 1,
    borderColor: '#d3dcec',
  },
  username: {
    fontSize: 18,
    color: '#323c4d',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  bottomBar: {
    width: '100%',
    padding: 20,
    backgroundColor: 'rgba(246,248,251,0.98)',
    borderTopWidth: 1,
    borderColor: '#e6ecf5',
    position: 'absolute',
    bottom: 0,
    left: 0,
    alignItems: 'center',
  },
  logoutBtn: {
    width: '96%',
    backgroundColor: '#e53935',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#e53935',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 12,
    elevation: 3,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
