const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const activityModel = require('../models/activityModel');
const authMiddleware = require('../middleware/authMiddleware');

// Live stream activity timeline
router.get('/live', (req, res) => {
    const Limit_ = req.query.limit || 20;

    activityModel.Get_Live_Activities(Limit_, (err, rows) => {
        if (err) {
            console.error("Live Activities Database Error:", err);
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

// Scoped care activities for authenticated user's bookings
router.get('/', authMiddleware, (req, res) => {
    const User_Id_ = req.user.id;
    const Booking_Id_ = req.query.bookingId || null;
    const Page_ = req.query.page || 1;
    const Limit_ = req.query.limit || 10;

    activityModel.Get_Scoped_Activities(User_Id_, Booking_Id_, Page_, Limit_, (err, rows) => {
        if (err) {
            console.error("Scoped Activities Database Error:", err);
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

module.exports = router;
