import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, field?: string) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends CustomError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends CustomError {
  constructor(service: string, originalError?: Error) {
    super(`External service error: ${service}`, 503, true, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  console.error('Error occurred:', {
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  
  // Determine if error details should be exposed
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldExposeDetails = error.isOperational !== false;

  // Create error response
  const response: ApiResponse = {
    success: false,
    error: error.code || 'INTERNAL_ERROR',
    message: shouldExposeDetails ? error.message : 'An internal error occurred'
  };

  // Add additional details in development
  if (!isProduction && error.stack) {
    (response as any).stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(response);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

/**
 * Validation error handler for Joi validation
 */
export const handleValidationError = (error: any): ValidationError => {
  if (error.isJoi) {
    const message = error.details.map((detail: any) => detail.message).join(', ');
    return new ValidationError(message);
  }
  return error;
};

/**
 * Database error handler
 */
export const handleDatabaseError = (error: any): CustomError => {
  // Handle common database errors
  if (error.code === 'ECONNREFUSED') {
    return new ExternalServiceError('Database connection failed', error);
  }
  
  if (error.code === 'ER_DUP_ENTRY' || error.code === 11000) {
    return new ConflictError('Duplicate entry found');
  }
  
  if (error.code === 'ER_NO_SUCH_TABLE') {
    return new CustomError('Database schema error', 500, false);
  }
  
  return new CustomError('Database operation failed', 500, true, 'DATABASE_ERROR');
};

/**
 * External API error handler
 */
export const handleExternalAPIError = (service: string, error: any): ExternalServiceError => {
  let message = `${service} service unavailable`;
  
  if (error.response) {
    // HTTP error response
    const status = error.response.status;
    if (status === 429) {
      throw new RateLimitError(`${service} rate limit exceeded`);
    } else if (status === 401) {
      throw new AuthenticationError(`${service} authentication failed`);
    } else if (status === 403) {
      throw new AuthorizationError(`${service} access denied`);
    } else if (status >= 500) {
      message = `${service} server error`;
    } else {
      message = `${service} client error: ${error.response.data?.message || error.message}`;
    }
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    message = `${service} connection failed`;
  } else if (error.code === 'ETIMEDOUT') {
    message = `${service} request timeout`;
  }
  
  return new ExternalServiceError(message, error);
};

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        if (fallback) {
          console.warn('Circuit breaker OPEN, using fallback');
          return await fallback();
        }
        throw new ExternalServiceError('Service temporarily unavailable (circuit breaker open)');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state !== 'CLOSED') {
        console.warn('Circuit breaker triggered, using fallback');
        return await fallback();
      }
      
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}