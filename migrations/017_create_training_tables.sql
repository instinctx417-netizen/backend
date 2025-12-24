-- Training Videos table
CREATE TABLE IF NOT EXISTS training_videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  youtube_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_videos_display_order ON training_videos(display_order);
CREATE INDEX idx_training_videos_created_by ON training_videos(created_by_user_id);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  version INTEGER DEFAULT 1,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quizzes_created_by ON quizzes(created_by_user_id);
CREATE INDEX idx_quizzes_version ON quizzes(version);

-- Quiz Answers table (staff answers to quizzes)
CREATE TABLE IF NOT EXISTS quiz_answers (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_answer CHAR(1) NOT NULL CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  quiz_version INTEGER NOT NULL, -- Store the version of quiz when answered
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(quiz_id, user_id, quiz_version) -- One answer per user per quiz version
);

CREATE INDEX idx_quiz_answers_quiz_id ON quiz_answers(quiz_id);
CREATE INDEX idx_quiz_answers_user_id ON quiz_answers(user_id);
CREATE INDEX idx_quiz_answers_quiz_version ON quiz_answers(quiz_version);

-- Onboarding Requirements table (admin defines what files staff should upload)
CREATE TABLE IF NOT EXISTS onboarding_requirements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_onboarding_requirements_display_order ON onboarding_requirements(display_order);
CREATE INDEX idx_onboarding_requirements_created_by ON onboarding_requirements(created_by_user_id);

-- Onboarding Submissions table (staff uploads)
CREATE TABLE IF NOT EXISTS onboarding_submissions (
  id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES onboarding_requirements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requirement_id, user_id) -- One submission per requirement per user
);

CREATE INDEX idx_onboarding_submissions_requirement_id ON onboarding_submissions(requirement_id);
CREATE INDEX idx_onboarding_submissions_user_id ON onboarding_submissions(user_id);

