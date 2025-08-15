import { Dropbox, DropboxAuth } from 'dropbox';
import type { files } from 'dropbox/types/dropbox_types';
import { PostgresService } from './PostgresService';
import { ConfigService } from './ConfigService';
import { StorageProvider } from './StorageProvider';
import { EventEmitter } from 'events';

export interface DropboxMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retryCount: number;
  rateLimitHits: number;
  averageResponseTime: number;
  bytesTransferred: number;
  operationCounts: { [operation: string]: number };
  errorCounts: { [errorType: string]: number };
}

export interface DropboxLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  operation: string;
  orgId?: string;
  sourceId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  error?: Error | string | Record<string, unknown>;
}

export interface DropboxTokenData extends Record<string, unknown> {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  account_id: string;
  team_member_id?: string;
  is_team_account?: boolean;
  home_namespace_id?: string;
  root_namespace_id?: string;
}

export interface DropboxApiError {
  error_summary: string;
  error: {
    '.tag': string;
    [key: string]: unknown;
  };
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryCondition?: (error: unknown) => boolean;
}

export class DropboxService extends EventEmitter implements StorageProvider {
  private dropboxAuth?: DropboxAuth;
  private postgresService?: PostgresService;
  private configService?: ConfigService;
  private appKey: string;
  private appSecret: string;
  private redirectUri: string;
  private defaultRetryOptions: RetryOptions;
  private rateLimitTracker: Map<string, number>;
  private metrics: DropboxMetrics;
  private logs: DropboxLogEntry[];
  private maxLogEntries: number;

  constructor() {
    super();
    // Lazy init heavy dependencies to speed up construction
    this.appKey = process.env.DROPBOX_APP_KEY || '';
    this.appSecret = process.env.DROPBOX_APP_SECRET || '';
    this.redirectUri = process.env.DROPBOX_REDIRECT_URI || '';
    
    // Initialize default retry options
    this.defaultRetryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    };
    
    // Initialize rate limit tracker
    this.rateLimitTracker = new Map();
    
    // Initialize metrics and logging
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
    
    // Defer DropboxAuth/client creation until used
  }

  private getPostgresService(): PostgresService {
    if (!this.postgresService) {
      this.postgresService = new PostgresService();
    }
    return this.postgresService;
  }

  private getDropboxAuth(): DropboxAuth {
    if (!this.dropboxAuth) {
      this.dropboxAuth = new DropboxAuth({
        clientId: this.appKey,
        clientSecret: this.appSecret
      });
    }
    return this.dropboxAuth;
  }

  /**
   * Log an entry with structured data
   */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    operation: string,
    message: string,
    metadata?: Record<string, unknown>,
    orgId?: string,
    sourceId?: string,
    duration?: number,
    error?: Error | string | Record<string, unknown>
  ): void {
    const logEntry: DropboxLogEntry = {
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

    // Add to in-memory logs
    this.logs.push(logEntry);

    // Trim logs if exceeding max entries
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Console log based on level
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

    // Emit log event for external monitoring systems
    this.emit('log', logEntry);
  }

  private logError(operation: string, error: unknown, orgId?: string, sourceId?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(errorMessage);
    this.log('error', operation, errorMessage, undefined, orgId, sourceId, undefined, errorObj);
    this.emit('error', { operation, error: errorObj, orgId, sourceId });
  }

  /**
   * Update metrics for an operation
   */
  private updateMetrics(
    operation: string,
    success: boolean,
    duration: number,
    bytesTransferred = 0,
    error?: Error | string | Record<string, unknown>
  ): void {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      
      // Track error types
      let errorType = 'unknown'
      if (typeof error === 'object' && error !== null) {
        const anyErr: any = error
        errorType = anyErr?.error?.['tag'] || anyErr?.status?.toString() || 'unknown'
      }
      this.metrics.errorCounts[errorType] = (this.metrics.errorCounts[errorType] || 0) + 1;
    }

    // Update operation counts
    this.metrics.operationCounts[operation] = (this.metrics.operationCounts[operation] || 0) + 1;

    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;

    // Update bytes transferred
    this.metrics.bytesTransferred += bytesTransferred;

    // Emit metrics update event
    this.emit('metrics_updated', {
      operation,
      success,
      duration,
      bytesTransferred,
      currentMetrics: { ...this.metrics }
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): DropboxMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent logs
   */
  getLogs(limit?: number, level?: 'info' | 'warn' | 'error' | 'debug'): DropboxLogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    if (limit) {
      return filteredLogs.slice(-limit);
    }
    
    return [...filteredLogs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    this.log('info', 'clearLogs', 'Logs cleared');
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
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

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'error';
    metrics: DropboxMetrics;
    recentErrors: DropboxLogEntry[];
    rateLimitStatus: { [operation: string]: number };
  } {
    const recentErrors = this.getLogs(10, 'error');
    const errorRate = this.metrics.totalRequests > 0 ? 
      this.metrics.failedRequests / this.metrics.totalRequests : 0;
    
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (errorRate > 0.1) { // More than 10% error rate
      status = 'error';
    } else if (errorRate > 0.05 || this.metrics.rateLimitHits > 10) { // More than 5% error rate or many rate limits
      status = 'warning';
    }

    return {
      status,
      metrics: this.getMetrics(),
      recentErrors,
      rateLimitStatus: Object.fromEntries(this.rateLimitTracker)
    };
  }

  /**
   * Export logs and metrics for external monitoring
   */
  exportDiagnostics(): {
    timestamp: Date;
    metrics: DropboxMetrics;
    logs: DropboxLogEntry[];
    healthStatus: { status: string; details?: Record<string, unknown> };
    configuration: {
      maxRetries: number;
      baseDelay: number;
      maxDelay: number;
      maxLogEntries: number;
    };
  } {
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

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!error) return false;
    
    const err = error as Record<string, any>;
    
    // Rate limiting errors
    if (err.status === 429) return true;
    
    // Network errors
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Dropbox API errors that are retryable
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

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Execute API call with retry logic and error handling
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: Partial<RetryOptions> = {},
    orgId?: string,
    sourceId?: string
  ): Promise<T> {
    const retryOptions = { ...this.defaultRetryOptions, ...options };
    const startTime = Date.now();
    let lastError: unknown;
    let bytesTransferred = 0;

    this.log('debug', operationName, `Starting operation`, { retryOptions }, orgId, sourceId);

    for (let attempt = 1; attempt <= retryOptions.maxRetries + 1; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        // Check rate limit before making request
        await this.checkRateLimit(operationName);
        
        const result = await operation();
        const duration = Date.now() - attemptStartTime;
        const totalDuration = Date.now() - startTime;
        
        // Extract bytes transferred if available
        if (result && typeof result === 'object') {
          if ('size' in result && typeof result.size === 'number') bytesTransferred = result.size;
          if ('length' in result && typeof result.length === 'number') bytesTransferred = result.length;
        }
        
        // Reset rate limit tracking on success
        this.rateLimitTracker.delete(operationName);
        
        // Update metrics
        this.updateMetrics(operationName, true, totalDuration, bytesTransferred);
        
        // Log success
        this.log('info', operationName, 
          `Operation completed successfully${attempt > 1 ? ` after ${attempt} attempts` : ''}`,
          { attempts: attempt, bytesTransferred },
          orgId, sourceId, totalDuration
        );
        
        // Emit success event
        this.emit('api_success', { 
          operation: operationName, 
          attempt, 
          duration: totalDuration,
          bytesTransferred,
          orgId,
          sourceId
        });
        
        return result;
      } catch (error: unknown) {
        lastError = error;
        const attemptDuration = Date.now() - attemptStartTime;
        
        // Handle rate limiting
        if (typeof error === 'object' && error !== null && (error as any).status === 429) {
          const retryAfter = this.extractRetryAfter(error);
          this.rateLimitTracker.set(operationName, Date.now() + (retryAfter * 1000));
          this.metrics.rateLimitHits++;
          
          this.log('warn', operationName, 
            `Rate limit hit, will retry after ${retryAfter}s`,
            { attempt, retryAfter }, orgId, sourceId, attemptDuration
          );
          
          this.emit('rate_limit_hit', { 
            operation: operationName, 
            retryAfter, 
            attempt,
            orgId,
            sourceId
          });
        }

        // Check if we should retry
        const shouldRetry = attempt <= retryOptions.maxRetries && 
                           (retryOptions.retryCondition?.(error) ?? this.isRetryableError(error));

        if (!shouldRetry) {
          const totalDuration = Date.now() - startTime;
          
          // Update metrics for failure
          this.updateMetrics(operationName, false, totalDuration, 0, error as any);
          
          // Log final failure
          this.logError(operationName, error, orgId, sourceId);
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateBackoffDelay(
          attempt, 
          retryOptions.baseDelay, 
          retryOptions.maxDelay
        );

        // Update retry count metric
        this.metrics.retryCount++;

        // Log retry
        this.log('warn', operationName, 
          `Attempt ${attempt} failed, retrying in ${delay}ms`,
          { attempt, delay, error: this.sanitizeError(error) },
          orgId, sourceId, attemptDuration, error as any
        );

        // Emit retry event
        this.emit('api_retry', { 
          operation: operationName, 
          attempt, 
          delay, 
          error: this.sanitizeError(error),
          orgId,
          sourceId
        });

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw this.enhanceError(lastError, operationName);
  }

  /**
   * Check rate limit status
   */
  private async checkRateLimit(operationName: string): Promise<void> {
    const rateLimitUntil = this.rateLimitTracker.get(operationName);
    if (rateLimitUntil && Date.now() < rateLimitUntil) {
      const waitTime = rateLimitUntil - Date.now();
      this.emit('rate_limit_wait', { operation: operationName, waitTime });
      await this.sleep(waitTime);
    }
  }

  /**
   * Extract retry-after header value
   */
  private extractRetryAfter(error: unknown): number {
    const anyErr: any = error as any
    const retryAfter = anyErr?.headers?.['retry-after'] || anyErr?.response?.headers?.['retry-after'];
    return retryAfter ? parseInt(retryAfter, 10) : 60; // Default to 60 seconds
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sanitize error for logging (remove sensitive information)
   */
  private sanitizeError(error: unknown): Record<string, unknown> {
    const err = error as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {
      message: err.message,
      status: err.status,
      code: err.code,
      error_summary: err.error_summary,
      stack: err.stack
    };
    
    return JSON.parse(JSON.stringify(sanitized)); // Deep clone to prevent reference issues
  }

  /**
   * Enhance error with additional context
   */
  private enhanceError(error: unknown, operationName: string): Error {
    const err = error as Record<string, unknown>;
    const errorMessage = typeof err.message === 'string' ? err.message : 
                        typeof err.error_summary === 'string' ? err.error_summary : 'Unknown error';
    
    const enhancedError = new Error(
      `Dropbox API operation '${operationName}' failed: ${errorMessage}`
    );
    
    // Preserve original error properties
    if (error && typeof error === 'object') {
      Object.entries(error).forEach(([key, value]) => {
        if (key !== 'message' && key !== 'stack') {
          (enhancedError as any)[key] = value;
        }
      });
    }
    
    return enhancedError;
  }

  /**
   * Generate Dropbox authorization URL with required scopes
   * @param state Optional OAuth state parameter for CSRF protection and state passing
   */
  async generateAuthUrl(state: string = ''): Promise<string> {
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

      const authUrl = await this.getDropboxAuth().getAuthenticationUrl(
        this.redirectUri,
        state || undefined, // Pass the state parameter if provided
        'code',
        'offline',
        scopes
      );
      
      return authUrl.toString();
    }, 'generateAuthUrl');
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<DropboxTokenData> {
    return this.executeWithRetry(async () => {
      const tokenResponse = await this.getDropboxAuth().getAccessTokenFromCode(
        this.redirectUri,
        code
      );

      const tokenData: DropboxTokenData = {
        access_token: (tokenResponse.result as any).access_token,
        refresh_token: (tokenResponse.result as any).refresh_token,
        expires_at: Date.now() + ((tokenResponse.result as any).expires_in * 1000),
        account_id: (tokenResponse.result as any).account_id
      };

      // Check if this is a team account
      const clientWithToken = new Dropbox({
        accessToken: tokenData.access_token,
        clientId: this.appKey,
        clientSecret: this.appSecret
      });

      try {
        const accountInfo = await clientWithToken.usersGetCurrentAccount();
        if ((accountInfo.result as any).team) {
          tokenData.is_team_account = true;
          tokenData.home_namespace_id = (accountInfo.result as any).account_id;
          tokenData.root_namespace_id = (accountInfo.result as any).team.id;
          
          // Get team member info
          try {
            const teamInfo = await clientWithToken.teamTokenGetAuthenticatedAdmin();
            tokenData.team_member_id = (teamInfo.result as any).admin_profile.team_member_id;
          } catch (teamError) {
            console.warn('Could not get team member info:', teamError);
          }
        } else {
          tokenData.is_team_account = false;
        }
      } catch (error) {
        console.error('Error getting account info:', error);
      }

      return tokenData;
    }, 'exchangeCodeForTokens');
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<DropboxTokenData> {
    return this.executeWithRetry(async () => {
      // Create a new auth client with the refresh token
      const auth = this.getDropboxAuth();
      auth.setRefreshToken(refreshToken);
      await auth.refreshAccessToken();
      
      return {
        access_token: auth.getAccessToken(),
        refresh_token: refreshToken,
        expires_at: (auth.getAccessTokenExpiresAt() as Date).getTime(),
        account_id: '' // This will be updated when we fetch account info
      };
    }, 'refreshAccessToken');
  }

  /**
   * Get stored tokens for an organization and source
   */
  async getStoredTokens(orgId: string, sourceId: string): Promise<DropboxTokenData | null> {
    try {
      const query = `
        SELECT config->>'dropbox_access_token' as access_token,
               config->>'dropbox_refresh_token' as refresh_token,
               config->>'dropbox_expires_at' as expires_at,
               config->>'dropbox_account_id' as account_id,
               config->>'dropbox_team_member_id' as team_member_id,
               config->>'dropbox_is_team_account' as is_team_account,
               config->>'dropbox_home_namespace_id' as home_namespace_id,
               config->>'dropbox_root_namespace_id' as root_namespace_id
        FROM sources 
        WHERE org_id = $1 AND id = $2 AND type = 'dropbox'
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
    } catch (error) {
      console.error('Error getting stored tokens:', error);
      throw error;
    }
  }

  /**
   * Store tokens for an organization and source
   */
  async storeTokens(orgId: string, sourceId: string, tokenData: DropboxTokenData): Promise<void> {
    try {
      const query = `
        UPDATE sources 
        SET config = COALESCE(config, '{}'::jsonb) || $1::jsonb,
            updated_at = NOW()
        WHERE org_id = $2 AND id = $3
      `;
      
      const metadata = {
        dropbox_access_token: tokenData.access_token,
        dropbox_refresh_token: tokenData.refresh_token,
        dropbox_expires_at: tokenData.expires_at?.toString?.() || String(tokenData.expires_at),
        dropbox_account_id: tokenData.account_id,
        dropbox_team_member_id: tokenData.team_member_id,
        dropbox_is_team_account: tokenData.is_team_account ? 'true' : 'false',
        dropbox_home_namespace_id: tokenData.home_namespace_id,
        dropbox_root_namespace_id: tokenData.root_namespace_id
      };
      
      await this.getPostgresService().executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  }

  /**
   * Initialize Dropbox client with access token
   */
  private initializeClient(accessToken: string, selectUser?: string, pathRoot?: string): Dropbox {
    const options: Record<string, unknown> = {
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
    
    return new Dropbox(options);
  }

  /**
   * Get Dropbox client with proper authentication and headers
   */
  public async getClient(orgId: string, sourceId: string): Promise<Dropbox | null> {
    try {
      const tokenData = await this.getStoredTokens(orgId, sourceId);
      
      if (!tokenData) {
        return null;
      }
      
      // Check if token is expired
      if (Date.now() >= tokenData.expires_at) {
        // Refresh token
        const refreshedTokenData = await this.refreshAccessToken(tokenData.refresh_token);
        await this.storeTokens(orgId, sourceId, refreshedTokenData);
        tokenData.access_token = refreshedTokenData.access_token;
      }
      
      const client = this.initializeClient(
        tokenData.access_token, 
        tokenData.team_member_id
      );
      
      return client;
    } catch (error) {
      console.error('Error getting Dropbox client:', error);
      return null;
    }
  }

  /**
   * List folder contents with proper namespace handling
   */
  async listFolder(orgId: string, sourceId: string, path = '', namespace = 'home'): Promise<any> {
    try {
      const tokenData = await this.getStoredTokens(orgId, sourceId);
      
      if (!tokenData) {
        throw new Error('Could not initialize Dropbox client');
      }
      
      // Check if token is expired
      if (Date.now() >= tokenData.expires_at) {
        // Refresh token
        const refreshedTokenData = await this.refreshAccessToken(tokenData.refresh_token);
        await this.storeTokens(orgId, sourceId, refreshedTokenData);
        tokenData.access_token = refreshedTokenData.access_token;
      }
      
      let pathRoot: string | undefined;
      // Set path root header based on namespace
      if (tokenData.is_team_account && namespace === 'team') {
        if (tokenData.root_namespace_id) {
          pathRoot = JSON.stringify({ '.tag': 'root', 'root': tokenData.root_namespace_id });
        }
      } else if (namespace === 'home') {
        pathRoot = JSON.stringify({ '.tag': 'home' });
      }
      
      const client = this.initializeClient(tokenData.access_token, tokenData.team_member_id, pathRoot);
      
      const response = await client.filesListFolder({
        path: path,
        recursive: false
      });
      
      return response;
    } catch (error) {
      console.error('Error listing Dropbox folder:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(orgId: string, sourceId: string, path: string): Promise<any> {
    const client = await this.getClient(orgId, sourceId);
    if (!client) {
      throw new Error('Could not initialize Dropbox client');
    }

    try {
      const response = await client.filesGetMetadata({ path });
      return response.result;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Download a file from Dropbox
   */
  async downloadFile(orgId: string, sourceId: string, path: string): Promise<any> {
    return this.executeWithRetry(async () => {
    const client = await this.getClient(orgId, sourceId);
    if (!client) {
      throw new Error('Could not initialize Dropbox client');
    }

      const response = await client.filesDownload({ path });
      return response.result;
    }, 'downloadFile', {}, orgId, sourceId);
  }

  /**
   * Upload file to Dropbox
   */
  async uploadFile(
    orgId: string, 
    sourceId: string, 
    filePath: string, 
    fileBuffer: Buffer, 
    contentType: string
  ): Promise<any> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient(orgId, sourceId);
      if (!client) {
        throw new Error('Could not initialize Dropbox client');
      }

      // For files larger than 150MB, use upload session
      const FILE_SIZE_LIMIT = 150 * 1024 * 1024; // 150MB
      
      if (fileBuffer.length > FILE_SIZE_LIMIT) {
        return this.uploadLargeFile(client, filePath, fileBuffer);
      } else {
        const response = await client.filesUpload({
          path: filePath,
          contents: fileBuffer,
          mode: { '.tag': 'overwrite' } as any,
          autorename: false
        });
        return response.result;
      }
    }, 'uploadFile', {}, orgId, sourceId);
  }

  /**
   * Upload large file using upload session
   */
  private async uploadLargeFile(client: Dropbox, filePath: string, fileBuffer: Buffer): Promise<any> {
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
    
    // Start upload session
    const sessionResponse = await client.filesUploadSessionStart({
      close: false,
      contents: fileBuffer.slice(0, CHUNK_SIZE)
    });
    
    const sessionId = sessionResponse.result.session_id;
    let offset = CHUNK_SIZE;
    
    // Upload remaining chunks
    while (offset < fileBuffer.length) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE, fileBuffer.length);
      const chunk = fileBuffer.slice(offset, chunkEnd);
      const isLastChunk = chunkEnd === fileBuffer.length;
      
      if (isLastChunk) {
        // Finish upload session
        const finishResponse = await client.filesUploadSessionFinish({
          cursor: {
            session_id: sessionId,
            offset: offset
          },
          commit: {
            path: filePath,
            mode: { '.tag': 'overwrite' } as any,
            autorename: false
          },
          contents: chunk
        });
        return finishResponse.result;
      } else {
        // Append to session
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

  /**
   * Delete file from Dropbox
   */
  async deleteFile(orgId: string, sourceId: string, filePath: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient(orgId, sourceId);
      if (!client) {
        throw new Error('Could not initialize Dropbox client');
      }

      const response = await client.filesDeleteV2({ path: filePath });
      return response.result;
    }, 'deleteFile');
  }

  /**
   * List files in Dropbox (implementing StorageProvider interface)
   */
  async listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<any> {
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

  /**
   * Move/rename file in Dropbox
   */
  async moveFile(orgId: string, sourceId: string, fromPath: string, toPath: string): Promise<any> {
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

  /**
   * Copy file in Dropbox
   */
  async copyFile(orgId: string, sourceId: string, fromPath: string, toPath: string): Promise<any> {
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

  /**
   * Create folder in Dropbox
   */
  async createFolder(orgId: string, sourceId: string, path: string): Promise<any> {
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

  /**
   * Create a shared link for a file or folder
   */
  async createSharedLink(
    orgId: string, 
    sourceId: string, 
    path: string, 
    settings?: Record<string, unknown>
  ): Promise<any> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient(orgId, sourceId);
      if (!client) {
        throw new Error('Could not initialize Dropbox client');
      }

      const requestSettings: any = {
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

  /**
   * Get shared links for a file or folder
   */
  async getSharedLinks(orgId: string, sourceId: string, path: string): Promise<any> {
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

  /**
   * Revoke a shared link
   */
  async revokeSharedLink(orgId: string, sourceId: string, url: string): Promise<any> {
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

  /**
   * Share folder with specific users
   */
  async shareFolder(
    orgId: string, 
    sourceId: string, 
    path: string, 
    members: Array<{email: string, access_level: string}>
  ): Promise<any> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient(orgId, sourceId);
      if (!client) {
        throw new Error('Could not initialize Dropbox client');
      }

      // First, share the folder
      const shareResponse = await client.sharingShareFolder({
        path: path,
        member_policy: { '.tag': 'anyone' },
        acl_update_policy: { '.tag': 'editors' },
        shared_link_policy: { '.tag': 'anyone' },
        force_async: false
      });

      // Then add members if provided
      if (members && members.length > 0) {
        const membersToAdd = members.map(member => ({
          member: {
            '.tag': 'email' as const,
            email: member.email
          },
          access_level: {
            '.tag': (member.access_level || 'viewer') as any
          }
        }));

        // Check if sharing was successful and has shared_folder_id
        if ('shared_folder_id' in shareResponse.result) {
          await client.sharingAddFolderMember({
            shared_folder_id: (shareResponse.result as any).shared_folder_id,
            members: membersToAdd,
            quiet: false
          });
        }
      }

      return shareResponse.result;
    }, 'shareFolder');
  }

  /**
   * Get folder sharing info
   */
  async getFolderSharingInfo(orgId: string, sourceId: string, sharedFolderId: string): Promise<any> {
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

  /**
   * List folder members
   */
  async listFolderMembers(orgId: string, sourceId: string, sharedFolderId: string): Promise<any> {
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

  /**
   * Remove folder member
   */
  async removeFolderMember(
    orgId: string, 
    sourceId: string, 
    sharedFolderId: string, 
    memberEmail: string
  ): Promise<any> {
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

  /**
   * Update folder member permissions
   */
  async updateFolderMemberPermissions(
    orgId: string, 
    sourceId: string, 
    sharedFolderId: string, 
    memberEmail: string, 
    accessLevel: string
  ): Promise<any> {
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
          '.tag': accessLevel as any
        }
      });
      return response.result;
    }, 'updateFolderMemberPermissions');
  }

  /**
   * Batch download multiple files
   */
  async batchDownloadFiles(
    orgId: string, 
    sourceId: string, 
    filePaths: string[]
  ): Promise<any[]> {
    const BATCH_SIZE = 10; // Process in batches to avoid overwhelming the API
    const results: Array<Record<string, unknown>> = [];

    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(path => 
        this.downloadFile(orgId, sourceId, path)
          .catch(error => ({ error, path }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches to respect rate limits
      if (i + BATCH_SIZE < filePaths.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  /**
   * Batch upload multiple files
   */
  async batchUploadFiles(
    orgId: string, 
    sourceId: string, 
    files: Array<{ path: string; buffer: Buffer; contentType: string }>
  ): Promise<any[]> {
    const BATCH_SIZE = 5; // Smaller batch size for uploads
    const results: Array<Record<string, unknown>> = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(file => 
        this.uploadFile(orgId, sourceId, file.path, file.buffer, file.contentType)
          .catch(error => ({ error, path: file.path }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches
      if (i + BATCH_SIZE < files.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Batch delete multiple files
   */
  async batchDeleteFiles(
    orgId: string, 
    sourceId: string, 
    filePaths: string[]
  ): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient(orgId, sourceId);
      if (!client) {
        throw new Error('Could not initialize Dropbox client');
      }

      // Use Dropbox batch delete API for efficiency
      const entries = filePaths.map(path => ({ path }));
      
      const response = await client.filesDeleteBatch({
        entries: entries as any
      });

      // If the operation is async, poll for completion
      const deleteLaunch = response.result as { '.tag': string; async_job_id: string };
      if ((deleteLaunch as any)['.tag'] === 'async_job_id') {
        return this.pollBatchJobStatus(client, deleteLaunch.async_job_id, 'delete_batch');
      }

      return response.result;
    }, 'batchDeleteFiles');
  }

  /**
   * Batch copy multiple files
   */
  async batchCopyFiles(
    orgId: string, 
    sourceId: string, 
    operations: Array<{ from_path: string; to_path: string }>
  ): Promise<any> {
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
        entries: entries as any,
        autorename: false
      });

      // If the operation is async, poll for completion
      const copyLaunch = response.result as { async_job_id: string };
      if ((copyLaunch as any)['.tag'] === 'async_job_id') {
        return this.pollBatchJobStatus(client, copyLaunch.async_job_id, 'copy_batch');
      }

      return response.result;
    }, 'batchCopyFiles');
  }

  /**
   * Batch move multiple files
   */
  async batchMoveFiles(
    orgId: string, 
    sourceId: string, 
    operations: Array<{ from_path: string; to_path: string }>
  ): Promise<any> {
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

      // If the operation is async, poll for completion
      if ('async_job_id' in response.result) {
        return this.pollBatchJobStatus(client, (response.result as any).async_job_id, 'move_batch');
      }

      return response.result;
    }, 'batchMoveFiles');
  }

  /**
   * Poll batch job status until completion
   */
  private async pollBatchJobStatus(
    client: Dropbox, 
    asyncJobId: string, 
    jobType: string
  ): Promise<any> {
    const MAX_POLLS = 60; // Maximum number of polls (5 minutes with 5s intervals)
    const POLL_INTERVAL = 5000; // 5 seconds

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
      } else if (status === 'failed') {
        throw new Error(`Batch ${jobType} job failed`);
      }
      // Continue polling if status is 'in_progress'
    }

    throw new Error(`Batch ${jobType} job timed out`);
  }

  /**
   * List folder with cursor-based pagination
   */
  async listFolderWithPagination(
    orgId: string, 
    sourceId: string, 
    path = '', 
    options: {
      recursive?: boolean;
      maxFiles?: number;
      cursor?: string;
    } = {}
  ): Promise<{ entries: files.MetadataReference[]; cursor?: string }> {
    const client = await this.getClient(orgId, sourceId);
    if (!client) {
      throw new Error('Failed to initialize Dropbox client');
    }

    const allEntries: files.MetadataReference[] = [];
    let cursor = options.cursor;
    let hasMore = true;
    const maxFiles = options.maxFiles || Number.MAX_SAFE_INTEGER;

    while (hasMore && allEntries.length < maxFiles) {
      interface DropboxResponse<T> {
        result: T;
        status: number;
        headers: Record<string, string>;
      }
      
      const response = await this.executeWithRetry<DropboxResponse<files.ListFolderResult>>(
        async () => {
          const result = cursor 
            ? await client.filesListFolderContinue({ cursor })
            : await client.filesListFolder({ 
                path, 
                recursive: options.recursive,
                limit: Math.min(1000, maxFiles - allEntries.length)
              });
          return result as unknown as DropboxResponse<files.ListFolderResult>;
        },
        'listFolderWithPagination',
        {},
        orgId,
        sourceId
      );

      const result = response.result;

      allEntries.push(...result.entries);
      cursor = result.cursor;
      hasMore = result.has_more;

      // Emit progress event
      this.emit('pagination_progress', {
        operation: 'getAllFilesInFolder',
        totalFetched: allEntries.length,
        hasMore
      });

      // Small delay to avoid rate limiting
      if (hasMore) {
        await this.sleep(100);
      }
    }

    return { entries: allEntries, cursor };
  }

  /**
   * Subscribe to real-time changes (webhook integration)
   */
  async subscribeToChanges(
    orgId: string, 
    sourceId: string, 
    callback: (payload: Record<string, unknown>) => void
  ): Promise<any> {
    // This method integrates with the existing webhook handler
    // The actual webhook setup is handled by DropboxWebhookHandler
    
    // Store the callback for this org/source combination
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
