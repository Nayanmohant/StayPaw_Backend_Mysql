const db = require('../config/database');

module.exports = {
    List_Shelters: function(
        Search_,
        Query_,
        Is_Live_,
        Min_Rating_,
        Max_Price_,
        Sort_By_,
        Approval_Status_,
        Page_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL List_Shelters(?,?,?,?,?,?,?,?,?)",
            [Search_, Query_, Is_Live_, Min_Rating_, Max_Price_, Sort_By_, Approval_Status_, Page_, Limit_],
            callback
        );
    },

    Get_Shelter_By_Id: function(
        Shelter_Id_,
        callback
    ) {
        return db.query(
            "CALL Get_Shelter_By_Id(?)",
            [Shelter_Id_],
            callback
        );
    },

    Get_Shelter_Reviews: function(
        Shelter_Id_,
        Page_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL Get_Shelter_Reviews(?,?,?)",
            [Shelter_Id_, Page_, Limit_],
            callback
        );
    },

    Add_Shelter_Review: function(
        Review_Id_,
        Shelter_Id_,
        User_Id_,
        Rating_,
        Comment_,
        callback
    ) {
        return db.query(
            "CALL Add_Shelter_Review(?,?,?,?,?)",
            [Review_Id_, Shelter_Id_, User_Id_, Rating_, Comment_],
            callback
        );
    },

    Check_Availability: function(
        Shelter_Id_,
        Start_Date_,
        End_Date_,
        callback
    ) {
        return db.query(
            "CALL Check_Availability(?,?,?)",
            [Shelter_Id_, Start_Date_, End_Date_],
            callback
        );
    },

    Get_Shelter_Activities: function(
        Shelter_Id_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL Get_Shelter_Activities(?,?)",
            [Shelter_Id_, Limit_],
            callback
        );
    },

    Create_Shelter: function(
        Shelter_Id_,
        Admin_Id_,
        Name_,
        Image_Url_,
        Address_,
        Price_Per_Night_,
        Distance_,
        Is_Live_,
        Description_,
        Approval_Status_,
        callback
    ) {
        return db.query(
            "CALL Create_Shelter(?,?,?,?,?,?,?,?,?,?)",
            [Shelter_Id_, Admin_Id_, Name_, Image_Url_, Address_, Price_Per_Night_, Distance_, Is_Live_, Description_, Approval_Status_],
            callback
        );
    },

    Update_Shelter: function(
        Shelter_Id_,
        Admin_Id_,
        Name_,
        Image_Url_,
        Address_,
        Price_Per_Night_,
        Distance_,
        Is_Live_,
        Description_,
        Approval_Status_,
        callback
    ) {
        return db.query(
            "CALL Update_Shelter(?,?,?,?,?,?,?,?,?,?)",
            [Shelter_Id_, Admin_Id_, Name_, Image_Url_, Address_, Price_Per_Night_, Distance_, Is_Live_, Description_, Approval_Status_],
            callback
        );
    },

    Delete_Shelter: function(
        Shelter_Id_,
        callback
    ) {
        return db.query(
            "CALL Delete_Shelter(?)",
            [Shelter_Id_],
            callback
        );
    }
};
