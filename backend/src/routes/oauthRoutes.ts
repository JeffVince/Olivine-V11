import * as express from 'express';
import { DropboxService } from '../services/DropboxService';
import { GoogleDriveService } from '../services/GoogleDriveService';

const router = express.Router();
const dropboxService = new DropboxService();
const gdriveService = new GoogleDriveService();

// Dropbox OAuth routes
router.get('/dropbox', async (req, res) => {
  try {
    const { orgId, sourceId, state: stateParam } = req.query as { 
      orgId?: string, 
      sourceId?: string,
      state?: string
    };
    
    // Use the provided state parameter if it exists, otherwise create a new one
    let state = stateParam || '';
    if (!state && orgId) {
      state = JSON.stringify({ 
        orgId, 
        sourceId,
        projectId: req.query.projectId as string || ''
      });
    }
    
    const authUrl = await dropboxService.generateAuthUrl(state);
    return res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Dropbox auth URL:', error);
    return res.status(500).json({ error: 'Failed to generate Dropbox authorization URL' });
  }
});

router.get('/dropbox/callback', async (req, res) => {
  try {
    const { code, state: stateParam } = req.query as { code?: string, state?: string };
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange the code for tokens
    const tokenData = await dropboxService.exchangeCodeForTokens(code);
    
    // Default redirect to home
    let redirectTo = '/';
    
    try {
      // Try to parse the state if it exists
      if (stateParam) {
        let state;
        try {
          // Try to decode and parse the state parameter
          const decodedState = decodeURIComponent(stateParam);
          state = JSON.parse(decodedState);
        } catch (e) {
          console.warn('Failed to parse state parameter, using as-is');
          state = stateParam;
        }

        // Handle both string and object states for backward compatibility
        if (typeof state === 'object' && state !== null) {
          const { orgId, sourceId, projectId } = state;
          
          // Store tokens if we have the required IDs
          if (orgId && sourceId) {
            await dropboxService.storeTokens(
              orgId, 
              sourceId, 
              {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: tokenData.expires_at,
                account_id: tokenData.account_id,
                team_member_id: tokenData.team_member_id,
                is_team_account: tokenData.is_team_account,
                home_namespace_id: tokenData.home_namespace_id,
                root_namespace_id: tokenData.root_namespace_id,
              }
            );
            
            // Set redirect URL based on whether we have a project ID
            if (projectId) {
              redirectTo = `/#/projects/${projectId}/integrations?connected=dropbox`;
            } else {
              redirectTo = `/#/integrations?connected=dropbox`;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in OAuth callback processing:', error);
      // Even if there's an error, we should still redirect somewhere sensible
      redirectTo = '/#/integrations?error=oauth_error';
    }

    return res.redirect(redirectTo);
  } catch (error) {
    console.error('Error handling Dropbox OAuth callback:', error);
    // Redirect to error page or back to integrations with error
    return res.redirect('/#/integrations?error=oauth_failed');
  }
});

// Google Drive OAuth routes
router.get('/gdrive', (req, res) => {
  try {
    const { orgId, sourceId } = req.query as { orgId?: string, sourceId?: string }
    const authUrl = gdriveService.generateAuthUrl();
    const redirect = new URL(authUrl)
    if (orgId) redirect.searchParams.set('state', JSON.stringify({ orgId, sourceId }))
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
        const orgId = parsed.orgId as string | undefined
        const sourceId = parsed.sourceId as string | undefined
        if (orgId && sourceId) {
          await gdriveService.storeTokens(orgId, sourceId, tokenData)
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
