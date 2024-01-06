const pool = require("../database");

async function get_user_role(user_id){
    try{
        let userQuery = await pool.query("SELECT role FROM users WHERE id = $1;", [user_id]);
        return userQuery.rows[0].role;
    }catch(_){
        return "student";
    }
}

module.exports = {get_user_role};