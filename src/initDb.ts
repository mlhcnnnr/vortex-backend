import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../chat.env'), override: true });

async function runMigration() {
    console.log('🔄 Aiven MySQL veritabanına bağlanılıyor...');
    console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    console.log(`Veritabanı: ${process.env.DB_NAME}`);
    console.log(`Kullanıcı: ${process.env.DB_USER}`);

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'avnadmin',
            password: process.env.DB_PASS,
            database: process.env.DB_NAME || 'defaultdb',
            ssl: { rejectUnauthorized: false },
            multipleStatements: true
        });

        console.log('✅ Aiven MySQL Bağlantısı Başarılı!');

        const sqlPath = path.join(__dirname, 'setup_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📦 Tablolar oluşturuluyor (Users, Contacts, Messages, Friendships)...');
        await connection.query(sql);

        console.log('🎉 TÜM TABLOLAR BAŞARIYLA OLUŞTURULDU!');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Hata oluştu:', error);
        process.exit(1);
    }
}

runMigration();
