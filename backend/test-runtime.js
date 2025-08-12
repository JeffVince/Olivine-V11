import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Runtime test: Checking if GraphQL files exist');
console.log('__dirname:', __dirname);
console.log('Current working directory:', process.cwd());

// Check the dist directory specifically (this is where the application expects the files)
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
}

// Also check relative to __dirname (this is where the application will look when running from dist)
const relativeGraphqlPath = path.join(__dirname, 'graphql/schema');
console.log('Looking for GraphQL files relative to __dirname:', relativeGraphqlPath);

try {
  if (fs.existsSync(relativeGraphqlPath)) {
    const files = fs.readdirSync(relativeGraphqlPath);
    console.log('Found GraphQL files relative to __dirname:', files);
    
    // Check for specific .graphql files
    const graphqlFiles = files.filter(file => file.endsWith('.graphql'));
    console.log('Found .graphql files:', graphqlFiles);
    
    const coreFile = path.join(relativeGraphqlPath, 'core.graphql');
    console.log('Looking for core.graphql at:', coreFile);
    
    if (fs.existsSync(coreFile)) {
      console.log('core.graphql exists!');
      const content = fs.readFileSync(coreFile, 'utf8');
      console.log('core.graphql content length:', content.length);
    } else {
      console.log('core.graphql does not exist');
    }
  } else {
    console.log('GraphQL directory relative to __dirname does not exist');
  }
} catch (error) {
  console.error('Error reading GraphQL directory relative to __dirname:', error.message);
}

// Test the exact path construction that the application uses
console.log('\nTesting exact path construction used by application:');
const appCorePath = path.join(__dirname, 'graphql/schema/core.graphql');
console.log('Application core path:', appCorePath);

if (fs.existsSync(appCorePath)) {
  console.log('Application core file exists!');
  try {
    const content = fs.readFileSync(appCorePath, 'utf8');
    console.log('Application core file content length:', content.length);
  } catch (error) {
    console.error('Error reading application core file:', error.message);
  }
} else {
  console.log('Application core file does not exist');
}

const appAgentPath = path.join(__dirname, 'graphql/schema/agent.graphql');
console.log('Application agent path:', appAgentPath);

if (fs.existsSync(appAgentPath)) {
  console.log('Application agent file exists!');
  try {
    const content = fs.readFileSync(appAgentPath, 'utf8');
    console.log('Application agent file content length:', content.length);
  } catch (error) {
    console.error('Error reading application agent file:', error.message);
  }
} else {
  console.log('Application agent file does not exist');
}
