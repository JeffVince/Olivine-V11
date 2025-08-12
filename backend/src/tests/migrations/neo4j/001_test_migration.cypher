// Test Neo4j migration file 1
CREATE CONSTRAINT ON (file:File) ASSERT file.id IS UNIQUE;
