/**
 * src/seed/seedAdmin.js
 * Script tạo admin mặc định (chạy `npm run seed:admin`)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI chưa được cấu hình trong .env');
    process.exit(1);
}

async function ask(q) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans); }));
}

async function main() {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    const defaultPw = process.env.DEFAULT_ADMIN_PW || 'admin123';

    const email = (await ask(`Admin email (${defaultEmail}): `)) || defaultEmail;
    const password = (await ask(`Admin password (${defaultPw}): `)) || defaultPw;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        console.log('User tồn tại, cập nhật mật khẩu và role -> admin');
        existing.passwordHash = await bcrypt.hash(password, 12);
        existing.role = 'admin';
        await existing.save();
        console.log('Updated admin:', email);
    } else {
        const user = new User({
            email: email.toLowerCase(),
            passwordHash: await bcrypt.hash(password, 12),
            role: 'admin',
            name: 'Administrator'
        });
        await user.save();
        console.log('Created admin:', email);
    }

    mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});