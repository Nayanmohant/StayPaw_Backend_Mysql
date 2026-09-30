const db = require('../config/database');

module.exports = {
    Create_Booking: function(
        Booking_Id_,
        User_Id_,
        Shelter_Id_,
        Start_Date_,
        End_Date_,
        Subtotal_,
        Tax_,
        Service_Fee_,
        Total_Price_,
        callback
    ) {
        return db.query(
            "CALL Create_Booking(?,?,?,?,?,?,?,?,?)",
            [
                Booking_Id_,
                User_Id_,
                Shelter_Id_,
                Start_Date_,
                End_Date_,
                Subtotal_,
                Tax_,
                Service_Fee_,
                Total_Price_
            ],
            callback
        );
    },

    List_Bookings: function(
        User_Id_,
        callback
    ) {
        return db.query(
            "CALL List_Bookings(?)",
            [User_Id_],
            callback
        );
    },

    Get_Booking_By_Id: function(
        Booking_Id_,
        callback
    ) {
        return db.query(
            "CALL Get_Booking_By_Id(?)",
            [Booking_Id_],
            callback
        );
    },

    Update_Booking_Status: function(
        Booking_Id_,
        Status_,
        callback
    ) {
        return db.query(
            "CALL Update_Booking_Status(?,?)",
            [Booking_Id_, Status_],
            callback
        );
    }
};
