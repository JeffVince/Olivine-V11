import express from 'express';
import oauthRoutes from '../routes/oauthRoutes';

const app = express();
app.use('/api/oauth', oauthRoutes);

// Test if routes are properly mounted
console.log('OAuth routes mounted successfully');

// List all routes
const routes: any[] = [];
app._router.stack.forEach((r: any) => {
  if (r.route && r.route.path) {
    routes.push({
      method: Object.keys(r.route.methods)[0],
      path: r.route.path
    });
  }
});

console.log('Registered routes:', routes);
