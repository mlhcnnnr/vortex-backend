import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../chat.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'vortex123';

// E-posta Gönderici Ayarları
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'vortex.ch4t@gmail.com',
        pass: process.env.EMAIL_PASS || 'wmwxpjzmqomlygyk'
    }
});

// 1. KAYIT OLMA
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, email, password } = req.body;

        const [existingUsers]: any = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            res.status(400).json({ message: 'Bu e-posta adresi zaten kullanımda.' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const randomTag = Math.floor(1000 + Math.random() * 9000);
        const uniqueTag = `${username}#${randomTag}`;

        const verificationToken = crypto.randomBytes(32).toString('hex');

        await pool.query(
            'INSERT INTO Users (username, email, password_hash, unique_tag, is_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, uniqueTag, 0, verificationToken]
        );

        // BASE_URL ortam değişkeninden alınır, canlıya alırken değiştirmek yeterli
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        const verificationLink = `${baseUrl}/api/auth/verify/${verificationToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'vortex.ch4t@gmail.com',
            to: email,
            subject: 'Vortex Chat - E-Posta Doğrulama',
            html: `
                <h2>Vortex'e Hoş Geldin, ${username}!</h2>
                <p>Hesabını aktifleştirmek ve sohbete başlamak için lütfen aşağıdaki bağlantıya tıkla:</p>
                <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Hesabımı Doğrula</a>
                <br><br>
                <p>Eğer bu hesabı sen açmadıysan, bu e-postayı görmezden gelebilirsin.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({ message: 'Kayıt başarılı! Lütfen e-posta adresinize giderek hesabınızı doğrulayın.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
};

// 2. GİRİŞ YAPMA
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const [users]: any = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (users.length === 0) {
            res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            return;
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            res.status(401).json({ message: 'Geçersiz şifre.' });
            return;
        }

        // MySQL'den gelen Buffer veya 0/1 değerini kesin olarak kontrol ediyoruz
        if (user.is_verified === 0 || user.is_verified === false) {
            res.status(403).json({ message: 'Lütfen önce e-posta adresinize gönderilen linkten hesabınızı doğrulayın.' });
            return;
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
        
        res.status(200).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                uniqueTag: user.unique_tag,
                profile_pic: user.profile_pic
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
};

// 3. E-POSTA DOĞRULAMA İŞLEMİ
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.params;

        const [users]: any = await pool.query('SELECT * FROM Users WHERE verification_token = ?', [token]);
        
        if (users.length === 0) {
            res.status(400).send('<h1>Geçersiz veya süresi dolmuş bağlantı.</h1>');
            return;
        }

        await pool.query(
            'UPDATE Users SET is_verified = ?, verification_token = ? WHERE id = ?',
            [1, null, users[0].id]
        );

        res.status(200).send(`
            <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
                <h1 style="color: #4CAF50;">✅ Hesabınız Başarıyla Doğrulandı!</h1>
                <p>Artık Vortex Chat uygulamasına dönüp giriş yapabilirsiniz.</p>
            </div>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('<h1>Sunucu hatası oluştu.</h1>');
    }
};