const fs = require('fs');
const path = require('path');

console.log('Final image test: Checking if GraphQL files exist in the final Docker image');
console.log('__dirname:', __dirname);
console.log('Current working directory:', process.cwd());

// Check the dist directory specifically
const distGraphqlPath = path.join(__dirname, 'dist/graphql/schema');
console.log('Looking for dist GraphQL files in:', distGraphqlPath);

try {
  if (fs.existsSync(distGraphqlPath)) {
    const files = fs.readdirSync(distGraphqlPath);
    console.log('Found dist GraphQL files:', files);
    
    // Check for specific .graphql files
    const graphqlFiles = files.filter(file => file.endsWith('.graphql'));
    console.log('Found .graphql files:', graphqlFiles);
    
    const coreFile = path.join(distGraphqlPath, 'core.graphql');
    console.log('Looking for dist core.graphql at:', coreFile);
    
    if (fs.existsSync(coreFile)) {
      console.log('dist core.graphql exists!');
      const content = fs.readFileSync(coreFile, 'utf8');
      console.log('dist core.graphql content length:', content.length);
    } else {
      console.log('dist core.graphql does not exist');
    }
  } else {
    console.log('dist GraphQL directory does not exist');
  }
} catch (error) {
  console.error('Error reading dist GraphQL directory:', error.message);
  console.error('Error stack:', error.stack);
}

// Also check if we can read the file directly
try {
  const directPath = '/app/dist/graphql/schema/core.graphql';
  console.log('Trying to read file directly at:', directPath);
  if (fs.existsSync(directPath)) {
    console.log('File exists at direct path');
    const content = fs.readFileSync(directPath, 'utf8');
    console.log('Direct file content length:', content.length);
  } else {
    console.log('File does not exist at direct path');
  }
} catch (error) {
  console.error('Error reading file directly:', error.message);
  console.error('Error stack:', error.stack);
}
