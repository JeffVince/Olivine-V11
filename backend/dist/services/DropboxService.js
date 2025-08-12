"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropboxService = void 0;
const dropbox_1 = require("dropbox");
const PostgresService_1 = require("./PostgresService");
const ConfigService_1 = require("./ConfigService");
class DropboxService {
    constructor() {
        this.configService = new ConfigService_1.ConfigService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.appKey = process.env.DROPBOX_APP_KEY || '';
        this.appSecret = process.env.DROPBOX_APP_SECRET || '';
        this.redirectUri = process.env.DROPBOX_REDIRECT_URI || '';
        this.dropboxClient = new dropbox_1.Dropbox({
            clientId: this.appKey,
            clientSecret: this.appSecret
        });
        this.dropboxAuth = new dropbox_1.DropboxAuth({
            clientId: this.appKey,
            clientSecret: this.appSecret
        });
    }
    async generateAuthUrl() {
        const scopes = [
            'files.metadata.read',
            'files.content.read',
            'team_data.member',
            'team_info.read',
            'files.team_metadata.read'
        ];
        const authUrl = await this.dropboxAuth.getAuthenticationUrl(this.redirectUri, undefined, 'code', 'offline', scopes);
        return authUrl.toString();
    }
    async exchangeCodeForTokens(code) {
        try {
            const tokenResponse = await this.dropboxAuth.getAccessTokenFromCode(this.redirectUri, code);
            const tokenData = {
                access_token: tokenResponse.result.access_token,
                refresh_token: tokenResponse.result.refresh_token,
                expires_at: Date.now() + (tokenResponse.result.expires_in * 1000),
                account_id: tokenResponse.result.account_id
            };
            const clientWithToken = new dropbox_1.Dropbox({
                accessToken: tokenData.access_token,
                clientId: this.appKey,
                clientSecret: this.appSecret
            });
            try {
                const accountInfo = await clientWithToken.usersGetCurrentAccount();
                if (accountInfo.result.team) {
                    tokenData.is_team_account = true;
                    tokenData.home_namespace_id = accountInfo.result.account_id;
                    tokenData.root_namespace_id = accountInfo.result.team.id;
                    try {
                        const teamInfo = await clientWithToken.teamTokenGetAuthenticatedAdmin();
                        tokenData.team_member_id = teamInfo.result.admin_profile.team_member_id;
                    }
                    catch (teamError) {
                        console.warn('Could not get team member info:', teamError);
                    }
                }
                else {
                    tokenData.is_team_account = false;
                }
            }
            catch (error) {
                console.error('Error getting account info:', error);
            }
            return tokenData;
        }
        catch (error) {
            console.error('Error exchanging code for tokens:', error);
            throw error;
        }
    }
    async refreshAccessToken(refreshToken) {
        try {
            const authClient = new dropbox_1.DropboxAuth({
                clientId: this.appKey,
                clientSecret: this.appSecret,
                refreshToken: refreshToken
            });
            this.dropboxAuth.setRefreshToken(refreshToken);
            await this.dropboxAuth.refreshAccessToken();
            return {
                access_token: this.dropboxAuth.getAccessToken(),
                refresh_token: refreshToken,
                expires_at: this.dropboxAuth.getAccessTokenExpiresAt().getTime(),
                account_id: ''
            };
        }
        catch (error) {
            console.error('Error refreshing access token:', error);
            throw error;
        }
    }
    async getStoredTokens(orgId, sourceId) {
        try {
            const query = `
        SELECT metadata->>'dropbox_access_token' as access_token,
               metadata->>'dropbox_refresh_token' as refresh_token,
               metadata->>'dropbox_expires_at' as expires_at,
               metadata->>'dropbox_account_id' as account_id,
               metadata->>'dropbox_team_member_id' as team_member_id,
               metadata->>'dropbox_is_team_account' as is_team_account,
               metadata->>'dropbox_home_namespace_id' as home_namespace_id,
               metadata->>'dropbox_root_namespace_id' as root_namespace_id
        FROM sources 
        WHERE organization_id = $1 AND id = $2 AND type = 'dropbox'
      `;
            const result = await this.postgresService.executeQuery(query, [orgId, sourceId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                access_token: row.access_token,
                refresh_token: row.refresh_token,
                expires_at: parseInt(row.expires_at),
                account_id: row.account_id,
                team_member_id: row.team_member_id,
                is_team_account: row.is_team_account === 'true',
                home_namespace_id: row.home_namespace_id,
                root_namespace_id: row.root_namespace_id
            };
        }
        catch (error) {
            console.error('Error getting stored tokens:', error);
            throw error;
        }
    }
    async storeTokens(orgId, sourceId, tokenData) {
        try {
            const query = `
        UPDATE sources 
        SET metadata = metadata || $1::jsonb,
            updated_at = NOW()
        WHERE organization_id = $2 AND id = $3
      `;
            const metadata = {
                dropbox_access_token: tokenData.access_token,
                dropbox_refresh_token: tokenData.refresh_token,
                dropbox_expires_at: tokenData.expires_at.toString(),
                dropbox_account_id: tokenData.account_id,
                dropbox_team_member_id: tokenData.team_member_id,
                dropbox_is_team_account: tokenData.is_team_account?.toString() || 'false',
                dropbox_home_namespace_id: tokenData.home_namespace_id,
                dropbox_root_namespace_id: tokenData.root_namespace_id
            };
            await this.postgresService.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
        }
        catch (error) {
            console.error('Error storing tokens:', error);
            throw error;
        }
    }
    initializeClient(accessToken, selectUser, pathRoot) {
        const options = {
            accessToken: accessToken,
            clientId: this.appKey,
            clientSecret: this.appSecret
        };
        if (selectUser) {
            options.selectUser = selectUser;
        }
        if (pathRoot) {
            options.pathRoot = pathRoot;
        }
        return new dropbox_1.Dropbox(options);
    }
    async getClient(orgId, sourceId) {
        try {
            const tokenData = await this.getStoredTokens(orgId, sourceId);
            if (!tokenData) {
                return null;
            }
            if (Date.now() >= tokenData.expires_at) {
                const refreshedTokenData = await this.refreshAccessToken(tokenData.refresh_token);
                await this.storeTokens(orgId, sourceId, refreshedTokenData);
                tokenData.access_token = refreshedTokenData.access_token;
            }
            const client = this.initializeClient(tokenData.access_token, tokenData.team_member_id);
            return client;
        }
        catch (error) {
            console.error('Error getting Dropbox client:', error);
            return null;
        }
    }
    async listFolder(orgId, sourceId, path = '', namespace = 'home') {
        try {
            const tokenData = await this.getStoredTokens(orgId, sourceId);
            if (!tokenData) {
                throw new Error('Could not initialize Dropbox client');
            }
            if (Date.now() >= tokenData.expires_at) {
                const refreshedTokenData = await this.refreshAccessToken(tokenData.refresh_token);
                await this.storeTokens(orgId, sourceId, refreshedTokenData);
                tokenData.access_token = refreshedTokenData.access_token;
            }
            let pathRoot;
            if (tokenData.is_team_account && namespace === 'team') {
                if (tokenData.root_namespace_id) {
                    pathRoot = JSON.stringify({ '.tag': 'root', 'root': tokenData.root_namespace_id });
                }
            }
            else if (namespace === 'home') {
                pathRoot = JSON.stringify({ '.tag': 'home' });
            }
            const client = this.initializeClient(tokenData.access_token, tokenData.team_member_id, pathRoot);
            const response = await client.filesListFolder({
                path: path,
                recursive: false
            });
            return response;
        }
        catch (error) {
            console.error('Error listing Dropbox folder:', error);
            throw error;
        }
    }
    async getFileMetadata(orgId, sourceId, path) {
        const client = await this.getClient(orgId, sourceId);
        if (!client) {
            throw new Error('Could not initialize Dropbox client');
        }
        try {
            const response = await client.filesGetMetadata({ path });
            return response.result;
        }
        catch (error) {
            console.error('Error getting file metadata:', error);
            throw error;
        }
    }
    async downloadFile(orgId, sourceId, path) {
        const client = await this.getClient(orgId, sourceId);
        if (!client) {
            throw new Error('Could not initialize Dropbox client');
        }
        try {
            const response = await client.filesDownload({ path });
            return response.result;
        }
        catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }
}
exports.DropboxService = DropboxService;
//# sourceMappingURL=DropboxService.js.map