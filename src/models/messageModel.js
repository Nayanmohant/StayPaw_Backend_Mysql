const db = require('../config/database');

module.exports = {
    Get_Global_Messages: function(
        Page_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL Get_Global_Messages(?,?)",
            [Page_, Limit_],
            callback
        );
    },

    Send_Global_Message: function(
        Message_Id_,
        Sender_Id_,
        Content_,
        callback
    ) {
        return db.query(
            "CALL Send_Global_Message(?,?,?)",
            [Message_Id_, Sender_Id_, Content_],
            callback
        );
    },

    Get_Booking_Messages: function(
        Booking_Id_,
        User_Id_,
        Page_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL Get_Booking_Messages(?,?,?,?)",
            [Booking_Id_, User_Id_, Page_, Limit_],
            callback
        );
    },

    Send_Booking_Message: function(
        Message_Id_,
        Booking_Id_,
        Sender_Id_,
        Content_,
        callback
    ) {
        return db.query(
            "CALL Send_Booking_Message(?,?,?,?)",
            [Message_Id_, Booking_Id_, Sender_Id_, Content_],
            callback
        );
    },

    Mark_Booking_Messages_Read: function(
        Booking_Id_,
        User_Id_,
        callback
    ) {
        return db.query(
            "CALL Mark_Booking_Messages_Read(?,?)",
            [Booking_Id_, User_Id_],
            callback
        );
    }
};
