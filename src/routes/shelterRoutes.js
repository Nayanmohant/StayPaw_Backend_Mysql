const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const shelterModel = require('../models/shelterModel');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Public shelter browsing and inquiries
router.get('/', (req, res) => {
    const Search_ = req.query.search || null;
    const Query_ = req.query.query || null;
    const Is_Live_ = req.query.isLive || null;
    const Min_Rating_ = req.query.minRating || null;
    const Max_Price_ = req.query.maxPrice || null;
    const Sort_By_ = req.query.sortBy || null;
    const Approval_Status_ = req.query.approvalStatus || null;
    const Page_ = req.query.page || 1;
    const Limit_ = req.query.limit || 10;

    shelterModel.List_Shelters(Search_, Query_, Is_Live_, Min_Rating_, Max_Price_, Sort_By_, Approval_Status_, Page_, Limit_, (err, rows) => {
        if (err) {
            console.error("List Shelters Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, data: rows[0] || [] });
    });
});

router.get('/:shelterId', (req, res) => {
    const Shelter_Id_ = req.params.shelterId;
    if (!Shelter_Id_) return res.status(400).json({ success: false, message: "Shelter ID is required" });

    shelterModel.Get_Shelter_By_Id(Shelter_Id_, (err, rows) => {
        if (err) {
            console.error("Get Shelter Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, data: (rows[0] && rows[0].length > 0) ? rows[0][0] : null });
    });
});

router.get('/:shelterId/reviews', (req, res) => {
    const Shelter_Id_ = req.params.shelterId;
    const Page_ = req.query.page || 1;
    const Limit_ = req.query.limit || 10;

    shelterModel.Get_Shelter_Reviews(Shelter_Id_, Page_, Limit_, (err, rows) => {
        if (err) {
            console.error("Get Shelter Reviews Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, data: rows[0] || [] });
    });
});

router.get('/:shelterId/availability', (req, res) => {
    const Shelter_Id_ = req.params.shelterId;
    const Start_Date_ = req.query.startDate;
    const End_Date_ = req.query.endDate;

    if (!Start_Date_ || !End_Date_) {
        return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    shelterModel.Check_Availability(Shelter_Id_, Start_Date_, End_Date_, (err, rows) => {
        if (err) {
            console.error("Check Availability Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, data: rows[0] || [] });
    });
});

router.get('/:shelterId/activities', (req, res) => {
    const Shelter_Id_ = req.params.shelterId;
    const Limit_ = req.query.limit || 10;

    shelterModel.Get_Shelter_Activities(Shelter_Id_, Limit_, (err, rows) => {
        if (err) {
            console.error("Get Shelter Activities Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, data: rows[0] || [] });
    });
});

// Customer review submission (Authenticated)
router.post('/:shelterId/reviews', authMiddleware, (req, res) => {
    const Review_Id_ = uuidv4();
    const Shelter_Id_ = req.params.shelterId;
    const User_Id_ = req.user.id;
    const Rating_ = req.body.rating;
    const Comment_ = req.body.comment || null;

    if (Rating_ === undefined || Rating_ === null) {
        return res.status(400).json({ success: false, message: "Rating is required" });
    }

    shelterModel.Add_Shelter_Review(Review_Id_, Shelter_Id_, User_Id_, Rating_, Comment_, (err, rows) => {
        if (err) {
            console.error("Add Shelter Review Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(201).json({ success: true, message: "Review submitted successfully", data: { id: Review_Id_ } });
    });
});

// Shelter management (Admin only)
router.post('/', authMiddleware, requireRole('shelter_admin', 'super_admin'), (req, res) => {
    const Shelter_Id_ = uuidv4();
    const Admin_Id_ = req.user.id;
    const Name_ = req.body.name || '';
    const Image_Url_ = req.body.imageUrl || null;
    const Address_ = req.body.address || null;
    const Price_Per_Night_ = req.body.pricePerNight || 0;
    const Distance_ = req.body.distance || null;
    const Is_Live_ = req.body.isLive || false;
    const Description_ = req.body.description || null;
    const Approval_Status_ = req.user.role === 'super_admin' ? (req.body.approvalStatus || 'approved') : 'pending';

    if (!Name_ || Name_.trim().length === 0) {
        return res.status(400).json({ success: false, message: "Shelter name is required" });
    }

    shelterModel.Create_Shelter(Shelter_Id_, Admin_Id_, Name_, Image_Url_, Address_, Price_Per_Night_, Distance_, Is_Live_, Description_, Approval_Status_, (err, rows) => {
        if (err) {
            console.error("Create Shelter Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(201).json({ success: true, message: "Shelter created successfully", data: { id: Shelter_Id_ } });
    });
});

router.patch('/:shelterId', authMiddleware, requireRole('shelter_admin', 'super_admin'), (req, res) => {
    const Shelter_Id_ = req.params.shelterId;
    // We pass admin_id because the SP should verify ownership for shelter_admin
    const Admin_Id_ = req.user.role === 'super_admin' ? null : req.user.id; 
    
    const Name_ = req.body.name || null;
    const Image_Url_ = req.body.imageUrl || null;
    const Address_ = req.body.address || null;
    const Price_Per_Night_ = req.body.pricePerNight || null;
    const Distance_ = req.body.distance || null;
    const Is_Live_ = req.body.isLive !== undefined ? req.body.isLive : null;
    const Description_ = req.body.description || null;
    const Approval_Status_ = req.user.role === 'super_admin' ? req.body.approvalStatus : null;

    shelterModel.Update_Shelter(Shelter_Id_, Admin_Id_, Name_, Image_Url_, Address_, Price_Per_Night_, Distance_, Is_Live_, Description_, Approval_Status_, (err, rows) => {
        if (err) {
            console.error("Update Shelter Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, message: "Shelter updated successfully" });
    });
});

router.delete('/:shelterId', authMiddleware, requireRole('super_admin'), (req, res) => {
    const Shelter_Id_ = req.params.shelterId;

    shelterModel.Delete_Shelter(Shelter_Id_, (err, rows) => {
        if (err) {
            console.error("Delete Shelter Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, message: "Shelter deleted successfully" });
    });
});

module.exports = router;
