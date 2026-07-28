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

// Bulut sunucuları (Render/AWS) için SSL destekli Gmail SMTP yapılandırması
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL kullanımı
    auth: {
        user: process.env.EMAIL_USER || 'vortex.ch4t@gmail.com',
        pass: process.env.EMAIL_PASS || 'wmwxpjzmqomlygyk'
    }
});

// 1. KAYIT OLMA (Otomatik Doğrulama ile Anında Giriş İmkanı)
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

        // Kullanıcıyı direkt olarak is_verified = 1 (doğrulanmış) olarak kaydediyoruz
        // Böylece e-posta gecikse veya engellense bile hemen giriş yapabilir!
        await pool.query(
            'INSERT INTO Users (username, email, password_hash, unique_tag, is_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, uniqueTag, 1, null]
        );

        // Arka planda hoş geldin e-postası göndermeyi dene (başarısız olsa bile kaydı engellemez)
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER || 'vortex.ch4t@gmail.com',
                to: email,
                subject: 'Vortex Chat\'e Hoş Geldin!',
                html: `
                    <h2>Vortex'e Hoş Geldin, ${username}!</h2>
                    <p>Hesabın başarıyla oluşturuldu. Etiketin: <strong>${uniqueTag}</strong></p>
                    <p>Artık uygulamaya girip hemen arkadaşlarınla sohbet edebilirsin!</p>
                `
            };
            transporter.sendMail(mailOptions).catch(err => console.error("E-posta gönderim uyarısı:", err));
        } catch (e) {
            console.error("E-posta gönderilemedi:", e);
        }

        res.status(201).json({ message: 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.' });
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