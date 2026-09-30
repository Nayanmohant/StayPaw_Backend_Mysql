const db = require('../config/database');

module.exports = {
    Get_Live_Activities: function(
        Limit_,
        callback
    ) {
        return db.query(
            "CALL Get_Live_Activities(?)",
            [Limit_],
            callback
        );
    },

    Get_Scoped_Activities: function(
        User_Id_,
        Booking_Id_,
        Page_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL Get_Scoped_Activities(?,?,?,?)",
            [User_Id_, Booking_Id_, Page_, Limit_],
            callback
        );
    },

    Get_Booking_Activities: function(
        Booking_Id_,
        User_Id_,
        Page_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL Get_Booking_Activities(?,?,?,?)",
            [Booking_Id_, User_Id_, Page_, Limit_],
            callback
        );
    },

    Create_Activity: function(
        Activity_Id_,
        Booking_Id_,
        Type_,
        Title_,
        Description_,
        Mood_,
        Photo_Url_,
        Time_Label_,
        callback
    ) {
        return db.query(
            "CALL Create_Activity(?,?,?,?,?,?,?,?)",
            [
                Activity_Id_,
                Booking_Id_,
                Type_,
                Title_,
                Description_,
                Mood_,
                Photo_Url_,
                Time_Label_
            ],
            callback
        );
    }
};
