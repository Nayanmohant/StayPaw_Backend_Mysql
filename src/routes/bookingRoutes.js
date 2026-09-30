const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const bookingModel = require('../models/bookingModel');
const authMiddleware = require('../middleware/authMiddleware');

// All booking operations require authenticated session
router.use(authMiddleware);

router.post('/', (req, res) => {
    const Booking_Id_ = uuidv4();
    const User_Id_ = req.user.id;
    const Shelter_Id_ = req.body.shelterId || null;
    const Start_Date_ = req.body.startDate || null;
    const End_Date_ = req.body.endDate || null;
    const Subtotal_ = req.body.subtotal || 0;
    const Tax_ = req.body.tax || 0;
    const Service_Fee_ = req.body.serviceFee || 0;
    const Total_Price_ = req.body.totalPrice || 0;

    if (!Shelter_Id_ || !Start_Date_ || !End_Date_) {
        return res.status(400).json({
            success: false,
            message: "Missing required booking details"
        });
    }

    bookingModel.Create_Booking(
        Booking_Id_,
        User_Id_,
        Shelter_Id_,
        Start_Date_,
        End_Date_,
        Subtotal_,
        Tax_,
        Service_Fee_,
        Total_Price_,
        (err, rows) => {
            if (err) {
                console.error("Create Booking Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            return res.status(200).json({
                success: true,
                message: "Booking created successfully",
                data: { id: Booking_Id_ }
            });
        }
    );
});

router.get('/', (req, res) => {
    const User_Id_ = req.user.id;

    bookingModel.List_Bookings(
        User_Id_,
        (err, rows) => {
            if (err) {
                console.error("List Bookings Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            // Stored procedure returns multiple result sets, data is typically in rows[0]
            return res.status(200).json({
                success: true,
                message: "Bookings fetched successfully",
                data: rows[0] || []
            });
        }
    );
});

router.get('/:bookingId', (req, res) => {
    const Booking_Id_ = req.params.bookingId;

    bookingModel.Get_Booking_By_Id(
        Booking_Id_,
        (err, rows) => {
            if (err) {
                console.error("Get Booking Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            return res.status(200).json({
                success: true,
                message: "Booking fetched successfully",
                data: (rows[0] && rows[0].length > 0) ? rows[0][0] : null
            });
        }
    );
});

router.patch('/:bookingId/status', (req, res) => {
    const Booking_Id_ = req.params.bookingId;
    const Status_ = req.body.status || '';

    if (!Status_) {
        return res.status(400).json({
            success: false,
            message: "status field is required"
        });
    }

    bookingModel.Update_Booking_Status(
        Booking_Id_,
        Status_,
        (err, rows) => {
            if (err) {
                console.error("Update Booking Status Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            return res.status(200).json({
                success: true,
                message: "Status updated successfully"
            });
        }
    );
});

router.get('/:bookingId/activities', (req, res) => {
    const Booking_Id_ = req.params.bookingId;
    const User_Id_ = req.user.id;
    const Page_ = req.query.page || 1;
    const Limit_ = req.query.limit || 10;

    const activityModel = require('../models/activityModel');

    activityModel.Get_Booking_Activities(Booking_Id_, User_Id_, Page_, Limit_, (err, rows) => {
        if (err) {
            console.error("Booking Activities Database Error:", err);
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

router.post('/:bookingId/activities', (req, res) => {
    const Activity_Id_ = uuidv4();
    const Booking_Id_ = req.params.bookingId;
    const Type_ = req.body.type || '';
    const Title_ = req.body.title || '';
    const Description_ = req.body.description || null;
    const Mood_ = req.body.mood || null;
    const Photo_Url_ = req.body.photoUrl || null;
    const Time_Label_ = req.body.timeLabel || null;

    if (!Type_ || !Title_) {
        return res.status(400).json({
            success: false,
            message: "Missing required activity details"
        });
    }

    const activityModel = require('../models/activityModel');

    activityModel.Create_Activity(
        Activity_Id_,
        Booking_Id_,
        Type_,
        Title_,
        Description_,
        Mood_,
        Photo_Url_,
        Time_Label_,
        (err, rows) => {
            if (err) {
                console.error("Create Activity Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            return res.status(201).json({
                success: true,
                message: "Activity created successfully",
                data: { id: Activity_Id_ }
            });
        }
    );
});

router.get('/:bookingId/messages', (req, res) => {
    const Booking_Id_ = req.params.bookingId;
    const User_Id_ = req.user.id;
    const Page_ = req.query.page || 1;
    const Limit_ = req.query.limit || 50;

    const messageModel = require('../models/messageModel');

    messageModel.Get_Booking_Messages(Booking_Id_, User_Id_, Page_, Limit_, (err, rows) => {
        if (err) {
            console.error("Booking Messages Database Error:", err);
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

router.post('/:bookingId/messages', (req, res) => {
    const Message_Id_ = uuidv4();
    const Booking_Id_ = req.params.bookingId;
    const Sender_Id_ = req.user.id;
    const Content_ = req.body.content || '';

    if (!Content_) {
        return res.status(400).json({
            success: false,
            message: "Missing message content"
        });
    }

    const messageModel = require('../models/messageModel');

    messageModel.Send_Booking_Message(
        Message_Id_,
        Booking_Id_,
        Sender_Id_,
        Content_,
        (err, rows) => {
            if (err) {
                console.error("Send Booking Message Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            return res.status(201).json({
                success: true,
                message: "Message sent successfully",
                data: { id: Message_Id_ }
            });
        }
    );
});

router.patch('/:bookingId/messages/read', (req, res) => {
    const Booking_Id_ = req.params.bookingId;
    const User_Id_ = req.user.id;

    const messageModel = require('../models/messageModel');

    messageModel.Mark_Booking_Messages_Read(
        Booking_Id_,
        User_Id_,
        (err, rows) => {
            if (err) {
                console.error("Mark Messages Read Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err
                });
            }

            return res.status(200).json({
                success: true,
                message: "Messages marked as read"
            });
        }
    );
});

module.exports = router;
