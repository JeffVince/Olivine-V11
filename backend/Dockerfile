# Use Node.js 20 as the base image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install all dependencies for build process
RUN npm install

# Copy the rest of the application code
COPY . .

# Create GraphQL directory structure
RUN mkdir -p dist/graphql/schema

# Build the TypeScript code
RUN npm run build

# Expose port 8080
EXPOSE 8080

# Start the application
CMD ["npm", "start"]