const db = require('../config/database');

module.exports = {
    Create_Pet: function(
        Pet_Id_,
        Owner_Id_,
        Name_,
        Breed_,
        Age_,
        Weight_,
        Photo_Url_,
        callback
    ) {
        return db.query(
            "CALL Create_Pet(?,?,?,?,?,?,?)",
            [Pet_Id_, Owner_Id_, Name_, Breed_, Age_, Weight_, Photo_Url_],
            callback
        );
    },

    List_Pets: function(
        Owner_Id_,
        Page_,
        Limit_,
        callback
    ) {
        return db.query(
            "CALL List_Pets(?,?,?)",
            [Owner_Id_, Page_, Limit_],
            callback
        );
    },

    Get_Pet_By_Id: function(
        Pet_Id_,
        callback
    ) {
        return db.query(
            "CALL Get_Pet_By_Id(?)",
            [Pet_Id_],
            callback
        );
    },

    Update_Pet: function(
        Pet_Id_,
        Owner_Id_,
        Name_,
        Breed_,
        Age_,
        Weight_,
        Photo_Url_,
        callback
    ) {
        return db.query(
            "CALL Update_Pet(?,?,?,?,?,?,?)",
            [Pet_Id_, Owner_Id_, Name_, Breed_, Age_, Weight_, Photo_Url_],
            callback
        );
    },

    Delete_Pet: function(
        Pet_Id_,
        Owner_Id_,
        callback
    ) {
        return db.query(
            "CALL Delete_Pet(?,?)",
            [Pet_Id_, Owner_Id_],
            callback
        );
    }
};
