"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const oauthRoutes_1 = __importDefault(require("../routes/oauthRoutes"));
const app = (0, express_1.default)();
app.use('/api/oauth', oauthRoutes_1.default);
console.log('OAuth routes mounted successfully');
const routes = [];
app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
        routes.push({
            method: Object.keys(r.route.methods)[0],
            path: r.route.path
        });
    }
});
console.log('Registered routes:', routes);
//# sourceMappingURL=testOAuthRoutes.js.map