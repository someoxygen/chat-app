const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const PrivateMessage = require('./models/PrivateMessage');
const { JWT_SECRET } = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
//import BASE_URL from '@/constants/api';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB bağlantısı
// mongoose.connect('mongodb://localhost:27017/chatapp', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('✅ MongoDB bağlantısı başarılı.'))
// .catch((err) => console.error('❌ MongoDB bağlantı hatası:', err));

mongoose.connect('mongodb+srv://mustafaycl37:Som3dizutsu37@cluster0.j6yay9c.mongodb.net/chatapp?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Atlas bağlantısı başarılı.'))
.catch((err) => console.error('❌ MongoDB bağlantı hatası:', err));


// JWT doğrulama middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token eksik' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token geçersiz' });
    req.user = user;
    next();
  });
};

// Kayıt
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ message: 'Kullanıcı zaten var' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  res.json({ message: 'Kayıt başarılı' });
});

// Giriş
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: 'Kullanıcı bulunamadı' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Geçersiz şifre' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ message: 'Giriş başarılı', token });
});

// Kullanıcı listesi
app.get('/users', async (req, res) => {
  const users = await User.find({}, 'username -_id');
  res.json(users);
});

// Özel mesajları getir
app.get('/private-messages/:user1/:user2', authenticateToken, async (req, res) => {
  const { user1, user2 } = req.params;
  const messages = await PrivateMessage.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 },
    ],
  }).sort({ timestamp: 1 });

  res.json(messages);
});

// Özel mesaj gönder
app.post('/private-message', authenticateToken, async (req, res) => {
  const { sender, receiver, text } = req.body;

  const message = new PrivateMessage({
    sender,
    receiver,
    text,
    timestamp: new Date(),
  });
  await message.save();

  io.to(receiver).emit('private-message', message);
  res.json({ message: 'Mesaj gönderildi' });
});

// Özel mesaj düzenle
app.put('/private-message/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, edited } = req.body;

    const updated = await PrivateMessage.findByIdAndUpdate(id, { text, edited }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Mesaj bulunamadı' });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Özel mesaj sil
app.delete('/private-message/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await PrivateMessage.findByIdAndDelete(id);
    res.json({ success: true, message: 'Mesaj silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Mesaj silinemedi.' });
  }
});

// Tüm mesajları sil
app.delete('/private-messages/:user1/:user2', authenticateToken, async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    await PrivateMessage.deleteMany({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ]
    });
    res.json({ success: true, message: 'Tüm mesajlar silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Mesajlar silinemedi.' });
  }
});

// Base64 resim yükleme
app.post('/upload', authenticateToken, async (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'Resim verisi eksik' });

  const buffer = Buffer.from(base64, 'base64');
  const filename = `${Date.now()}.jpg`;
  const filepath = path.join(__dirname, 'uploads', filename);

  fs.writeFile(filepath, buffer, (err) => {
    if (err) return res.status(500).json({ error: 'Dosya yazılamadı' });

    //const imageUrl = `${BASE_URL}/uploads/${filename}`;
    const imageUrl = `/uploads/${filename}`;
    res.json({ imageUrl });
  });
});

// Base64 ses dosyası yükleme
app.post('/upload-audio', authenticateToken, async (req, res) => {
  const { base64, extension } = req.body; // extension: "m4a" veya "mp3"
  if (!base64) return res.status(400).json({ error: 'Ses verisi eksik' });

  // Dosya uzantısını kontrol et, yoksa m4a olarak ata
  const ext = extension && (extension === 'mp3' || extension === 'wav' || extension === 'ogg') ? extension : 'm4a';
  const filename = `${Date.now()}.${ext}`;
  const filepath = path.join(__dirname, 'uploads', filename);

  // Ses dosyasını kaydet
  fs.writeFile(filepath, Buffer.from(base64, 'base64'), (err) => {
    if (err) return res.status(500).json({ error: 'Ses dosyası kaydedilemedi' });

    //const audioUrl = `${BASE_URL}/uploads/${filename}`;
    const audioUrl = `/uploads/${filename}`;
    res.json({ audioUrl });
  });
});

// Base64 video dosyası yükleme
app.post('/upload-video', authenticateToken, async (req, res) => {
  const { base64, extension } = req.body; // extension: "mp4" ya da "mov" gibi
  if (!base64) return res.status(400).json({ error: 'Video verisi eksik' });

  // Sadece .mp4 ve .mov uzantılarına izin verelim
  const ext = extension && (extension === 'mp4' || extension === 'mov' || extension === 'webm') ? extension : 'mp4';
  const filename = `${Date.now()}.${ext}`;
  const filepath = path.join(__dirname, 'uploads', filename);

  fs.writeFile(filepath, Buffer.from(base64, 'base64'), (err) => {
    if (err) return res.status(500).json({ error: 'Video kaydedilemedi' });

    //const videoUrl = `${BASE_URL}/uploads/${filename}`;
    const videoUrl = `/uploads/${filename}`;
    res.json({ videoUrl });
  });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('🔗 Yeni bağlantı');

  socket.on('join', (username) => {
    socket.join(username);
  });

  socket.on('private-message', async (msg) => {
    const message = new PrivateMessage({
      sender: msg.sender,
      receiver: msg.receiver,
      text: msg.text,
      timestamp: new Date(),
    });
    await message.save();
    io.to(msg.receiver).emit('private-message', message);
  });

  socket.on('disconnect', () => {
    console.log('❌ Bağlantı kesildi');
  });
});

// Sunucuyu başlat
server.listen(3000, () => {
  console.log('✅ Sunucu 3000 portunda çalışıyor...');
});
