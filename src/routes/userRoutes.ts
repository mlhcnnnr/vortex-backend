import { Router } from 'express';
import multer from 'multer';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Yükleme klasörünü ayarla (Yoksa otomatik oluştur)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req: any, file, cb) => {
        // Dosya ismini benzersiz yapıyoruz: kullaniciID-tarih.uzantı
        cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Fotoğraf Yükleme Rotası
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res: any): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'Lütfen bir dosya seçin.' });
            return;
        }
        
        // Fotoğrafın kaydedildiği URL yolu
        const imageUrl = `/uploads/${req.file.filename}`;
        
        // Veritabanını güncelle
        await pool.query('UPDATE Users SET profile_pic = ? WHERE id = ?', [imageUrl, req.user.id]);
        
        res.status(200).json({ message: 'Profil fotoğrafı güncellendi', profile_pic: imageUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Fotoğraf yüklenirken sunucu hatası.' });
    }
});

export default router;