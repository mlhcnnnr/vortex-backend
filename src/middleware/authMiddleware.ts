import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../chat.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'vortex123';

// Request nesnesine 'user' özelliğini ekleyebilmek için TypeScript arayüzünü (interface) genişletiyoruz
export interface AuthRequest extends Request {
    user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    // 1. İstek başlığından (header) token'ı al
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN_KODU" formatından sadece kodu ayıkla

    // 2. Token yoksa kapıdan çevir
    if (!token) {
        res.status(401).json({ message: 'Erişim reddedildi. Token bulunamadı.' });
        return;
    }

    // 3. Token sahte mi veya süresi dolmuş mu kontrol et
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.status(403).json({ message: 'Token geçersiz!' });
            return;
        }
        // 4. Token geçerliyse kullanıcının bilgilerini (id, uniqueTag) isteğin içine yerleştir ve geçişine izin ver
        req.user = user;
        next();
    });
};