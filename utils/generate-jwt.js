const jwt = require("jsonwebtoken");
require("dotenv").config();

function generateJWT (id) {
    const payload = {
        user: id
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: "7 days"});
}

module.exports = generateJWT;