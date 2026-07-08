-- Seed: one user with duplicate email to test create/update duplicate handling
INSERT INTO users (email, name) VALUES ('dup@example.org', 'Duplicate User');
