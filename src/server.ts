import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './db';
import authRoutes from './routes/authRoutes';
import friendRoutes from './routes/friendRoutes';
import messageRoutes from './routes/messageRoutes';
import contactRoutes from './routes/contactRoutes';
import userRoutes from './routes/userRoutes';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../chat.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// HTTP sunucusunu Express ile birleştiriyoruz
const httpServer = createServer(app);

// Socket.io sunucusunu HTTP sunucumuzun üzerine kuruyoruz
const io = new Server(httpServer, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST", "DELETE", "PUT"], // İhtiyacına göre PUT'u da ekledim
    credentials: true
}));
app.use(express.json());

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/users', userRoutes);

// Yüklenen fotoğrafları/belgeleri dışa aç (Statik klasör)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// GERÇEK ZAMANLI BAĞLANTI DİNLEYİCİSİ
const onlineUsers = new Map<number, string>();

io.on('connection', (socket) => {
    console.log(`🟢 Yeni cihaz bağlandı! Geçici Socket ID: ${socket.id}`);

    // 1. Kullanıcı giriş yaptığında kimliğini sunucuya bildirir
    socket.on('user_connected', (userId: number) => {
        const numUserId = Number(userId);
        onlineUsers.set(numUserId, socket.id);
        console.log(`👤 Kullanıcı ID [${numUserId}] online oldu. (Socket: ${socket.id})`);
    });

    // 2. Özel Mesaj Gönderme İşlemi
    socket.on('send_message', async (data) => {
        const { senderId, receiverId, message } = data;
        const numSenderId = Number(senderId);
        const numReceiverId = Number(receiverId);

        try {
            const [result]: any = await pool.query(
                'INSERT INTO Messages (sender_id, receiver_id, message_text) VALUES (?, ?, ?)',
                [numSenderId, numReceiverId, message]
            );
            const messageId = result.insertId;

            const [checkSender]: any = await pool.query('SELECT id FROM Contacts WHERE owner_id = ? AND target_id = ?', [numSenderId, numReceiverId]);
            if (checkSender.length === 0) {
                const [userRow]: any = await pool.query('SELECT username FROM Users WHERE id = ?', [numReceiverId]);
                if (userRow.length > 0) {
                    await pool.query('INSERT INTO Contacts (owner_id, target_id, alias) VALUES (?, ?, ?)', [numSenderId, numReceiverId, userRow[0].username]);
                }
            }

            const [checkReceiver]: any = await pool.query('SELECT id FROM Contacts WHERE owner_id = ? AND target_id = ?', [numReceiverId, numSenderId]);
            if (checkReceiver.length === 0) {
                const [userRow]: any = await pool.query('SELECT username FROM Users WHERE id = ?', [numSenderId]);
                if (userRow.length > 0) {
                    await pool.query('INSERT INTO Contacts (owner_id, target_id, alias) VALUES (?, ?, ?)', [numReceiverId, numSenderId, userRow[0].username]);
                }
            }

            const receiverSocketId = onlineUsers.get(numReceiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_message', {
                    messageId: messageId,
                    senderId: numSenderId,
                    message: message,
                    timestamp: new Date()
                });
                console.log(`✉️ Mesaj iletildi: [${numSenderId}] -> [${numReceiverId}]`);
            } else {
                console.log(`✉️ Mesaj kaydedildi ama kullanıcı [${numReceiverId}] çevrimdışı.`);
            }
        } catch (error) {
            console.error("Mesaj kaydedilirken hata oluştu:", error);
        }
    });

    // ==========================================
    // --- WEBRTC SESLİ ARAMA SİNYALİZASYONU ---
    // ==========================================
    socket.on('call_user', (data) => {
        const { userToCall, signalData, from, name } = data;
        const targetId = Number(userToCall);
        const fromId = Number(from);
        const receiverSocketId = onlineUsers.get(targetId);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call_incoming', { 
                signal: signalData, 
                from: fromId, 
                name: name 
            });
            console.log(`📞 Arama isteği iletildi: [${fromId}] -> [${targetId}]`);
        } else {
            console.log(`📞 Arama başarısız: Kullanıcı [${targetId}] çevrimdışı.`);
        }
    });

    socket.on('answer_call', (data) => {
        const { to, signal } = data;
        const targetId = Number(to);
        const callerSocketId = onlineUsers.get(targetId);
        
        if (callerSocketId) {
            io.to(callerSocketId).emit('call_accepted', signal);
            console.log(`✅ Arama kabul edildi: [${targetId}] ile görüşme başladı.`);
        } else {
            console.log(`⚠️ Arama kabul edilemedi: Arayan [${targetId}] socket'i bulunamadı.`);
        }
    });

    socket.on('send_ice_candidate', (data) => {
        const { to, candidate } = data;
        const targetId = Number(to);
        const targetSocketId = onlineUsers.get(targetId);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_ice_candidate', candidate);
        }
    });

    socket.on('end_call', (data) => {
        const targetId = Number(data?.to);
        const targetSocketId = onlineUsers.get(targetId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call_ended');
            console.log(`🛑 Arama sonlandırıldı/reddedildi. Hedef: [${targetId}]`);
        }
    });

    // ==========================================
    // --- MAVİ TİK (GÖRÜLDÜ) SİSTEMİ ---
    // ==========================================
    socket.on('mark_messages_read', async (data) => {
        const { readerId, senderId } = data;
        const numReaderId = Number(readerId);
        const numSenderId = Number(senderId);
        try {
            await pool.query(
                'UPDATE Messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
                [numReaderId, numSenderId]
            );

            const senderSocketId = onlineUsers.get(numSenderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit('messages_marked_read', { receiverId: numReaderId });
            }
        } catch (error) {
            console.error("Görüldü bilgisi güncellenirken hata:", error);
        }    
    });

    // ==========================================
    // --- KULLANICI ÇIKIŞ YAPTIĞINDA ---
    // ==========================================
    socket.on('disconnect', () => {
        for (let [userId, sockId] of onlineUsers.entries()) {
            if (sockId === socket.id) {
                onlineUsers.delete(userId);
                console.log(`🔴 Kullanıcı ID [${userId}] offline oldu.`);
                break;
            }
        }
    });
});

// Veritabanı test rotası
app.get('/', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        res.send('Vortex Sunucusu Ayakta! 🚀');
    } catch (error) {
        res.status(500).send('Veritabanı bağlantı hatası: ' + error);
    }
});

// Mevcut halini şu şekilde değiştir:
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Sunucu http://0.0.0.0:${PORT} adresinde tüm ağ bağlantılarına açık çalışıyor.`);
});
