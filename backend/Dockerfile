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

# Build the TypeScript code
RUN npm run build

# Manually copy GraphQL files to the dist directory
RUN mkdir -p dist/graphql/schema
RUN echo "Copying GraphQL files from src/graphql/schema to dist/graphql/schema"
RUN ls -la src/graphql/schema/
RUN cp src/graphql/schema/*.graphql dist/graphql/schema/
RUN echo "Files in dist/graphql/schema after copying:"
RUN ls -la dist/graphql/schema/

# Test if GraphQL files exist
RUN node test-files.js

# Expose port 8080
EXPOSE 8080

# Test if GraphQL files exist in final image
RUN node test-final-image.js

# Test path construction
RUN node test-path-construction.js

# Start the application with runtime test
CMD ["sh", "-c", "node test-runtime.js && npm start"]    