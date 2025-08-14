import { Router } from 'express';
import { AuthService } from '../services/AuthService';

const router = Router();
const authService = new AuthService();

router.post('/register', async (req, res) => {
  const { orgName, email, password } = req.body;
  if (!orgName || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await authService.register(orgName, email, password);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await authService.authenticateUser(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
