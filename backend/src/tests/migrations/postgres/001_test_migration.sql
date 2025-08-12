-- Test PostgreSQL migration file 1
CREATE TABLE IF NOT EXISTS test_table1 (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
