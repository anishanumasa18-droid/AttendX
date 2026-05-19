CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    roll_number TEXT,
    branch TEXT,
    section TEXT,
    semester INT,
    face_embedding TEXT
);

CREATE TABLE faculty (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT,
    course_code TEXT,
    course_name TEXT,
    topic TEXT,
    batch TEXT,
    session_type TEXT,
    semester TEXT,
    branch TEXT,
    section TEXT
);