module.exports = (req, res, next) => {
    function validEmail(userEmail) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(userEmail);
    }

    if (req.path === "/login") {
        const { email, password } = req.body;
        if (![email, password].every(Boolean)) {
            return res.status(401).json({ success: false, message: "Lütfen bütün alanları doldurun." });
        }
    } else if (req.path === "/register") {
        const { username, email, password } = req.body;
        if (!validEmail(email)) {
            return res.status(401).json({ success: false, message: "Bu geçerli bir e-posta değil." });
        }
        if (![username, email, password].every(Boolean)) {
            return res.status(401).json({ success: false, message: "Lütfen bütün alanları doldurun." });
        }
    }

    next();
};