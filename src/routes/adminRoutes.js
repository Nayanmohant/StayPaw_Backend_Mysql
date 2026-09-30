const express = require('express');
const router = express.Router();

const adminModel = require('../models/adminModel');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.patch(
  '/shelters/:shelterId/review',
  authMiddleware,
  requireRole('shelter_admin', 'super_admin'),
  (req, res) => {
      const Shelter_Id_ = req.params.shelterId;
      const Approval_Status_ = req.body.approvalStatus || '';

      if (!Approval_Status_ || !['approved', 'rejected', 'pending'].includes(Approval_Status_)) {
          return res.status(400).json({
              success: false,
              message: "approvalStatus must be one of: 'approved', 'rejected', 'pending'"
          });
      }

      adminModel.Review_Shelter(Shelter_Id_, Approval_Status_, (err, rows) => {
          if (err) {
              console.error("Review Shelter Database Error:", err);
              return res.status(500).json({ success: false, message: "Database error" });
          }
          return res.status(200).json({ success: true, message: `Shelter status successfully updated to '${Approval_Status_}'` });
      });
  }
);

router.patch(
  '/users/:userId/role',
  authMiddleware,
  requireRole('super_admin'),
  (req, res) => {
      const User_Id_ = req.params.userId;
      const Role_ = req.body.role || '';

      if (!Role_) {
          return res.status(400).json({ success: false, message: 'Role is required' });
      }

      adminModel.Assign_User_Role(User_Id_, Role_, (err, rows) => {
          if (err) {
              console.error("Assign User Role Database Error:", err);
              return res.status(500).json({ success: false, message: "Database error" });
          }
          return res.status(200).json({ success: true, message: `User role successfully updated to '${Role_}'` });
      });
  }
);

module.exports = router;
