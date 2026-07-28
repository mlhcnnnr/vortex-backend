import { Response } from 'express';
import pool from '../db';
import { AuthRequest } from '../middleware/authMiddleware';

// 1. Kişi Ekleme Fonksiyonu (Tag ile Arama)
export const addContact = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user.id;
        const { targetTag, alias } = req.body; 

        // CASUS 1: Kim, kimi eklemeye çalışıyor?
        console.log(`\n➕ [KİŞİ EKLEME İSTEĞİ] Ekleyen ID: ${ownerId} | Aranan Etiket: ${targetTag} | Kaydedilecek İsim: ${alias}`);

        // Etiketi veritabanında ara (LIKE ile esnek arama)
        const [users]: any = await pool.query('SELECT id FROM Users WHERE unique_tag LIKE ?', [`%${targetTag}%`]);
        
        if (users.length === 0) {
            console.log("❌ SONUÇ: Kullanıcı bulunamadı.");
            res.status(404).json({ message: 'Bu etikete sahip bir kullanıcı bulunamadı.' });
            return;
        }

        const targetId = users[0].id;
        console.log(`✅ SONUÇ: Hedef bulundu! Hedefin ID'si: ${targetId}`);

        // Bulunan ID ile rehbere ekle
        await pool.query(
            `INSERT INTO Contacts (owner_id, target_id, alias) VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE alias = ?`,
            [ownerId, targetId, alias, alias]
        );
        
        console.log("💾 SONUÇ: Veritabanına başarıyla yazıldı!");
        res.status(200).json({ message: 'Kişi başarıyla eklendi!' });
    } catch (error) {
        console.error("Kişi ekleme hatası:", error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
};

// 2. Rehberdeki Kişileri Listeleme (Profil fotoğrafı dahil)
export const getContacts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user.id;
        
        // CASUS 2: Rehber çekilirken kimlik doğru mu?
        console.log(`\n📖 [REHBERİ GETİR] İstek atan kişinin ID'si: ${ownerId}`);

        // u.profile_pic eklendi, artık fotoğraflar da arayüze gidiyor
        const [contacts]: any = await pool.query(
            `SELECT c.target_id as id, c.alias, u.unique_tag, u.profile_pic 
             FROM Contacts c
             JOIN Users u ON c.target_id = u.id
             WHERE c.owner_id = ?
             ORDER BY c.alias ASC`,
            [ownerId]
        );

        // CASUS 3: Veritabanı ne cevap verdi?
        console.log(`📦 Veritabanından dönen liste:`, contacts);

        res.status(200).json(contacts);
    } catch (error) {
        console.error("Rehber çekme hatası:", error);
        res.status(500).json({ message: 'Rehber çekilirken hata oluştu.' });
    }
};