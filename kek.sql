-- Aşağıdaki kodu tamamen PSQL shell'e kopyalayıp yapıştırmak yeterli

SELECT 'CREATE DATABASE exammeter'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'exammeter')\gexec

\c exammeter;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    role VARCHAR(255),
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS exam (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    teacher_id UUID,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    allow_jumping BOOLEAN,
    shuffle_questions BOOLEAN,
    shuffle_options BOOLEAN,
    class_name VARCHAR(255),
    description VARCHAR(255),
    title VARCHAR(255);
);

CREATE TABLE IF NOT EXISTS feedback (
    student_id UUID,
    exam_id UUID,
    difficulty_score INTEGER,
    topic_relevance_score INTEGER,
    method_relevance_score INTEGER,
    additional_note TEXT,
    PRIMARY KEY (student_id, exam_id)
);

CREATE TABLE IF NOT EXISTS question (
    index SERIAL,
    exam_id UUID,
    text TEXT,
    score INTEGER,
    PRIMARY KEY (index, exam_id)
);

CREATE TABLE IF NOT EXISTS option (
    index SERIAL,
    question_index INTEGER,
    text TEXT,
    correct_answer BOOLEAN,
    PRIMARY KEY (index, question_index)
);

CREATE TABLE IF NOT EXISTS takes (
    exam_id UUID,
    student_id UUID,
    grade INTEGER,
    PRIMARY KEY (exam_id, student_id)
);

-- 190315031@ogr.cbu.edu.tr | 12312312331
-- funda-cavusyilar@cbu.edu.tr | Springeu.4