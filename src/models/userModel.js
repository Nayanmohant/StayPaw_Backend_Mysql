const db = require('../config/database');

module.exports = {
  Register_User: function(
    User_Id_,
    Name_,
    Email_,
    Password_Hash_,
    Provider_Id_,
    callback
  ) {
    return db.query(
      "CALL SP_RegisterUser(?,?,?,?,?)",
      [User_Id_, Name_, Email_, Password_Hash_, Provider_Id_],
      callback
    );
  },

  Get_User_By_Email: function(
    Email_,
    callback
  ) {
    return db.query(
      "CALL SP_GetUserByEmail(?)",
      [Email_],
      callback
    );
  },

  Get_User_By_Id: function(
    User_Id_,
    callback
  ) {
    return db.query(
      "CALL SP_GetUserById(?)",
      [User_Id_],
      callback
    );
  },

  Check_Email_Exists: function(
    Email_,
    callback
  ) {
    return db.query(
      "SELECT id FROM users WHERE email = ?",
      [Email_],
      callback
    );
  }
};
