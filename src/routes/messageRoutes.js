const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const messageModel = require('../models/messageModel');
const authMiddleware = require('../middleware/authMiddleware');

// Global facility stream chat
router.get('/global', (req, res) => {
    const Page_ = req.query.page || 1;
    const Limit_ = req.query.limit || 50;

    messageModel.Get_Global_Messages(Page_, Limit_, (err, rows) => {
        if (err) {
            console.error("Global Messages Database Error:", err);
            return res.status(500).json({
                success: false,
                message: "Database error",
                error: err
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0] || []
        });
    });
});

router.post('/global', authMiddleware, (req, res) => {
    const Message_Id_ = uuidv4();
    const Sender_Id_ = req.user.id;
    const Content_ = req.body.content || '';

    if (!Content_) {
        return res.status(400).json({
            success: false,
            message: "Missing message content"
        });
    }

    messageModel.Send_Global_Message(
        Message_Id_,
        Sender_Id_,
        Content_,
        (err, rows) => {
            if (err) {
                console.error("Send Global Message Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            return res.status(201).json({
                success: true,
                message: "Global message sent successfully",
                data: { id: Message_Id_ }
            });
        }
    );
});

module.exports = router;
