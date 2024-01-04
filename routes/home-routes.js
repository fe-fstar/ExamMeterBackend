const router = require("express").Router();
const pool = require("../database");
const bcrypt = require("bcrypt");
const generateJWT = require("../utils/generate-jwt");
const validInfo = require("../middleware/valid-info");
const authorize = require("../middleware/authorize");

function compareOptions(obj1, obj2) {
    if (obj1.question_index < obj2.question_index) {
        return -1;
    } else if (obj1.question_index > obj2.question_index) {
        return 1;
    } else {
        if (obj1.index < obj2.index) {
            return -1;
        } else if (obj1.index > obj2.index) {
            return 1;
        } else {
            return 0;
        }
    }
}

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
            return res.status(401).json({ success: false, message: "Yanlış e-posta veya şifre kombinasyonu." });
        }

        let token = generateJWT(email_query.rows[0].id);

        email_query = await pool.query("SELECT * FROM users WHERE email = $1;", [email]);

        res.status(201).json({ success: true, token, message: "Giriş başarılı - ana sayfaya yönlendiriliyorsunuz.", role: email_query.rows[0].role });
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

// Create an exam
router.post("/exam", authorize, async (req, res) => {
    async function createExam(id) {
        const client = await pool.connect();

        let user_id = req.user;

        try {
            const { questions, className, title, description, startTime, endTime, allowJumping, shuffleQuestions, shuffleOptions } = req.body;

            // Begin a transaction
            await client.query('BEGIN');

            let exam_id_query = await client.query('INSERT INTO exam(teacher_id, class_name, title, description, start_time, end_time, allow_jumping, shuffle_questions, shuffle_options) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;', [user_id, className, title, description, startTime, endTime, allowJumping, shuffleQuestions, shuffleOptions]);
            let exam_id = exam_id_query.rows[0].id;

            for (let q = 0; q < questions.length; ++q) {
                await client.query("INSERT INTO question(index, exam_id, text, score) VALUES($1, $2, $3, $4)", [q, exam_id, questions[q].text, questions[q].score]);
                for (let o = 0; o < questions[q].options.length; ++o) {
                    await client.query("INSERT INTO option(exam_id, index, question_index, text, correct_answer) VALUES($1, $2, $3, $4, $5)", [exam_id, o, q, questions[q].options[o].text, questions[q].options[o].correctAnswer]);
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
            res.status(200).json({ success: true, message: `Sınav başarı ile oluşturuldu.`, id: `${exam_id}` });
        })
        .catch((error) => {
            console.error('Sınavı oluştururken hata oluştu:', error);
        });
});

// Delete an exam
router.delete("/exam", authorize, async (req, res) => {
    async function deleteExam(id) {
        const client = await pool.connect();

        let teacher_id = req.user;

        try {
            const { id, startsAt } = req.body;

            if (Date.now() >= new Date(startsAt)) {
                return res.status(401).json({ success: false, message: "Sınav başladıktan sonra sınavı silemezsiniz." });
            }

            // Begin a transaction
            await client.query('BEGIN');

            await client.query("DELETE FROM option WHERE exam_id = $1", [id]);
            await client.query("DELETE FROM question WHERE exam_id = $1", [id]);
            await client.query("DELETE FROM exam WHERE id = $1", [id]);

            await client.query('COMMIT');
        } catch (error) {
            // If an error occurs, roll back the transaction to maintain data consistency
            await client.query('ROLLBACK');
            console.error(error.message);
            return res.status(500).send({ success: false, message: "Sunucu hatası." });
        } finally {
            // Release the client back to the pool
            client.release();
        }
    };

    deleteExam(req.user)
        .then((exam_id) => {
            return res.status(200).json({ success: true, message: `Sınav başarı ile silindi.` });
        })
        .catch((error) => {
            console.error('Sınavı oluştururken hata oluştu:', error);
        });
});

router.put("/exam", authorize, async (req, res) => {
    async function updateExam() {
        const client = await pool.connect();
        try {
            console.log(req.body);
            const { id, questions, className, title, description, startTime, endTime, allowJumping, shuffleQuestions, shuffleOptions } = req.body;

            // Check if teacher is allowed to update the exam (they might not be able to because the exam might have already started
            let original_start_time = await client.query("SELECT start_time FROM exam WHERE id = $1;", [id]);
            if (Date.now() >= new Date(original_start_time.rows[0].start_time)) {
                return res.status(401).json({ success: false, message: "Sınav başladıktan sonra sınavı güncelleyemezsiniz." });
            }

            // Delete every old question and option of exam to add new ones
            // Begin a transaction
            await client.query('BEGIN');

            await client.query("DELETE FROM option WHERE exam_id = $1", [id]);
            await client.query("DELETE FROM question WHERE exam_id = $1", [id]);

            // Update start time, end time, jumping allowed, shuffle options, shuffle questions, title, class, and description of exam.
            await client.query("UPDATE exam SET class_name = $1, title = $2, description = $3, start_time = $4, end_time = $5, allow_jumping = $6, shuffle_questions = $7, shuffle_options = $8 WHERE id = $9;", [className, title, description, startTime, endTime, allowJumping, shuffleQuestions, shuffleOptions, id]);

            // Add new questions and options.
            for (let q = 0; q < questions.length; ++q) {
                await client.query("INSERT INTO question(index, exam_id, text, score) VALUES($1, $2, $3, $4)", [q, id, questions[q].text, questions[q].score]);
                for (let o = 0; o < questions[q].options.length; ++o) {
                    await client.query("INSERT INTO option(exam_id, index, question_index, text, correct_answer) VALUES($1, $2, $3, $4, $5)", [id, o, q, questions[q].options[o].text, questions[q].options[o].correctAnswer]);
                }
            }
            // Commit the transaction if all queries were successful
            await client.query('COMMIT');
        } catch (error) {
            // If an error occurs, roll back the transaction to maintain data consistency
            await client.query('ROLLBACK');
            console.error(error.message);
            return res.status(500).send({ success: false, message: "Sunucu hatası." });
        } finally {
            // Release the client back to the pool
            client.release();
        }
    }

    updateExam()
        .then(() => {
            return res.status(200).json({ success: true, message: `Sınav başarı ile güncellendi.` });
        })
        .catch((error) => {
            console.error('Sınavı oluştururken hata oluştu:', error);
        });
});

// Retrieve a single exam
router.get("/exam/:exam_id", authorize, async (req, res) => {
    try {
        let user_id = req.user;
        let exam_id = req.params["exam_id"];
        let is_completed = false;

        await pool.query("SELECT * FROM takes WHERE student_id = $1 AND exam_id = $2", [user_id, exam_id]).then((results)=>{
            if(results.rows.length > 0){
                is_completed = true;
            }
        });

        if(is_completed){
            return res.status(200).json({ success: false, message: "Bu sınavı zaten tamamladınız." });
        }

        let exam_query;
        let exam_questions_query;
        let exam_options_query;

        await Promise.all([pool.query("SELECT * FROM exam WHERE id = $1", [exam_id]),
        pool.query("SELECT * FROM question WHERE exam_id = $1", [exam_id]),
        pool.query("SELECT * FROM option WHERE exam_id = $1", [exam_id])]).then((results) => {
            exam_query = results[0];
            exam_questions_query = results[1];
            exam_options_query = results[2];
        });

        let exam = exam_query.rows[0];

        if(Date.now() > exam.end_time){
            return res.status(200).json({ success: false, message: "Bu sınavın süresi doldu." });
        }

        let exam_questions = exam_questions_query.rows;
        let exam_options = exam_options_query.rows;

        let newExam = {
            id: exam.id,
            teacherId: exam.teacher_id,
            startTime: exam.start_time,
            endTime: exam.end_time,
            allowJumping: exam.allow_jumping,
            shuffleQuestions: exam.shuffle_questions,
            shuffleOptions: exam.shuffle_options,
            className: exam.class_name,
            description: exam.description,
            title: exam.title,
        };

        exam = newExam;

        // Shuffle questions if enabled; otherwise, sort them.
        if (exam.shuffleQuestions) {
            exam.questions = exam_questions.sort(() => Math.random() - 0.5);
        } else {
            exam.questions = exam_questions.sort(function (a, b) { return a.index - b.index });
        }

        for (let question of exam.questions) {
            question.options = [];
        }

        // Shuffle options if enabled; otherwise, sort them.
        if (exam.shuffleOptions) {
            exam_options = exam_options.sort(() => Math.random() - 0.5);
        } else {
            exam_options = exam_options.sort(compareOptions);
        }

        exam_options.forEach((option) => {
            let foundHere = exam.questions.findIndex((obj) => obj.index === option.question_index);
            exam.questions[foundHere].options.push(option);
        });

        return res.status(200).json({ success: true, exam });
    } catch (error) {
        console.error("Sınav bilgisini toplarken hata oluştu:", error.message);
        return res.status(500).send({ success: false, message: "Sunucu hatası." });
    }
});

// Get all exams of a student or a teacher
router.get("/exam", authorize, async (req, res) => {
    try {
        let user_id = req.user;

        let user_query = await pool.query("SELECT role FROM users WHERE id = $1;", [user_id]);

        let exam_query;

        if (user_query.rows[0].role === "student") {
            exam_query = await pool.query("SELECT exam.id, exam.class_name, exam.title, exam.start_time, exam.end_time, takes.grade FROM exam LEFT JOIN takes ON exam.id = takes.exam_id WHERE exam.teacher_id = $1 OR takes.student_id = $1;", [user_id]);
        } else if (user_query.rows[0].role === "teacher") {
            exam_query = await pool.query("SELECT id, start_time, title, class_name FROM exam WHERE teacher_id = $1;", [user_id]);
        }

        let parsedExams = [];

        for (let exam of exam_query.rows) {
            let parsedExam = {
                startTime: exam.start_time,
                title: exam.title,
                className: exam.class_name,
                id: exam.id,
                grade: exam.grade
            };

            parsedExams.push(parsedExam);
        }

        return res.status(200).json({ success: true, exams: parsedExams });
    } catch (error) {
        console.error("Sınav listesini getirirken hata oluştu:", error.message);
        return res.status(500).send({ success: false, message: "Sunucu hatası." });
    }
});

// Get questions of exams with same class_name
router.post("/question", async (req, res) => {
    try {
        let class_name = req.body.class_name;
        let questions;
        let options;
        await Promise.all([pool.query("SELECT q.* FROM question q JOIN exam e ON q.exam_id = e.id WHERE e.class_name = $1;", [class_name]),
                            pool.query("SELECT o.* FROM option o JOIN exam e ON o.exam_id = e.id WHERE e.class_name = $1;", [class_name])])
                            .then((results) => {
           questions = results[0].rows;
           options = results[1].rows; 
        });

        let parsedQuestions = [];

        questions = questions.sort(function (a, b) { return a.index - b.index });
        options = options.sort(compareOptions);

        for (let q = 0; q < questions.length; ++q) {
            let questionObj = {
                index: questions[q].index,
                examId: questions[q].exam_id,
                text: questions[q].text,
                correctCount: questions[q].correct_count,
                incorrectCount: questions[q].incorrect_count,
                unansweredCount: questions[q].unanswered_count,
                correctRatio: questions[q].correct_ratio,
                discriminationRatio: questions[q].discrimination_ratio,
                options: []
            };

            for(let o = 0; o < options.length; ++o) {
                if(questions[q].index !== options[o].question_index || questions[q].exam_id !== options[o].exam_id) {
                    continue;
                } else {
                    let optionObj = {
                        index: options[o].index,
                        examId: options[o].exam_id,
                        questionIndex: options[o].question_index,
                        text: options[o].text,
                        correctAnswer: options[o].correct_answer,
                        frequency: options[o].frequency,
                        frequencyRatio: options[o].frequency_ratio,
                        discriminationRatio: options[o].discrimination_ratio
                    };

                    questionObj.options.push(optionObj);
                }
            }

            parsedQuestions.push(questionObj);
        }

        return res.status(200).json({ success: true, message: "Sorular başarı ile getirildi.", questions: parsedQuestions });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.post("/submit_exam", authorize, async (req, res) => {
    let student_id = req.user;
    let { id, grade, answers, topicRelevanceScore, methodRelevanceScore, difficultyScore, additionalNote } = req.body;

    try {
        await pool.query("INSERT INTO takes(exam_id, student_id, answers, grade, difficulty_score, topic_relevance_score, method_relevance_score, additional_note) VALUES($1, $2, $3, $4, $5, $6, $7, $8);", [id, student_id, answers, grade, difficultyScore, topicRelevanceScore, methodRelevanceScore, additionalNote]);
        return res.status(201).json({ success: true, message: "Sınavınız başarı ile gönderilmiştir. Ana sayfaya yönlendiriliyorsunuz." });
    } catch (error) {
        res.status(500).send({ success: false, message: "Sunucu hatası." });
    }
});

router.get("/get_user_information", authorize, async (req, res) => {
    try {
        let userId = req.user;

        let userQuery = await pool.query("SELECT username, email, role FROM users WHERE id = $1;", [userId]);

        res.status(200).json({ success: true, user: userQuery.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(500).send({ success: false, message: "Sunucu hatası." });
    }
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