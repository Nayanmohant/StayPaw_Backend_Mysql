const db = require('../config/database');

module.exports = {
    Review_Shelter: function(
        Shelter_Id_,
        Approval_Status_,
        callback
    ) {
        return db.query(
            "CALL Review_Shelter(?,?)",
            [Shelter_Id_, Approval_Status_],
            callback
        );
    },

    Assign_User_Role: function(
        User_Id_,
        Role_,
        callback
    ) {
        return db.query(
            "CALL Assign_User_Role(?,?)",
            [User_Id_, Role_],
            callback
        );
    }
};
