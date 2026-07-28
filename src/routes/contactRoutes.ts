import { Router } from 'express';
import { addContact, getContacts } from '../controllers/contactController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/add', authenticateToken, addContact); // Kişi ekleme rotası
router.get('/', authenticateToken, getContacts);    // Rehberi getirme rotası

export default router;