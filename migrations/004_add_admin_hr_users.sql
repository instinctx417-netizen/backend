-- =====================================================
-- ADD ADMIN AND HR USER TYPES
-- Creates 4 static admin users and enables HR user type
-- =====================================================

-- Update user_type constraint to include 'admin' and 'hr'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check 
  CHECK (user_type IN ('client', 'candidate', 'admin', 'hr'));

-- Create 4 static admin users
-- Password for all: "Admin@123" (hashed with bcrypt)
-- In production, these should be changed immediately
INSERT INTO users (email, password_hash, first_name, last_name, user_type, phone, created_at, updated_at)
VALUES 
  ('admin1@instinctxai.com', '$2b$10$8vX5Bfn0MIdD6qiYPe.FR.BF7zs5HFlHeycWFCC.KGGUkxErtlhlO', 'Admin', 'One', 'admin', '+1-555-0101', NOW(), NOW()),
  ('admin2@instinctxai.com', '$2b$10$6EfbRfRiKOx/9H7PbcZZiO9TxXGu894cX4JPEjHStCfmmgyaR5WIO', 'Admin', 'Two', 'admin', '+1-555-0102', NOW(), NOW()),
  ('admin3@instinctxai.com', '$2b$10$4QM4FNs2Uf3.p2rU14iNAuArRj4.AZcTBglrZa0c60gGrXFOeW1K6', 'Admin', 'Three', 'admin', '+1-555-0103', NOW(), NOW()),
  ('admin4@instinctxai.com', '$2b$10$mDAjUNjsdpukcyI5pKDu5eClwGnoFnfTMxYtuRN4TB2B2JHHCZJBe', 'Admin', 'Four', 'admin', '+1-555-0104', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
