import { Router } from 'express';
import { register, login, verifyEmail } from '../controllers/authController'; // verifyEmail eklendi

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify/:token', verifyEmail); // YENİ ROTA EKLENDİ (Tarayıcıdan açılacağı için GET metodu kullanıyoruz)

export default router;