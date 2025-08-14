"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropboxService = void 0;
const dropbox_1 = require("dropbox");
const PostgresService_1 = require("./PostgresService");
const events_1 = require("events");
class DropboxService extends events_1.EventEmitter {
    constructor() {
        super();
        this.appKey = process.env.DROPBOX_APP_KEY || '';
        this.appSecret = process.env.DROPBOX_APP_SECRET || '';
        this.redirectUri = process.env.DROPBOX_REDIRECT_URI || '';
        this.defaultRetryOptions = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000
        };
        this.rateLimitTracker = new Map();
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retryCount: 0,
            rateLimitHits: 0,
            averageResponseTime: 0,
            bytesTransferred: 0,
            operationCounts: {},
            errorCounts: {}
        };
        this.logs = [];
        this.maxLogEntries = parseInt(process.env.DROPBOX_MAX_LOG_ENTRIES || '1000');
    }
    getPostgresService() {
        if (!this.postgresService) {
            this.postgresService = new PostgresService_1.PostgresService();
        }
        return this.postgresService;
    }
    getDropboxAuth() {
        if (!this.dropboxAuth) {
            this.dropboxAuth = new dropbox_1.DropboxAuth({
                clientId: this.appKey,
                clientSecret: this.appSecret
            });
        }
        return this.dropboxAuth;
    }
    log(level, operation, message, metadata, orgId, sourceId, duration, error) {
        const logEntry = {
            timestamp: new Date(),
            level,
            operation,
            message,
            metadata,
            orgId,
            sourceId,
            duration,
            error: error ? this.sanitizeError(error) : undefined
        };
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogEntries) {
            this.logs = this.logs.slice(-this.maxLogEntries);
        }
        const logMessage = `[DropboxService:${operation}] ${message}`;
        const contextInfo = {
            orgId,
            sourceId,
            duration: duration ? `${duration}ms` : undefined,
            metadata
        };
        switch (level) {
            case 'error':
                console.error(logMessage, contextInfo, error);
                break;
            case 'warn':
                console.warn(logMessage, contextInfo);
                break;
            case 'debug':
                if (process.env.NODE_ENV === 'development') {
                    console.debug(logMessage, contextInfo);
                }
                break;
            default:
                console.log(logMessage, contextInfo);
        }
        this.emit('log', logEntry);
    }
    logError(operation, error, orgId, sourceId) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorObj = error instanceof Error ? error : new Error(errorMessage);
        this.log('error', operation, errorMessage, undefined, orgId, sourceId, undefined, errorObj);
        this.emit('error', { operation, error: errorObj, orgId, sourceId });
    }
    updateMetrics(operation, success, duration, bytesTransferred = 0, error) {
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successfulRequests++;
        }
        else {
            this.metrics.failedRequests++;
            let errorType = 'unknown';
            if (typeof error === 'object' && error !== null) {
                const anyErr = error;
                errorType = anyErr?.error?.['tag'] || anyErr?.status?.toString() || 'unknown';
            }
            this.metrics.errorCounts[errorType] = (this.metrics.errorCounts[errorType] || 0) + 1;
        }
        this.metrics.operationCounts[operation] = (this.metrics.operationCounts[operation] || 0) + 1;
        const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration;
        this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
        this.metrics.bytesTransferred += bytesTransferred;
        this.emit('metrics_updated', {
            operation,
            success,
            duration,
            bytesTransferred,
            currentMetrics: { ...this.metrics }
        });
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getLogs(limit, level) {
        let filteredLogs = this.logs;
        if (level) {
            filteredLogs = this.logs.filter(log => log.level === level);
        }
        if (limit) {
            return filteredLogs.slice(-limit);
        }
        return [...filteredLogs];
    }
    clearLogs() {
        this.logs = [];
        this.log('info', 'clearLogs', 'Logs cleared');
    }
    resetMetrics() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retryCount: 0,
            rateLimitHits: 0,
            averageResponseTime: 0,
            bytesTransferred: 0,
            operationCounts: {},
            errorCounts: {}
        };
        this.log('info', 'resetMetrics', 'Metrics reset');
    }
    getHealthStatus() {
        const recentErrors = this.getLogs(10, 'error');
        const errorRate = this.metrics.totalRequests > 0 ?
            this.metrics.failedRequests / this.metrics.totalRequests : 0;
        let status = 'healthy';
        if (errorRate > 0.1) {
            status = 'error';
        }
        else if (errorRate > 0.05 || this.metrics.rateLimitHits > 10) {
            status = 'warning';
        }
        return {
            status,
            metrics: this.getMetrics(),
            recentErrors,
            rateLimitStatus: Object.fromEntries(this.rateLimitTracker)
        };
    }
    exportDiagnostics() {
        return {
            timestamp: new Date(),
            metrics: this.getMetrics(),
            logs: this.getLogs(),
            healthStatus: this.getHealthStatus(),
            configuration: {
                maxRetries: this.defaultRetryOptions.maxRetries,
                baseDelay: this.defaultRetryOptions.baseDelay,
                maxDelay: this.defaultRetryOptions.maxDelay,
                maxLogEntries: this.maxLogEntries
            }
        };
    }
    isRetryableError(error) {
        if (!error)
            return false;
        const err = error;
        if (err.status === 429)
            return true;
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
            return true;
        }
        if (err.error_summary) {
            const retryableErrors = [
                'too_many_requests',
                'too_many_write_operations',
                'internal_server_error',
                'service_unavailable'
            ];
            return retryableErrors.some(e => String(err.error_summary).includes(e));
        }
        return false;
    }
    calculateBackoffDelay(attempt, baseDelay, maxDelay) {
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, maxDelay);
    }
    async executeWithRetry(operation, operationName, options = {}, orgId, sourceId) {
        const retryOptions = { ...this.defaultRetryOptions, ...options };
        const startTime = Date.now();
        let lastError;
        let bytesTransferred = 0;
        this.log('debug', operationName, `Starting operation`, { retryOptions }, orgId, sourceId);
        for (let attempt = 1; attempt <= retryOptions.maxRetries + 1; attempt++) {
            const attemptStartTime = Date.now();
            try {
                await this.checkRateLimit(operationName);
                const result = await operation();
                const duration = Date.now() - attemptStartTime;
                const totalDuration = Date.now() - startTime;
                if (result && typeof result === 'object') {
                    if ('size' in result && typeof result.size === 'number')
                        bytesTransferred = result.size;
                    if ('length' in result && typeof result.length === 'number')
                        bytesTransferred = result.length;
                }
                this.rateLimitTracker.delete(operationName);
                this.updateMetrics(operationName, true, totalDuration, bytesTransferred);
                this.log('info', operationName, `Operation completed successfully${attempt > 1 ? ` after ${attempt} attempts` : ''}`, { attempts: attempt, bytesTransferred }, orgId, sourceId, totalDuration);
                this.emit('api_success', {
                    operation: operationName,
                    attempt,
                    duration: totalDuration,
                    bytesTransferred,
                    orgId,
                    sourceId
                });
                return result;
            }
            catch (error) {
                lastError = error;
                const attemptDuration = Date.now() - attemptStartTime;
                if (typeof error === 'object' && error !== null && error.status === 429) {
                    const retryAfter = this.extractRetryAfter(error);
                    this.rateLimitTracker.set(operationName, Date.now() + (retryAfter * 1000));
                    this.metrics.rateLimitHits++;
                    this.log('warn', operationName, `Rate limit hit, will retry after ${retryAfter}s`, { attempt, retryAfter }, orgId, sourceId, attemptDuration);
                    this.emit('rate_limit_hit', {
                        operation: operationName,
                        retryAfter,
                        attempt,
                        orgId,
                        sourceId
                    });
                }
                const shouldRetry = attempt <= retryOptions.maxRetries &&
                    (retryOptions.retryCondition?.(error) ?? this.isRetryableError(error));
                if (!shouldRetry) {
                    const totalDuration = Date.now() - startTime;
                    this.updateMetrics(operationName, false, totalDuration, 0, error);
                    this.logError(operationName, error, orgId, sourceId);
                    break;
                }
                const delay = this.calculateBackoffDelay(attempt, retryOptions.baseDelay, retryOptions.maxDelay);
                this.metrics.retryCount++;
                this.log('warn', operationName, `Attempt ${attempt} failed, retrying in ${delay}ms`, { attempt, delay, error: this.sanitizeError(error) }, orgId, sourceId, attemptDuration, error);
                this.emit('api_retry', {
                    operation: operationName,
                    attempt,
                    delay,
                    error: this.sanitizeError(error),
                    orgId,
                    sourceId
                });
                await this.sleep(delay);
            }
        }
        throw this.enhanceError(lastError, operationName);
    }
    async checkRateLimit(operationName) {
        const rateLimitUntil = this.rateLimitTracker.get(operationName);
        if (rateLimitUntil && Date.now() < rateLimitUntil) {
            const waitTime = rateLimitUntil - Date.now();
            this.emit('rate_limit_wait', { operation: operationName, waitTime });
            await this.sleep(waitTime);
        }
    }
    extractRetryAfter(error) {
        const anyErr = error;
        const retryAfter = anyErr?.headers?.['retry-after'] || anyErr?.response?.headers?.['retry-after'];
        return retryAfter ? parseInt(retryAfter, 10) : 60;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    sanitizeError(error) {
        const err = error;
        const sanitized = {
            message: err.message,
            status: err.status,
            code: err.code,
            error_summary: err.error_summary,
            stack: err.stack
        };
        return JSON.parse(JSON.stringify(sanitized));
    }
    enhanceError(error, operationName) {
        const err = error;
        const errorMessage = typeof err.message === 'string' ? err.message :
            typeof err.error_summary === 'string' ? err.error_summary : 'Unknown error';
        const enhancedError = new Error(`Dropbox API operation '${operationName}' failed: ${errorMessage}`);
        if (error && typeof error === 'object') {
            Object.entries(error).forEach(([key, value]) => {
                if (key !== 'message' && key !== 'stack') {
                    enhancedError[key] = value;
                }
            });
        }
        return enhancedError;
    }
    async generateAuthUrl(state = '') {
        return this.executeWithRetry(async () => {
            const scopes = [
                'files.metadata.read',
                'files.content.read',
                'files.content.write',
                'files.metadata.write',
                'team_data.member',
                'team_info.read',
                'files.team_metadata.read',
                'sharing.read',
                'sharing.write'
            ];
            const authUrl = await this.getDropboxAuth().getAuthenticationUrl(this.redirectUri, state || undefined, 'code', 'offline', scopes);
            return authUrl.toString();
        }, 'generateAuthUrl');
    }
    async exchangeCodeForTokens(code) {
        return this.executeWithRetry(async () => {
            const tokenResponse = await this.getDropboxAuth().getAccessTokenFromCode(this.redirectUri, code);
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
        }, 'exchangeCodeForTokens');
    }
    async refreshAccessToken(refreshToken) {
        return this.executeWithRetry(async () => {
            const auth = this.getDropboxAuth();
            auth.setRefreshToken(refreshToken);
            await auth.refreshAccessToken();
            return {
                access_token: auth.getAccessToken(),
                refresh_token: refreshToken,
                expires_at: auth.getAccessTokenExpiresAt().getTime(),
                account_id: ''
            };
        }, 'refreshAccessToken');
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
            const result = await this.getPostgresService().executeQuery(query, [orgId, sourceId]);
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
            await this.getPostgresService().executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
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
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.filesDownload({ path });
            return response.result;
        }, 'downloadFile', {}, orgId, sourceId);
    }
    async uploadFile(orgId, sourceId, filePath, fileBuffer, contentType) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const FILE_SIZE_LIMIT = 150 * 1024 * 1024;
            if (fileBuffer.length > FILE_SIZE_LIMIT) {
                return this.uploadLargeFile(client, filePath, fileBuffer);
            }
            else {
                const response = await client.filesUpload({
                    path: filePath,
                    contents: fileBuffer,
                    mode: { '.tag': 'overwrite' },
                    autorename: false
                });
                return response.result;
            }
        }, 'uploadFile', {}, orgId, sourceId);
    }
    async uploadLargeFile(client, filePath, fileBuffer) {
        const CHUNK_SIZE = 8 * 1024 * 1024;
        const sessionResponse = await client.filesUploadSessionStart({
            close: false,
            contents: fileBuffer.slice(0, CHUNK_SIZE)
        });
        const sessionId = sessionResponse.result.session_id;
        let offset = CHUNK_SIZE;
        while (offset < fileBuffer.length) {
            const chunkEnd = Math.min(offset + CHUNK_SIZE, fileBuffer.length);
            const chunk = fileBuffer.slice(offset, chunkEnd);
            const isLastChunk = chunkEnd === fileBuffer.length;
            if (isLastChunk) {
                const finishResponse = await client.filesUploadSessionFinish({
                    cursor: {
                        session_id: sessionId,
                        offset: offset
                    },
                    commit: {
                        path: filePath,
                        mode: { '.tag': 'overwrite' },
                        autorename: false
                    },
                    contents: chunk
                });
                return finishResponse.result;
            }
            else {
                await client.filesUploadSessionAppendV2({
                    cursor: {
                        session_id: sessionId,
                        offset: offset
                    },
                    close: false,
                    contents: chunk
                });
                offset = chunkEnd;
            }
        }
    }
    async deleteFile(orgId, sourceId, filePath) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.filesDeleteV2({ path: filePath });
            return response.result;
        }, 'deleteFile');
    }
    async listFiles(orgId, sourceId, pageToken) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.filesListFolder({
                path: '',
                recursive: false,
                limit: 100,
                include_media_info: true,
                include_deleted: false,
                include_has_explicit_shared_members: true
            });
            return response.result;
        }, 'listFiles');
    }
    async moveFile(orgId, sourceId, fromPath, toPath) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.filesMoveV2({
                from_path: fromPath,
                to_path: toPath,
                allow_shared_folder: true,
                autorename: false,
                allow_ownership_transfer: false
            });
            return response.result;
        }, 'moveFile');
    }
    async copyFile(orgId, sourceId, fromPath, toPath) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.filesCopyV2({
                from_path: fromPath,
                to_path: toPath,
                allow_shared_folder: true,
                autorename: false,
                allow_ownership_transfer: false
            });
            return response.result;
        }, 'copyFile');
    }
    async createFolder(orgId, sourceId, path) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.filesCreateFolderV2({
                path: path,
                autorename: false
            });
            return response.result;
        }, 'createFolder');
    }
    async createSharedLink(orgId, sourceId, path, settings) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const requestSettings = {
                requested_visibility: 'public',
                audience: { '.tag': 'public' },
                access: { '.tag': 'viewer' },
                allow_download: true,
                ...settings
            };
            const response = await client.sharingCreateSharedLinkWithSettings({
                path: path,
                settings: requestSettings
            });
            return response.result;
        }, 'createSharedLink');
    }
    async getSharedLinks(orgId, sourceId, path) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.sharingListSharedLinks({
                path: path
            });
            return response.result;
        }, 'getSharedLinks');
    }
    async revokeSharedLink(orgId, sourceId, url) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.sharingRevokeSharedLink({
                url: url
            });
            return response.result;
        }, 'revokeSharedLink');
    }
    async shareFolder(orgId, sourceId, path, members) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const shareResponse = await client.sharingShareFolder({
                path: path,
                member_policy: { '.tag': 'anyone' },
                acl_update_policy: { '.tag': 'editors' },
                shared_link_policy: { '.tag': 'anyone' },
                force_async: false
            });
            if (members && members.length > 0) {
                const membersToAdd = members.map(member => ({
                    member: {
                        '.tag': 'email',
                        email: member.email
                    },
                    access_level: {
                        '.tag': (member.access_level || 'viewer')
                    }
                }));
                if ('shared_folder_id' in shareResponse.result) {
                    await client.sharingAddFolderMember({
                        shared_folder_id: shareResponse.result.shared_folder_id,
                        members: membersToAdd,
                        quiet: false
                    });
                }
            }
            return shareResponse.result;
        }, 'shareFolder');
    }
    async getFolderSharingInfo(orgId, sourceId, sharedFolderId) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.sharingGetFolderMetadata({
                shared_folder_id: sharedFolderId
            });
            return response.result;
        }, 'getFolderSharingInfo');
    }
    async listFolderMembers(orgId, sourceId, sharedFolderId) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.sharingListFolderMembers({
                shared_folder_id: sharedFolderId
            });
            return response.result;
        }, 'listFolderMembers');
    }
    async removeFolderMember(orgId, sourceId, sharedFolderId, memberEmail) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.sharingRemoveFolderMember({
                shared_folder_id: sharedFolderId,
                member: {
                    '.tag': 'email',
                    email: memberEmail
                },
                leave_a_copy: false
            });
            return response.result;
        }, 'removeFolderMember');
    }
    async updateFolderMemberPermissions(orgId, sourceId, sharedFolderId, memberEmail, accessLevel) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const response = await client.sharingUpdateFolderMember({
                shared_folder_id: sharedFolderId,
                member: {
                    '.tag': 'email',
                    email: memberEmail
                },
                access_level: {
                    '.tag': accessLevel
                }
            });
            return response.result;
        }, 'updateFolderMemberPermissions');
    }
    async batchDownloadFiles(orgId, sourceId, filePaths) {
        const BATCH_SIZE = 10;
        const results = [];
        for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
            const batch = filePaths.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(path => this.downloadFile(orgId, sourceId, path)
                .catch(error => ({ error, path })));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + BATCH_SIZE < filePaths.length) {
                await this.sleep(100);
            }
        }
        return results;
    }
    async batchUploadFiles(orgId, sourceId, files) {
        const BATCH_SIZE = 5;
        const results = [];
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(file => this.uploadFile(orgId, sourceId, file.path, file.buffer, file.contentType)
                .catch(error => ({ error, path: file.path })));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + BATCH_SIZE < files.length) {
                await this.sleep(500);
            }
        }
        return results;
    }
    async batchDeleteFiles(orgId, sourceId, filePaths) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const entries = filePaths.map(path => ({ path }));
            const response = await client.filesDeleteBatch({
                entries: entries
            });
            const deleteLaunch = response.result;
            if (deleteLaunch['.tag'] === 'async_job_id') {
                return this.pollBatchJobStatus(client, deleteLaunch.async_job_id, 'delete_batch');
            }
            return response.result;
        }, 'batchDeleteFiles');
    }
    async batchCopyFiles(orgId, sourceId, operations) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const entries = operations.map(op => ({
                from_path: op.from_path,
                to_path: op.to_path,
                allow_shared_folder: true,
                autorename: false,
                allow_ownership_transfer: false
            }));
            const response = await client.filesCopyBatch({
                entries: entries,
                autorename: false
            });
            const copyLaunch = response.result;
            if (copyLaunch['.tag'] === 'async_job_id') {
                return this.pollBatchJobStatus(client, copyLaunch.async_job_id, 'copy_batch');
            }
            return response.result;
        }, 'batchCopyFiles');
    }
    async batchMoveFiles(orgId, sourceId, operations) {
        return this.executeWithRetry(async () => {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Dropbox client');
            }
            const entries = operations.map(op => ({
                from_path: op.from_path,
                to_path: op.to_path
            }));
            const response = await client.filesMoveBatchV2({
                entries: entries,
                autorename: false
            });
            if ('async_job_id' in response.result) {
                return this.pollBatchJobStatus(client, response.result.async_job_id, 'move_batch');
            }
            return response.result;
        }, 'batchMoveFiles');
    }
    async pollBatchJobStatus(client, asyncJobId, jobType) {
        const MAX_POLLS = 60;
        const POLL_INTERVAL = 5000;
        for (let i = 0; i < MAX_POLLS; i++) {
            await this.sleep(POLL_INTERVAL);
            let statusResponse;
            switch (jobType) {
                case 'delete_batch':
                    statusResponse = await client.filesDeleteBatchCheck({
                        async_job_id: asyncJobId
                    });
                    break;
                case 'copy_batch':
                    statusResponse = await client.filesCopyBatchCheckV2({
                        async_job_id: asyncJobId
                    });
                    break;
                case 'move_batch':
                    statusResponse = await client.filesMoveBatchCheckV2({
                        async_job_id: asyncJobId
                    });
                    break;
                default:
                    throw new Error(`Unknown job type: ${jobType}`);
            }
            const status = statusResponse.result['.tag'];
            if (status === 'complete') {
                return statusResponse.result;
            }
            else if (status === 'failed') {
                throw new Error(`Batch ${jobType} job failed`);
            }
        }
        throw new Error(`Batch ${jobType} job timed out`);
    }
    async listFolderWithPagination(orgId, sourceId, path = '', options = {}) {
        const client = await this.getClient(orgId, sourceId);
        if (!client) {
            throw new Error('Failed to initialize Dropbox client');
        }
        const allEntries = [];
        let cursor = options.cursor;
        let hasMore = true;
        const maxFiles = options.maxFiles || Number.MAX_SAFE_INTEGER;
        while (hasMore && allEntries.length < maxFiles) {
            const response = await this.executeWithRetry(async () => {
                const result = cursor
                    ? await client.filesListFolderContinue({ cursor })
                    : await client.filesListFolder({
                        path,
                        recursive: options.recursive,
                        limit: Math.min(1000, maxFiles - allEntries.length)
                    });
                return result;
            }, 'listFolderWithPagination', {}, orgId, sourceId);
            const result = response.result;
            allEntries.push(...result.entries);
            cursor = result.cursor;
            hasMore = result.has_more;
            this.emit('pagination_progress', {
                operation: 'getAllFilesInFolder',
                totalFetched: allEntries.length,
                hasMore
            });
            if (hasMore) {
                await this.sleep(100);
            }
        }
        return { entries: allEntries, cursor };
    }
    async subscribeToChanges(orgId, sourceId, callback) {
        this.emit('subscription_created', {
            orgId,
            sourceId,
            callback
        });
        return {
            success: true,
            message: 'Webhook subscription created. Changes will be processed via DropboxWebhookHandler.'
        };
    }
}
exports.DropboxService = DropboxService;
//# sourceMappingURL=DropboxService.js.map