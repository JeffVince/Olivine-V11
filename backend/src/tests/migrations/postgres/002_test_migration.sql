-- Test PostgreSQL migration file 2
CREATE TABLE IF NOT EXISTS test_table2 (
    id SERIAL PRIMARY KEY,
    description TEXT
);
