import path from 'path';
import fs from 'fs';

// Simulate the path construction in the compiled code
const __dirname = '/app/dist';
console.log('__dirname:', __dirname);

const coreGraphqlPath = path.join(__dirname, 'graphql/schema/core.graphql');
console.log('Constructed path for core.graphql:', coreGraphqlPath);

const agentGraphqlPath = path.join(__dirname, 'graphql/schema/agent.graphql');
console.log('Constructed path for agent.graphql:', agentGraphqlPath);

// Check if the files exist at these paths
console.log('Checking if core.graphql exists at constructed path...');
if (fs.existsSync(coreGraphqlPath)) {
  console.log('core.graphql exists at constructed path!');
} else {
  console.log('core.graphql does not exist at constructed path');
}

console.log('Checking if agent.graphql exists at constructed path...');
if (fs.existsSync(agentGraphqlPath)) {
  console.log('agent.graphql exists at constructed path!');
} else {
  console.log('agent.graphql does not exist at constructed path');
}

// List all files in the directory to see what's actually there
const dirPath = path.join(__dirname, 'graphql/schema');
console.log('Listing files in:', dirPath);
try {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    console.log('Files found:', files);
  } else {
    console.log('Directory does not exist');
  }
} catch (error) {
  console.error('Error listing files:', error.message);
}
