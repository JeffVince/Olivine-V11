"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express = __importStar(require("express"));
const DropboxService_1 = require("../services/DropboxService");
const GoogleDriveService_1 = require("../services/GoogleDriveService");
const router = express.Router();
const dropboxService = new DropboxService_1.DropboxService();
const gdriveService = new GoogleDriveService_1.GoogleDriveService();
router.get('/dropbox', async (req, res) => {
    try {
        const { orgId, sourceId, state: stateParam } = req.query;
        let state = stateParam || '';
        if (!state && orgId) {
            state = JSON.stringify({
                orgId,
                sourceId,
                projectId: req.query.projectId || ''
            });
        }
        const authUrl = await dropboxService.generateAuthUrl(state);
        return res.redirect(authUrl);
    }
    catch (error) {
        console.error('Error generating Dropbox auth URL:', error);
        return res.status(500).json({ error: 'Failed to generate Dropbox authorization URL' });
    }
});
router.get('/dropbox/callback', async (req, res) => {
    try {
        const { code, state: stateParam } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }
        const tokenData = await dropboxService.exchangeCodeForTokens(code);
        let redirectTo = '/';
        try {
            if (stateParam) {
                let state;
                try {
                    const decodedState = decodeURIComponent(stateParam);
                    state = JSON.parse(decodedState);
                }
                catch (e) {
                    console.warn('Failed to parse state parameter, using as-is');
                    state = stateParam;
                }
                if (typeof state === 'object' && state !== null) {
                    const { orgId, sourceId, projectId } = state;
                    if (orgId && sourceId) {
                        await dropboxService.storeTokens(orgId, sourceId, {
                            access_token: tokenData.access_token,
                            refresh_token: tokenData.refresh_token,
                            expires_at: tokenData.expires_at,
                            account_id: tokenData.account_id,
                            team_member_id: tokenData.team_member_id,
                            is_team_account: tokenData.is_team_account,
                            home_namespace_id: tokenData.home_namespace_id,
                            root_namespace_id: tokenData.root_namespace_id,
                        });
                        if (projectId) {
                            redirectTo = `/#/projects/${projectId}/integrations?connected=dropbox`;
                        }
                        else {
                            redirectTo = `/#/integrations?connected=dropbox`;
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error in OAuth callback processing:', error);
            redirectTo = '/#/integrations?error=oauth_error';
        }
        return res.redirect(redirectTo);
    }
    catch (error) {
        console.error('Error handling Dropbox OAuth callback:', error);
        return res.redirect('/#/integrations?error=oauth_failed');
    }
});
router.get('/gdrive', (req, res) => {
    try {
        const { orgId, sourceId } = req.query;
        const authUrl = gdriveService.generateAuthUrl();
        const redirect = new URL(authUrl);
        if (orgId)
            redirect.searchParams.set('state', JSON.stringify({ orgId, sourceId }));
        return res.redirect(redirect.toString());
    }
    catch (error) {
        console.error('Error generating Google Drive auth URL:', error);
        return res.status(500).json({ error: 'Failed to generate Google Drive authorization URL' });
    }
});
router.get('/gdrive/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }
        const tokenData = await gdriveService.exchangeCodeForTokens(code);
        let redirectTo = '/';
        try {
            if (state) {
                const parsed = JSON.parse(state);
                const orgId = parsed.orgId;
                const sourceId = parsed.sourceId;
                if (orgId && sourceId) {
                    await gdriveService.storeTokens(orgId, sourceId, tokenData);
                }
                if (parsed.projectId) {
                    redirectTo = `/#/projects/${parsed.projectId}/integrations?connected=googledrive`;
                }
            }
        }
        catch (persistErr) {
            console.error('Error persisting Google Drive tokens:', persistErr);
        }
        return res.redirect(redirectTo);
    }
    catch (error) {
        console.error('Error handling Google Drive OAuth callback:', error);
        return res.status(500).json({ error: 'Failed to handle Google Drive OAuth callback' });
    }
});
exports.default = router;
//# sourceMappingURL=oauthRoutes.js.map