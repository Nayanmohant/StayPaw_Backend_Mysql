const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const petModel = require('../models/petModel');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', (req, res) => {
    const Pet_Id_ = uuidv4();
    const Owner_Id_ = req.user.id;
    const Name_ = req.body.name || '';
    const Breed_ = req.body.breed || null;
    const Age_ = req.body.age || null;
    const Weight_ = req.body.weight || null;
    const Photo_Url_ = req.body.photoUrl || null;

    if (!Name_) {
        return res.status(400).json({
            success: false,
            message: "Missing required pet name"
        });
    }

    petModel.Create_Pet(
        Pet_Id_, Owner_Id_, Name_, Breed_, Age_, Weight_, Photo_Url_,
        (err, rows) => {
            if (err) {
                console.error("Create Pet Database Error:", err);
                return res.status(500).json({ success: false, message: "Database error" });
            }
            return res.status(201).json({ success: true, message: "Pet created", data: { id: Pet_Id_ } });
        }
    );
});

router.get('/', (req, res) => {
    const Owner_Id_ = req.query.ownerId || req.user.id;
    const Page_ = req.query.page || 1;
    const Limit_ = req.query.limit || 10;

    petModel.List_Pets(Owner_Id_, Page_, Limit_, (err, rows) => {
        if (err) {
            console.error("List Pets Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, data: rows[0] || [] });
    });
});

router.get('/:petId', (req, res) => {
    const Pet_Id_ = req.params.petId;

    petModel.Get_Pet_By_Id(Pet_Id_, (err, rows) => {
        if (err) {
            console.error("Get Pet Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, data: (rows[0] && rows[0].length > 0) ? rows[0][0] : null });
    });
});

router.patch('/:petId', (req, res) => {
    const Pet_Id_ = req.params.petId;
    const Owner_Id_ = req.user.id;
    const Name_ = req.body.name || null;
    const Breed_ = req.body.breed || null;
    const Age_ = req.body.age || null;
    const Weight_ = req.body.weight || null;
    const Photo_Url_ = req.body.photoUrl || null;

    petModel.Update_Pet(Pet_Id_, Owner_Id_, Name_, Breed_, Age_, Weight_, Photo_Url_, (err, rows) => {
        if (err) {
            console.error("Update Pet Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, message: "Pet updated successfully" });
    });
});

router.delete('/:petId', (req, res) => {
    const Pet_Id_ = req.params.petId;
    const Owner_Id_ = req.user.id;

    petModel.Delete_Pet(Pet_Id_, Owner_Id_, (err, rows) => {
        if (err) {
            console.error("Delete Pet Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        return res.status(200).json({ success: true, message: "Pet deleted successfully" });
    });
});

module.exports = router;
