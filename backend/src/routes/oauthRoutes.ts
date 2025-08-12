import * as express from 'express';
import { DropboxService } from '../services/DropboxService';
import { GoogleDriveService } from '../services/GoogleDriveService';

const router = express.Router();
const dropboxService = new DropboxService();
const gdriveService = new GoogleDriveService();

// Dropbox OAuth routes
router.get('/dropbox', async (req, res) => {
  try {
    const { organizationId, sourceId } = req.query as { organizationId?: string, sourceId?: string }
    const authUrl = await dropboxService.generateAuthUrl();
    const redirect = new URL(authUrl)
    if (organizationId) redirect.searchParams.set('state', JSON.stringify({ organizationId, sourceId }))
    return res.redirect(redirect.toString());
  } catch (error) {
    console.error('Error generating Dropbox auth URL:', error);
    return res.status(500).json({ error: 'Failed to generate Dropbox authorization URL' });
  }
});

router.get('/dropbox/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string, state?: string };
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const tokenData = await dropboxService.exchangeCodeForTokens(code as string);
    // Persist tokens to source metadata if provided
    let redirectTo = '/'
    try {
      if (state) {
        const parsed = JSON.parse(state)
        const organizationId = parsed.organizationId as string | undefined
        const sourceId = parsed.sourceId as string | undefined
        if (organizationId && sourceId) {
          await dropboxService.storeTokens(organizationId, sourceId, {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at,
            account_id: tokenData.account_id,
            team_member_id: tokenData.team_member_id,
            is_team_account: tokenData.is_team_account,
            home_namespace_id: tokenData.home_namespace_id,
            root_namespace_id: tokenData.root_namespace_id,
          })
        }
        if (parsed.projectId) {
          redirectTo = `/#/projects/${parsed.projectId}/integrations?connected=dropbox`
        }
      }
    } catch (persistErr) {
      console.error('Error persisting Dropbox tokens:', persistErr)
    }

    return res.redirect(redirectTo);
  } catch (error) {
    console.error('Error handling Dropbox OAuth callback:', error);
    return res.status(500).json({ error: 'Failed to handle Dropbox OAuth callback' });
  }
});

// Google Drive OAuth routes
router.get('/gdrive', (req, res) => {
  try {
    const { organizationId, sourceId } = req.query as { organizationId?: string, sourceId?: string }
    const authUrl = gdriveService.generateAuthUrl();
    const redirect = new URL(authUrl)
    if (organizationId) redirect.searchParams.set('state', JSON.stringify({ organizationId, sourceId }))
    return res.redirect(redirect.toString());
  } catch (error) {
    console.error('Error generating Google Drive auth URL:', error);
    return res.status(500).json({ error: 'Failed to generate Google Drive authorization URL' });
  }
});

router.get('/gdrive/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string, state?: string };
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const tokenData = await gdriveService.exchangeCodeForTokens(code as string);
    let redirectTo = '/'
    try {
      if (state) {
        const parsed = JSON.parse(state)
        const organizationId = parsed.organizationId as string | undefined
        const sourceId = parsed.sourceId as string | undefined
        if (organizationId && sourceId) {
          await gdriveService.storeTokens(organizationId, sourceId, tokenData)
        }
        if (parsed.projectId) {
          redirectTo = `/#/projects/${parsed.projectId}/integrations?connected=googledrive`
        }
      }
    } catch (persistErr) {
      console.error('Error persisting Google Drive tokens:', persistErr)
    }

    return res.redirect(redirectTo);
  } catch (error) {
    console.error('Error handling Google Drive OAuth callback:', error);
    return res.status(500).json({ error: 'Failed to handle Google Drive OAuth callback' });
  }
});

export default router;
