const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const userModel = require('../models/userModel');
const authMiddleware = require('../middleware/authMiddleware');
const { generateToken } = require('../utils/jwt');
const { formatUserResponse } = require('../utils/userFormatter');

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
    const name = req.body.name || '';
    const email = req.body.email || '';
    const password = req.body.password || '';

    if (!name || !email || !password || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Invalid registration data' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    userModel.Check_Email_Exists(normalizedEmail, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        
        if (rows && rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }

        bcrypt.hash(password, SALT_ROUNDS, (err, passwordHash) => {
            if (err) return res.status(500).json({ success: false, message: 'Hashing error' });

            const userId = uuidv4();
            const providerId = uuidv4();

            userModel.Register_User(userId, trimmedName, normalizedEmail, passwordHash, providerId, (err, rows) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });

                const createdUser = (rows[0] && rows[0].length > 0) ? rows[0][0] : null;
                if (!createdUser) return res.status(500).json({ success: false, message: 'Failed to create user' });

                const token = generateToken(createdUser);

                return res.status(201).json({
                    success: true,
                    data: {
                        token,
                        user: formatUserResponse(createdUser)
                    }
                });
            });
        });
    });
});

router.post('/login', (req, res) => {
    const email = req.body.email || '';
    const password = req.body.password || '';

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    userModel.Get_User_By_Email(normalizedEmail, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        const user = (rows[0] && rows[0].length > 0) ? rows[0][0] : null;

        if (!user || !user.password_hash) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) return res.status(500).json({ success: false, message: 'Server error' });

            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const token = generateToken(user);
            return res.status(200).json({
                success: true,
                data: {
                    token,
                    user: formatUserResponse(user)
                }
            });
        });
    });
});

router.get('/me', authMiddleware, (req, res) => {
    return res.status(200).json({
        success: true,
        data: req.user,
    });
});

router.post('/logout', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Session invalidated',
    });
});

module.exports = router;
