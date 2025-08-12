# Error Handling and Recovery Implementation
## Comprehensive Error Management Framework for System Reliability

### 1. Error Handling Architecture

#### 1.1 Error Classification System

**Error Types and Categories**
```typescript
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  NETWORK = 'network',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  SYSTEM = 'system'
}

export interface BlueprintError extends Error {
  code: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: Date;
  context?: Record<string, any>;
  recoveryStrategy?: RecoveryStrategy;
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  NOTIFY = 'notify',
  ROLLBACK = 'rollback'
}

export class ErrorHandler {
  /**
   * Create a standardized Blueprint error
   */
  static createError(
    message: string,
    code: string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: Record<string, any>,
    recoveryStrategy?: RecoveryStrategy
  ): BlueprintError {
    const error = new Error(message) as BlueprintError;
    error.code = code;
    error.severity = severity;
    error.category = category;
    error.timestamp = new Date();
    error.context = context;
    error.recoveryStrategy = recoveryStrategy;
    
    return error;
  }

  /**
   * Log error with structured format
   */
  static logError(error: BlueprintError): void {
    const logEntry = {
      level: error.severity === ErrorSeverity.CRITICAL ? 'error' : 'warn',
      message: error.message,
      meta: {
        code: error.code,
        severity: error.severity,
        category: error.category,
        timestamp: error.timestamp.toISOString(),
        context: error.context,
        stack: error.stack
      }
    };

    // Log to appropriate channels based on severity
    if (error.severity === ErrorSeverity.CRITICAL) {
      console.error(JSON.stringify(logEntry));
      // Send critical alerts
      AlertService.sendCriticalAlert(error);
    } else {
      console.warn(JSON.stringify(logEntry));
    }
  }

  /**
   * Handle error with recovery strategy
   */
  static async handleError(error: BlueprintError, handlerContext?: any): Promise<ErrorHandlingResult> {
    ErrorHandler.logError(error);
    
    switch (error.recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        return await ErrorHandler.retryOperation(error, handlerContext);
      case RecoveryStrategy.FALLBACK:
        return ErrorHandler.fallbackOperation(error, handlerContext);
      case RecoveryStrategy.SKIP:
        return ErrorHandler.skipOperation(error, handlerContext);
      case RecoveryStrategy.NOTIFY:
        return ErrorHandler.notifyOperation(error, handlerContext);
      case RecoveryStrategy.ROLLBACK:
        return await ErrorHandler.rollbackOperation(error, handlerContext);
      default:
        return {
          success: false,
          error: error,
          message: 'No recovery strategy defined'
        };
    }
  }
}

interface ErrorHandlingResult {
  success: boolean;
  error?: BlueprintError;
  message?: string;
  data?: any;
}
```

### 2. Agent System Error Handling

#### 2.1 File Steward Agent Error Management

**FileStewardAgent Error Handling Implementation**
```typescript
import { ErrorHandler, BlueprintError, ErrorSeverity, ErrorCategory, RecoveryStrategy } from '@/errors/ErrorHandler';
import { QueueService } from '@/services/QueueService';
import { Neo4jService } from '@/services/Neo4jService';
import { LoggingService } from '@/services/LoggingService';

export class FileStewardAgentErrorHandler {
  private queueService: QueueService;
  private neo4jService: Neo4jService;
  private loggingService: LoggingService;

  constructor(queueService: QueueService, neo4jService: Neo4jService, loggingService: LoggingService) {
    this.queueService = queueService;
    this.neo4jService = neo4jService;
    this.loggingService = loggingService;
  }

  /**
   * Handle file processing errors
   */
  async handleFileProcessingError(
    file: any,
    error: Error,
    attempt: number,
    maxRetries: number = 3
  ): Promise<void> {
    const blueprintError: BlueprintError = ErrorHandler.createError(
      `Failed to process file ${file.path}: ${error.message}`,
      'FILE_PROCESSING_ERROR',
      attempt >= maxRetries ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      ErrorCategory.BUSINESS_LOGIC,
      {
        filePath: file.path,
        orgId: file.orgId,
        attempt,
        maxRetries
      },
      attempt >= maxRetries ? RecoveryStrategy.NOTIFY : RecoveryStrategy.RETRY
    );

    const result = await ErrorHandler.handleError(blueprintError, {
      file,
      attempt,
      maxRetries
    });

    if (result.success) {
      this.loggingService.logAgentExecution(
        'FileStewardAgent',
        file.orgId,
        { action: 'processFile', file: file.path },
        { status: 'recovered', message: result.message },
        'recovered'
      );
    } else {
      // Mark file as failed in the database
      const query = `
        MATCH (f:File {id: $fileId})
        SET f.processing_status = 'failed',
            f.last_error = $errorMessage,
            f.error_timestamp = datetime()
        RETURN f
      `;

      await this.neo4jService.run(query, {
        fileId: file.id,
        errorMessage: error.message
      });

      this.loggingService.logAgentExecution(
        'FileStewardAgent',
        file.orgId,
        { action: 'processFile', file: file.path },
        { status: 'failed', message: error.message },
        'failed'
      );
    }
  }

  /**
   * Handle database connection errors
   */
  async handleDatabaseError(error: Error): Promise<void> {
    const blueprintError: BlueprintError = ErrorHandler.createError(
      `Database connection failed: ${error.message}`,
      'DATABASE_CONNECTION_ERROR',
      ErrorSeverity.CRITICAL,
      ErrorCategory.DATABASE,
      {},
      RecoveryStrategy.NOTIFY
    );

    await ErrorHandler.handleError(blueprintError);
    
    // Trigger database health check
    HealthCheckService.checkDatabaseHealth();
  }

  /**
   * Handle queue processing errors
   */
  async handleQueueError(queueName: string, error: Error): Promise<void> {
    const blueprintError: BlueprintError = ErrorHandler.createError(
      `Queue processing failed for ${queueName}: ${error.message}`,
      'QUEUE_PROCESSING_ERROR',
      ErrorSeverity.HIGH,
      ErrorCategory.SYSTEM,
      { queueName },
      RecoveryStrategy.RETRY
    );

    await ErrorHandler.handleError(blueprintError);
  }
}
```

#### 2.2 Taxonomy Classification Agent Error Handling

**ClassificationAgent Error Handling Implementation**
```typescript
export class ClassificationAgentErrorHandler {
  /**
   * Handle classification errors
   */
  async handleClassificationError(
    content: any,
    error: Error,
    attempt: number,
    maxRetries: number = 2
  ): Promise<void> {
    const blueprintError: BlueprintError = ErrorHandler.createError(
      `Failed to classify content ${content.id}: ${error.message}`,
      'CONTENT_CLASSIFICATION_ERROR',
      attempt >= maxRetries ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
      ErrorCategory.BUSINESS_LOGIC,
      {
        contentId: content.id,
        orgId: content.orgId,
        attempt,
        maxRetries
      },
      attempt >= maxRetries ? RecoveryStrategy.SKIP : RecoveryStrategy.RETRY
    );

    const result = await ErrorHandler.handleError(blueprintError, {
      content,
      attempt,
      maxRetries
    });

    if (!result.success && attempt >= maxRetries) {
      // Log content as unclassified
      const query = `
        MATCH (c:Content {id: $contentId})
        SET c.classification_status = 'failed',
            c.last_classification_error = $errorMessage,
            c.classification_error_timestamp = datetime()
        RETURN c
      `;

      await this.neo4jService.run(query, {
        contentId: content.id,
        errorMessage: error.message
      });
    }
  }

  /**
   * Handle taxonomy loading errors
   */
  async handleTaxonomyLoadError(orgId: string, error: Error): Promise<void> {
    const blueprintError: BlueprintError = ErrorHandler.createError(
      `Failed to load taxonomy for organization ${orgId}: ${error.message}`,
      'TAXONOMY_LOAD_ERROR',
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE,
      { orgId },
      RecoveryStrategy.FALLBACK
    );

    await ErrorHandler.handleError(blueprintError);
  }
}
```

### 3. Storage Provider Error Handling

#### 3.1 Dropbox API Error Management

**DropboxErrorHandler Implementation**
```typescript
import axios from 'axios';
import { ErrorHandler, BlueprintError, ErrorSeverity, ErrorCategory, RecoveryStrategy } from '@/errors/ErrorHandler';

export class DropboxErrorHandler {
  /**
   * Handle Dropbox API errors
   */
  static handleDropboxAPIError(error: any, context?: any): BlueprintError {
    let code = 'DROPBOX_API_ERROR';
    let severity = ErrorSeverity.MEDIUM;
    let category = ErrorCategory.EXTERNAL_SERVICE;
    let recoveryStrategy = RecoveryStrategy.RETRY;
    let message = 'Dropbox API error occurred';

    // Handle specific Dropbox error types
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          code = 'DROPBOX_AUTH_ERROR';
          severity = ErrorSeverity.HIGH;
          recoveryStrategy = RecoveryStrategy.FALLBACK;
          message = 'Dropbox authentication failed - token may need refresh';
          break;
          
        case 409:
          if (data.error_summary && data.error_summary.includes('cursor')) {
            code = 'DROPBOX_CURSOR_ERROR';
            severity = ErrorSeverity.LOW;
            recoveryStrategy = RecoveryStrategy.FALLBACK;
            message = 'Dropbox cursor error - may need reset';
          } else {
            code = 'DROPBOX_CONFLICT_ERROR';
            severity = ErrorSeverity.MEDIUM;
            recoveryStrategy = RecoveryStrategy.SKIP;
            message = 'Dropbox conflict error occurred';
          }
          break;
          
        case 503:
          code = 'DROPBOX_RATE_LIMIT_ERROR';
          severity = ErrorSeverity.LOW;
          recoveryStrategy = RecoveryStrategy.RETRY;
          message = 'Dropbox rate limit exceeded - retry after delay';
          break;
          
        default:
          code = `DROPBOX_HTTP_ERROR_${status}`;
          severity = status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
          recoveryStrategy = status >= 500 ? RecoveryStrategy.RETRY : RecoveryStrategy.SKIP;
          message = `Dropbox API HTTP error ${status}: ${data.error_summary || error.message}`;
      }
    } else if (error.request) {
      code = 'DROPBOX_NETWORK_ERROR';
      severity = ErrorSeverity.HIGH;
      category = ErrorCategory.NETWORK;
      recoveryStrategy = RecoveryStrategy.RETRY;
      message = 'Dropbox network error - no response received';
    } else {
      code = 'DROPBOX_UNKNOWN_ERROR';
      severity = ErrorSeverity.CRITICAL;
      recoveryStrategy = RecoveryStrategy.NOTIFY;
      message = `Dropbox unknown error: ${error.message}`;
    }

    const blueprintError = ErrorHandler.createError(
      message,
      code,
      severity,
      category,
      context,
      recoveryStrategy
    );

    return blueprintError;
  }

  /**
   * Retry mechanism for Dropbox API calls
   */
  static async retryDropboxAPICall(
    apiCall: () => Promise<any>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<any> {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        // If it's an auth error, don't retry - handle immediately
        if (error.response && error.response.status === 401) {
          throw DropboxErrorHandler.handleDropboxAPIError(error);
        }
        
        // If it's a rate limit error, wait longer before retrying
        if (error.response && error.response.status === 503) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * attempt;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // For other errors, wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw DropboxErrorHandler.handleDropboxAPIError(lastError);
  }
}
```

#### 3.2 Google Drive Error Handling

**GoogleDriveErrorHandler Implementation**
```typescript
export class GoogleDriveErrorHandler {
  /**
   * Handle Google Drive API errors
   */
  static handleGoogleDriveAPIError(error: any, context?: any): BlueprintError {
    let code = 'GOOGLE_DRIVE_API_ERROR';
    let severity = ErrorSeverity.MEDIUM;
    let category = ErrorCategory.EXTERNAL_SERVICE;
    let recoveryStrategy = RecoveryStrategy.RETRY;
    let message = 'Google Drive API error occurred';

    // Handle specific Google Drive error types
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          code = 'GOOGLE_DRIVE_AUTH_ERROR';
          severity = ErrorSeverity.HIGH;
          recoveryStrategy = RecoveryStrategy.FALLBACK;
          message = 'Google Drive authentication failed';
          break;
          
        case 403:
          code = 'GOOGLE_DRIVE_PERMISSION_ERROR';
          severity = ErrorSeverity.HIGH;
          recoveryStrategy = RecoveryStrategy.SKIP;
          message = 'Google Drive permission denied';
          break;
          
        case 429:
          code = 'GOOGLE_DRIVE_QUOTA_ERROR';
          severity = ErrorSeverity.LOW;
          recoveryStrategy = RecoveryStrategy.RETRY;
          message = 'Google Drive quota exceeded - retry after delay';
          break;
          
        case 500:
        case 503:
          code = `GOOGLE_DRIVE_SERVICE_ERROR_${status}`;
          severity = ErrorSeverity.HIGH;
          recoveryStrategy = RecoveryStrategy.RETRY;
          message = `Google Drive service error ${status}`;
          break;
          
        default:
          code = `GOOGLE_DRIVE_HTTP_ERROR_${status}`;
          severity = status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
          recoveryStrategy = status >= 500 ? RecoveryStrategy.RETRY : RecoveryStrategy.SKIP;
          message = `Google Drive API HTTP error ${status}: ${data.error?.message || error.message}`;
      }
    } else if (error.request) {
      code = 'GOOGLE_DRIVE_NETWORK_ERROR';
      severity = ErrorSeverity.HIGH;
      category = ErrorCategory.NETWORK;
      recoveryStrategy = RecoveryStrategy.RETRY;
      message = 'Google Drive network error - no response received';
    } else {
      code = 'GOOGLE_DRIVE_UNKNOWN_ERROR';
      severity = ErrorSeverity.CRITICAL;
      recoveryStrategy = RecoveryStrategy.NOTIFY;
      message = `Google Drive unknown error: ${error.message}`;
    }

    const blueprintError = ErrorHandler.createError(
      message,
      code,
      severity,
      category,
      context,
      recoveryStrategy
    );

    return blueprintError;
  }
}
```

### 4. Database Error Handling

#### 4.1 Neo4j Error Management

**Neo4jErrorHandler Implementation**
```typescript
import { Neo4jError } from 'neo4j-driver';
import { ErrorHandler, BlueprintError, ErrorSeverity, ErrorCategory, RecoveryStrategy } from '@/errors/ErrorHandler';

export class Neo4jErrorHandler {
  /**
   * Handle Neo4j database errors
   */
  static handleNeo4jError(error: Neo4jError, context?: any): BlueprintError {
    let code = 'NEO4J_ERROR';
    let severity = ErrorSeverity.MEDIUM;
    let category = ErrorCategory.DATABASE;
    let recoveryStrategy = RecoveryStrategy.RETRY;
    let message = 'Neo4j database error occurred';

    // Handle specific Neo4j error types
    if (error.code) {
      switch (error.code) {
        case 'Neo.ClientError.Schema.ConstraintValidationFailed':
          code = 'NEO4J_CONSTRAINT_ERROR';
          severity = ErrorSeverity.LOW;
          recoveryStrategy = RecoveryStrategy.SKIP;
          message = 'Neo4j constraint validation failed';
          break;
          
        case 'Neo.ClientError.Security.Unauthorized':
          code = 'NEO4J_AUTH_ERROR';
          severity = ErrorSeverity.CRITICAL;
          recoveryStrategy = RecoveryStrategy.NOTIFY;
          message = 'Neo4j authentication failed';
          break;
          
        case 'Neo.TransientError.Transaction.LockClientStopped':
          code = 'NEO4J_LOCK_ERROR';
          severity = ErrorSeverity.LOW;
          recoveryStrategy = RecoveryStrategy.RETRY;
          message = 'Neo4j lock acquisition failed - retrying';
          break;
          
        case 'Neo.TransientError.General.DatabaseUnavailable':
          code = 'NEO4J_UNAVAILABLE_ERROR';
          severity = ErrorSeverity.HIGH;
          recoveryStrategy = RecoveryStrategy.RETRY;
          message = 'Neo4j database unavailable';
          break;
          
        case 'Neo.ClientError.Statement.SyntaxError':
          code = 'NEO4J_SYNTAX_ERROR';
          severity = ErrorSeverity.HIGH;
          recoveryStrategy = RecoveryStrategy.SKIP;
          message = 'Neo4j Cypher syntax error';
          break;
          
        default:
          code = `NEO4J_ERROR_${error.code.replace(/\./g, '_')}`;
          severity = error.code.includes('TransientError') ? 
            ErrorSeverity.LOW : 
            error.code.includes('ClientError') ? 
              ErrorSeverity.MEDIUM : 
              ErrorSeverity.HIGH;
          recoveryStrategy = error.code.includes('TransientError') ? 
            RecoveryStrategy.RETRY : 
            RecoveryStrategy.SKIP;
          message = `Neo4j error: ${error.message}`;
      }
    } else {
      code = 'NEO4J_UNKNOWN_ERROR';
      severity = ErrorSeverity.CRITICAL;
      recoveryStrategy = RecoveryStrategy.NOTIFY;
      message = `Neo4j unknown error: ${error.message}`;
    }

    const blueprintError = ErrorHandler.createError(
      message,
      code,
      severity,
      category,
      context,
      recoveryStrategy
    );

    return blueprintError;
  }

  /**
   * Retry mechanism for Neo4j operations
   */
  static async retryNeo4jOperation(
    operation: () => Promise<any>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<any> {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // If it's a constraint or syntax error, don't retry
        if (error.code && (
          error.code.includes('ConstraintValidationFailed') ||
          error.code.includes('SyntaxError')
        )) {
          throw Neo4jErrorHandler.handleNeo4jError(error);
        }
        
        // For transient errors, wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw Neo4jErrorHandler.handleNeo4jError(lastError);
  }
}
```

#### 4.2 PostgreSQL Error Handling

**PostgreSQLErrorHandler Implementation**
```typescript
import { ErrorHandler, BlueprintError, ErrorSeverity, ErrorCategory, RecoveryStrategy } from '@/errors/ErrorHandler';

export class PostgreSQLErrorHandler {
  /**
   * Handle PostgreSQL database errors
   */
  static handlePostgreSQLError(error: any, context?: any): BlueprintError {
    let code = 'POSTGRES_ERROR';
    let severity = ErrorSeverity.MEDIUM;
    let category = ErrorCategory.DATABASE;
    let recoveryStrategy = RecoveryStrategy.RETRY;
    let message = 'PostgreSQL database error occurred';

    // Handle specific PostgreSQL error types
    if (error.code) {
      switch (error.code) {
        case '23505': // unique_violation
          code = 'POSTGRES_UNIQUE_ERROR';
          severity = ErrorSeverity.LOW;
          recoveryStrategy = RecoveryStrategy.SKIP;
          message = 'PostgreSQL unique constraint violation';
          break;
          
        case '23503': // foreign_key_violation
          code = 'POSTGRES_FK_ERROR';
          severity = ErrorSeverity.LOW;
          recoveryStrategy = RecoveryStrategy.SKIP;
          message = 'PostgreSQL foreign key constraint violation';
          break;
          
        case '23514': // check_violation
          code = 'POSTGRES_CHECK_ERROR';
          severity = ErrorSeverity.LOW;
          recoveryStrategy = RecoveryStrategy.SKIP;
          message = 'PostgreSQL check constraint violation';
          break;
          
        case '08006': // connection_failure
          code = 'POSTGRES_CONNECTION_ERROR';
          severity = ErrorSeverity.CRITICAL;
          recoveryStrategy = RecoveryStrategy.NOTIFY;
          message = 'PostgreSQL connection failed';
          break;
          
        case '57P01': // admin_shutdown
        case '57P02': // crash_shutdown
        case '57P03': // cannot_connect_now
          code = 'POSTGRES_UNAVAILABLE_ERROR';
          severity = ErrorSeverity.HIGH;
          recoveryStrategy = RecoveryStrategy.RETRY;
          message = 'PostgreSQL database unavailable';
          break;
          
        default:
          code = `POSTGRES_ERROR_${error.code}`;
          severity = error.code.startsWith('08') ? 
            ErrorSeverity.CRITICAL : 
            error.code.startsWith('23') ? 
              ErrorSeverity.LOW : 
              ErrorSeverity.MEDIUM;
          recoveryStrategy = error.code.startsWith('08') || error.code.startsWith('57') ? 
            RecoveryStrategy.RETRY : 
            RecoveryStrategy.SKIP;
          message = `PostgreSQL error ${error.code}: ${error.message}`;
      }
    } else {
      code = 'POSTGRES_UNKNOWN_ERROR';
      severity = ErrorSeverity.CRITICAL;
      recoveryStrategy = RecoveryStrategy.NOTIFY;
      message = `PostgreSQL unknown error: ${error.message}`;
    }

    const blueprintError = ErrorHandler.createError(
      message,
      code,
      severity,
      category,
      context,
      recoveryStrategy
    );

    return blueprintError;
  }
}
```

### 5. Recovery Strategies Implementation

#### 5.1 Retry Mechanism

**RetryStrategy Implementation**
```typescript
export class RetryStrategy {
  /**
   * Exponential backoff retry
   */
  static async exponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Calculate delay with exponential backoff and jitter
          const delay = Math.min(
            baseDelay * Math.pow(2, attempt),
            maxDelay
          );
          
          const jitter = Math.random() * delay * 0.1;
          const totalDelay = delay + jitter;
          
          console.log(`Attempt ${attempt + 1} failed, retrying in ${totalDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Circuit breaker pattern
   */
  static async circuitBreaker<T>(
    operation: () => Promise<T>,
    breaker: CircuitBreaker
  ): Promise<T> {
    if (breaker.isOpen()) {
      throw new Error('Circuit breaker is open - operation not allowed');
    }
    
    try {
      const result = await operation();
      breaker.onSuccess();
      return result;
    } catch (error) {
      breaker.onFailure();
      throw error;
    }
  }
}

export class CircuitBreaker {
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold: number = 5,
    private timeout: number = 60000,
    private successThreshold: number = 3
  ) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    
    if (this.state === 'half-open') {
      return false;
    }
    
    // Closed state - check if we should open
    return this.failureCount >= this.failureThreshold;
  }

  onSuccess(): void {
    this.successCount++;
    this.failureCount = 0;
    
    if (this.state === 'half-open' && this.successCount >= this.successThreshold) {
      this.state = 'closed';
      this.successCount = 0;
    }
  }

  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}
```

#### 5.2 Fallback Mechanism

**FallbackStrategy Implementation**
```typescript
export class FallbackStrategy {
  /**
   * Execute primary operation with fallback
   */
  static async withFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    shouldUseFallback: (error: any) => boolean
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (primaryError) {
      if (shouldUseFallback(primaryError)) {
        console.warn('Primary operation failed, using fallback:', primaryError.message);
        try {
          return await fallbackOperation();
        } catch (fallbackError) {
          throw new Error(`Both primary and fallback operations failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
        }
      } else {
        throw primaryError;
      }
    }
  }

  /**
   * Dropbox token refresh fallback
   */
  static async dropboxTokenRefreshFallback(
    operation: (token: string) => Promise<any>,
    tokenManager: DropboxTokenManager,
    sourceId: string
  ): Promise<any> {
    return await FallbackStrategy.withFallback(
      async () => {
        const token = await tokenManager.getAccessToken(sourceId);
        return await operation(token);
      },
      async () => {
        await tokenManager.refreshToken(sourceId);
        const newToken = await tokenManager.getAccessToken(sourceId);
        return await operation(newToken);
      },
      (error) => {
        // Use fallback for auth-related errors
        return error.response && error.response.status === 401;
      }
    );
  }
}
```

### 6. Alerting and Monitoring

#### 6.1 Alert Service Implementation

**AlertService Implementation**
```typescript
import axios from 'axios';

export class AlertService {
  private static slackWebhookUrl: string = process.env.SLACK_WEBHOOK_URL || '';
  private static emailAlertAddress: string = process.env.EMAIL_ALERT_ADDRESS || '';

  /**
   * Send critical alert
   */
  static async sendCriticalAlert(error: BlueprintError): Promise<void> {
    const alertMessage = {
      text: `🚨 CRITICAL ERROR in Blueprint System\n\nError Code: ${error.code}\nMessage: ${error.message}\nCategory: ${error.category}\nTimestamp: ${error.timestamp.toISOString()}\nContext: ${JSON.stringify(error.context || {})}`
    };

    // Send to Slack if configured
    if (this.slackWebhookUrl) {
      try {
        await axios.post(this.slackWebhookUrl, alertMessage);
      } catch (slackError) {
        console.error('Failed to send alert to Slack:', slackError);
      }
    }

    // Send email if configured
    if (this.emailAlertAddress) {
      try {
        await this.sendEmailAlert(alertMessage.text);
      } catch (emailError) {
        console.error('Failed to send email alert:', emailError);
      }
    }
  }

  /**
   * Send email alert
   */
  private static async sendEmailAlert(message: string): Promise<void> {
    // Implementation would depend on email service provider
    // This is a placeholder for actual email sending logic
    console.log('Email alert would be sent to:', this.emailAlertAddress);
    console.log('Alert message:', message);
  }

  /**
   * Send warning alert
   */
  static async sendWarningAlert(error: BlueprintError): Promise<void> {
    const alertMessage = {
      text: `⚠️ WARNING in Blueprint System\n\nError Code: ${error.code}\nMessage: ${error.message}\nCategory: ${error.category}\nTimestamp: ${error.timestamp.toISOString()}`
    };

    // Send to Slack if configured
    if (this.slackWebhookUrl) {
      try {
        await axios.post(this.slackWebhookUrl, alertMessage);
      } catch (slackError) {
        console.error('Failed to send warning to Slack:', slackError);
      }
    }
  }
}
```

#### 6.2 Health Check Service

**HealthCheckService Implementation**
```typescript
export class HealthCheckService {
  /**
   * Check database health
   */
  static async checkDatabaseHealth(): Promise<HealthStatus> {
    try {
      // Check Neo4j
      const neo4jSession = neo4jService.getSession();
      await neo4jSession.run('RETURN 1');
      await neo4jSession.close();
      
      // Check PostgreSQL
      const pgClient = await postgresPool.connect();
      await pgClient.query('SELECT 1');
      pgClient.release();
      
      // Check Redis
      const redisClient = queueService.getRedisClient();
      await redisClient.ping();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          neo4j: 'healthy',
          postgres: 'healthy',
          redis: 'healthy'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          neo4j: error.message.includes('neo4j') ? 'unhealthy' : 'unknown',
          postgres: error.message.includes('postgres') ? 'unhealthy' : 'unknown',
          redis: error.message.includes('redis') ? 'unhealthy' : 'unknown'
        },
        error: error.message
      };
    }
  }

  /**
   * Check external service health
   */
  static async checkExternalServiceHealth(): Promise<HealthStatus> {
    const components: Record<string, string> = {};
    
    try {
      // Check Dropbox API
      await axios.get('https://api.dropboxapi.com/2/users/get_current_account', {
        headers: { 'Authorization': `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}` }
      });
      components.dropbox = 'healthy';
    } catch (error) {
      components.dropbox = 'unhealthy';
    }
    
    try {
      // Check Google Drive API
      // Implementation would depend on specific Google Drive client
      components.googleDrive = 'healthy';
    } catch (error) {
      components.googleDrive = 'unhealthy';
    }
    
    try {
      // Check Supabase API
      await axios.get(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: { 'apikey': process.env.SUPABASE_KEY }
      });
      components.supabase = 'healthy';
    } catch (error) {
      components.supabase = 'unhealthy';
    }
    
    const isHealthy = Object.values(components).every(status => status === 'healthy');
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      components
    };
  }
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  components: Record<string, string>;
  error?: string;
}
```

This error handling and recovery implementation provides a comprehensive framework for managing errors across all components of the Blueprint system. It includes error classification, specific handlers for different services, retry mechanisms, fallback strategies, and alerting systems to ensure system reliability and resilience.
