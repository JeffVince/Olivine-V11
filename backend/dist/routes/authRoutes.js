"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthService_1 = require("../services/AuthService");
const router = (0, express_1.Router)();
const authService = new AuthService_1.AuthService();
router.post('/register', async (req, res) => {
    const { orgName, email, password } = req.body;
    if (!orgName || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const result = await authService.register(orgName, email, password);
        return res.json(result);
    }
    catch (err) {
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
    }
    catch (err) {
        return res.status(500).json({ error: 'Login failed' });
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map