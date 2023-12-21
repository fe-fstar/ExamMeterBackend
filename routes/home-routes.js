const router = require("express").Router();

router.get("/", (_, res) => {
    res.status(200).send("12/19 Kolta was here.");
});

module.exports = router;