const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = async (req, res, next) => {
    try {
        let jwt_token = req.header("token");

        if(!jwt_token) {
            return res.status(403).send({ success: false, message: "Yetki yok." });
        }

        const payload = jwt.verify(jwt_token, process.env.JWTSECRET);

        req.user = payload.user;
        
        next();
    } catch (error) {
        console.error(error.message);
        return res.status(403).send({ success: false, message: "Yetki yok ya da sunucu hatası." });
    }
}