const fs = require('fs');
const path = require('path');

console.log('__dirname:', __dirname);
console.log('Current working directory:', process.cwd());

// Check if we're in the dist directory (after build)
const isDist = __dirname.includes('/dist/');
console.log('Is in dist directory:', isDist);

if (isDist) {
  // We're in the dist directory, so check for files relative to this location
  const graphqlPath = path.join(__dirname, 'graphql/schema');
  console.log('Looking for GraphQL files in:', graphqlPath);
  
  try {
    if (fs.existsSync(graphqlPath)) {
      const files = fs.readdirSync(graphqlPath);
      console.log('Found GraphQL files:', files);
      
      const coreFile = path.join(graphqlPath, 'core.graphql');
      console.log('Looking for core.graphql at:', coreFile);
      
      if (fs.existsSync(coreFile)) {
        console.log('core.graphql exists!');
        const content = fs.readFileSync(coreFile, 'utf8');
        console.log('core.graphql content length:', content.length);
      } else {
        console.log('core.graphql does not exist');
      }
    } else {
      console.log('GraphQL directory does not exist');
    }
  } catch (error) {
    console.error('Error reading GraphQL directory:', error.message);
  }
} else {
  // We're in the src directory, so check the dist directory
  const distGraphqlPath = path.join(__dirname, 'dist/graphql/schema');
  console.log('Looking for dist GraphQL files in:', distGraphqlPath);
  
  try {
    if (fs.existsSync(distGraphqlPath)) {
      const files = fs.readdirSync(distGraphqlPath);
      console.log('Found dist GraphQL files:', files);
      
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
  }
}

// Also check the src directory
const srcGraphqlPath = path.join(__dirname, 'src/graphql/schema');
console.log('Looking for src GraphQL files in:', srcGraphqlPath);

try {
  if (fs.existsSync(srcGraphqlPath)) {
    const files = fs.readdirSync(srcGraphqlPath);
    console.log('Found src GraphQL files:', files);
  } else {
    console.log('src GraphQL directory does not exist');
  }
} catch (error) {
  console.error('Error reading src GraphQL directory:', error.message);
}
