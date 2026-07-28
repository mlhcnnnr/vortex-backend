import { Router } from 'express';
// acceptFriend fonksiyonunu da süslü parantez içine ekledik
import { addFriend, acceptFriend } from '../controllers/friendController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/add', authenticateToken, addFriend);
// Kabul etme rotamızı ekledik
router.post('/accept', authenticateToken, acceptFriend);

export default router;