import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

export const addFriend = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // İstek yapan kişinin kendi ID'si (Bunu doğrudan kimlik kartından, yani Middleware'den alıyoruz)
        const senderId = req.user.id;
        
        // Eklemek istediği kişinin ID etiketi (Kullanıcı bunu arayüzden girecek)
        const { targetTag } = req.body;

        if (!targetTag) {
            res.status(400).json({ message: 'Lütfen eklemek istediğiniz kişinin etiketini girin.' });
            return;
        }

        // 1. Hedef kullanıcıyı veritabanında bul
        const [targetUsers]: any = await pool.query('SELECT * FROM Users WHERE unique_tag = ?', [targetTag]);
        if (targetUsers.length === 0) {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            return;
        }

        const receiverId = targetUsers[0].id;

        // 2. Kendini eklemeye çalışıyorsa engelle
        if (senderId === receiverId) {
            res.status(400).json({ message: 'Kendinize arkadaşlık isteği gönderemezsiniz.' });
            return;
        }

        // 3. Zaten istek atılmış mı veya zaten arkadaşlar mı kontrol et
        const [existingFriendship]: any = await pool.query(
            'SELECT * FROM Friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)',
            [senderId, receiverId, receiverId, senderId]
        );

        if (existingFriendship.length > 0) {
            res.status(400).json({ message: 'Bu kullanıcı ile zaten bir bağlantınız veya bekleyen bir isteğiniz var.' });
            return;
        }

        // 4. İsteği veritabanına 'pending' (beklemede) olarak kaydet
        await pool.query(
            'INSERT INTO Friendships (user_id_1, user_id_2, status) VALUES (?, ?, ?)',
            [senderId, receiverId, 'pending']
        );

        res.status(201).json({ message: 'Arkadaşlık isteği başarıyla gönderildi!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
};
// Arkadaşlık isteğini kabul etme fonksiyonu
export const acceptFriend = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // İsteği kabul edecek olan kişi (Şu an giriş yapmış ve token'ı olan kişi)
        const receiverId = req.user.id;
        
        // İsteği atan kişinin etiketi
        const { senderTag } = req.body;

        if (!senderTag) {
            res.status(400).json({ message: 'Lütfen isteğini kabul edeceğiniz kişinin etiketini girin.' });
            return;
        }

        // 1. İsteği atan kullanıcının ID'sini bul
        const [senderUsers]: any = await pool.query('SELECT id FROM Users WHERE unique_tag = ?', [senderTag]);
        if (senderUsers.length === 0) {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            return;
        }
        const senderId = senderUsers[0].id;

        // 2. Bekleyen bir istek var mı kontrol et ve durumunu 'accepted' olarak güncelle
        const [result]: any = await pool.query(
            `UPDATE Friendships SET status = 'accepted' 
             WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'pending'`,
            [senderId, receiverId]
        );

        // affectedRows, veritabanında kaç satırın değiştiğini söyler. 0 ise öyle bir istek yoktur.
        if (result.affectedRows === 0) {
            res.status(400).json({ message: 'Bu kullanıcıdan gelen bekleyen bir istek bulunamadı.' });
            return;
        }

        res.status(200).json({ message: 'Arkadaşlık isteği başarıyla kabul edildi, artık sohbet edebilirsiniz!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası oluştu.' });
    }
};