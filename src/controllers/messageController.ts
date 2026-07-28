import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';
import multer from 'multer';

// 1. Multer Ayarları (Resim ve Belgeler İçin Güçlendirildi)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Dosyaların kaydedileceği klasör
    },
    filename: (req, file, cb) => {
        // İsim çakışmasını önlemek için benzersiz isim
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

// 20MB'a kadar dosya izni veriyoruz
export const upload = multer({ 
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }
});

// 2. Geçmiş Mesajları Çekme
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const myId = req.user.id;
        const targetId = req.params.targetId;

        const [messages]: any = await pool.query(
            `SELECT * FROM Messages 
             WHERE (sender_id = ? AND receiver_id = ?) 
                OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY sent_at ASC`,
            [myId, targetId, targetId, myId]
        );
        res.status(200).json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Mesajlar çekilirken hata oluştu.' });
    }
};

// 3. Dosya ve Metin Mesajı Gönderme (Frontend ile %100 Uyumlu)
export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Frontend'den gelen 'message' değişkenini kullanıyoruz
        const { receiverId, message } = req.body;
        const senderId = req.user.id;
        
        // Eğer bir dosya yüklendiyse yolu al, yüklenmediyse null bırak
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        await pool.query(
            'INSERT INTO Messages (sender_id, receiver_id, message_text, image_url) VALUES (?, ?, ?, ?)',
            [senderId, receiverId, message || '', imageUrl]
        );

        res.status(200).json({ message: 'Dosya/Mesaj başarıyla gönderildi.', imageUrl });
    } catch (error) {
        console.error("Yükleme hatası:", error);
        res.status(500).json({ message: 'Mesaj gönderilemedi.' });
    }
};

// 4. Mesaj Silme
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const messageId = req.params.messageId;
        const myId = req.user.id;

        const [msg]: any = await pool.query('SELECT sender_id FROM Messages WHERE id = ?', [messageId]);
        if (msg.length === 0 || msg[0].sender_id !== myId) {
            res.status(403).json({ message: 'Yetkisiz işlem veya mesaj bulunamadı.' });
            return;
        }

        await pool.query('DELETE FROM Messages WHERE id = ?', [messageId]);
        res.status(200).json({ message: 'Mesaj başarıyla silindi.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Silme hatası.' });
    }
};

// 5. Sohbeti Temizleme
export const clearChatHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const myId = req.user.id;
        const targetId = req.params.targetId;

        await pool.query(
            `DELETE FROM Messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
            [myId, targetId, targetId, myId]
        );
        res.status(200).json({ message: 'Sohbet geçmişi temizlendi.' });
    } catch (error) {
        res.status(500).json({ message: 'Temizleme hatası.' });
    }
};