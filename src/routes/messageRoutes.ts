import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
// DİKKAT: 'upload' middleware'ini controller'dan hazır olarak çekiyoruz!
import { getMessages, deleteMessage, clearChatHistory, uploadFile, upload } from '../controllers/messageController';

const router = Router();

// --- MESAJ GETİRME ---
router.get('/:targetId', authenticateToken, getMessages);

// --- YENİ: DOSYA VE FOTOĞRAF YÜKLEME ROTASI ---
// Frontend /api/messages/upload adresine istek atınca bu kapı açılacak
router.post('/upload', authenticateToken, upload.single('image'), uploadFile);

// --- SİLME VE TEMİZLEME ---
router.delete('/:messageId', authenticateToken, deleteMessage);
router.delete('/clear/:targetId', authenticateToken, clearChatHistory);

export default router;