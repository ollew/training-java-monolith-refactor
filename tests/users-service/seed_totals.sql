-- Seed data for totals test

-- Create a user
INSERT INTO users (email, name) VALUES ('u1@example.org', 'User One');

-- Create a customer
INSERT INTO customers (name, email, address, created_at) VALUES ('Acme Corp', 'acme@example.org', '123 Road', CURRENT_TIMESTAMP);

-- Create billing categories
INSERT INTO billing_categories (name, description, hourly_rate) VALUES ('Development', 'Dev work', 100.00);
INSERT INTO billing_categories (name, description, hourly_rate) VALUES ('Consulting', 'Consult work', 150.00);

-- Add two billable hours rows for the user using subselects to reference generated ids
INSERT INTO billable_hours (customer_id, user_id, category_id, hours, note, date_logged, created_at)
VALUES (
  (SELECT id FROM customers WHERE name='Acme Corp'),
  (SELECT id FROM users WHERE email='u1@example.org'),
  (SELECT id FROM billing_categories WHERE name='Development'),
  2.50,
  'Feature A',
  CURRENT_DATE,
  CURRENT_TIMESTAMP
);

INSERT INTO billable_hours (customer_id, user_id, category_id, hours, note, date_logged, created_at)
VALUES (
  (SELECT id FROM customers WHERE name='Acme Corp'),
  (SELECT id FROM users WHERE email='u1@example.org'),
  (SELECT id FROM billing_categories WHERE name='Consulting'),
  1.25,
  'Consult session',
  CURRENT_DATE,
  CURRENT_TIMESTAMP
);
