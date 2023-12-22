const router = require("express").Router();
const pool = require("../database");
const bcrypt = require("bcrypt");
const generateJWT = require("../utils/generate-jwt");
const validInfo = require("../middleware/valid-info");
const authorize = require("../middleware/authorize");
// const crypto = require('crypto');

router.get("/", (_, res) => {
    res.status(200).send("12/19 Kolta was here.");
});

// Login user
router.post("/login", validInfo, async (req, res) => {
    try {
        let { email, password } = req.body;

        let email_query = await pool.query("SELECT * FROM users WHERE email = $1;", [email]);
        if (email_query.rows.length === 0) {
            return res.status(401).json({ success: false, message: "Böyle bir e-posta bulunmamakta." });
        }

        let valid_password = await bcrypt.compare(password, email_query.rows[0].password);

        if (!valid_password) {
            return res.status(401).json({ success: false, message: "Yanlış e-posta ve şifre kombinasyonu." });
        }

        let token = generateJWT(email_query.rows[0].id);

        res.status(201).json({ success: true, token });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

// Create user
router.post("/register", validInfo, async (req, res) => {
    try {
        let { role, username, email, password } = req.body;
        let errors = [];

        let username_query = await pool.query("SELECT * FROM users WHERE username = $1;", [username]);
        if (username_query.rows.length !== 0) {
            errors.push("Kullanıcı adı zaten alınmış");
        }

        let email_query = await pool.query("SELECT * FROM users WHERE username = $1;", [email]);
        if (email_query.rows.length !== 0) {
            errors.push("E-posta adı zaten alınmış");
        }

        if (errors.length !== 0) {
            return res.status(403).json({ success: false, errors });
        }

        let salt_rounds = 10;
        let salt = await bcrypt.genSalt(salt_rounds);
        let bcrypt_password = await bcrypt.hash(password, salt);

        let new_user = await pool.query("INSERT INTO users(role, username, email, password) VALUES($1, $2, $3, $4) RETURNING *;", [role, username, email, bcrypt_password]);

        const token = generateJWT(new_user.rows[0].id);
        res.status(201).json({ success: true, token });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.post("/create-exam", async (req, res) => {
    async function createExam(id) {
        const client = await pool.connect();

        // Frontend ile entegre ederken dummy uuid'yi id ile değiştir ve middleware kısmına authorize yaz.

        try {
            const { questions, class_name, title, description, start_time, end_time, allow_jumping, shuffle_questions, shuffle_options } = req.body;

            // Begin a transaction
            await client.query('BEGIN');

            let dummy_uuid = "8db52807-127f-4b65-a924-d9b6f851c870";
            let exam_id_query = await client.query('INSERT INTO exam(teacher_id, class_name, title, description, start_time, end_time, allow_jumping, shuffle_questions, shuffle_options) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;', [dummy_uuid, class_name, title, description, start_time, end_time, allow_jumping, shuffle_questions, shuffle_options]);
            let exam_id = exam_id_query.rows[0].id;

            for (let q = 0; q < questions.length; ++q) {
                await client.query("INSERT INTO question(index, exam_id, text, score) VALUES($1, $2, $3, $4)", [q, exam_id, questions[q].text, questions[q].score]);
                for (let o = 0; o < questions[q].options.length; ++o) {
                    await client.query("INSERT INTO option(exam_id, index, question_index, text, correct_answer) VALUES($1, $2, $3, $4, $5)", [exam_id, o, q, questions[q].options[o].text, questions[q].options[o].isCorrect]);
                }
            }

            // Commit the transaction if all queries were successful
            await client.query('COMMIT');
            return exam_id;
        } catch (error) {
            // If an error occurs, roll back the transaction to maintain data consistency
            await client.query('ROLLBACK');
            console.error(error.message);
            res.status(500).send({ success: false, message: "Sunucu hatası." });
        } finally {
            // Release the client back to the pool
            client.release();
        }
    };

    createExam(req.user)
        .then((exam_id) => {
            res.status(200).json({ success: true, message: `Sınav başarı ile oluşturuldu. Link: ${exam_id}` });
        })
        .catch((error) => {
            console.error('Sınavı oluştururken hata oluştu:', error);
        });
});

// VERIFY AUTHENTIC TOKEN
router.get("/verify", authorize, async (req, res) => {
    try {
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send({ success: true, message: "Sunucu hatası." });
    }
});

module.exports = router;