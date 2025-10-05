import { UserSession, ConversationMessage, ExtractedTravelParams, FlightResult } from '../types';
import { config } from '../config';

export class SessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, config.session.cleanupIntervalMinutes * 60 * 1000);
  }

  /**
   * Create a new session
   */
  createSession(sessionId: string, userId?: string): UserSession {
    const session: UserSession = {
      sessionId,
      userId,
      conversationHistory: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): UserSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  /**
   * Get or create session
   */
  getOrCreateSession(sessionId: string, userId?: string): UserSession {
    let session = this.getSession(sessionId);
    if (!session) {
      session = this.createSession(sessionId, userId);
    }
    return session;
  }

  /**
   * Update session with new query
   */
  updateSessionQuery(sessionId: string, query: ExtractedTravelParams): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.currentQuery = query;
      session.lastActivity = new Date();
    }
  }

  /**
   * Update session with search results
   */
  updateSessionResults(sessionId: string, results: FlightResult[]): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.searchResults = results;
      session.lastActivity = new Date();
    }
  }

  /**
   * Set selected flight in session
   */
  setSelectedFlight(sessionId: string, flight: FlightResult): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.selectedFlight = flight;
      session.lastActivity = new Date();
    }
  }

  /**
   * Add message to conversation history
   */
  addMessage(sessionId: string, message: ConversationMessage): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.conversationHistory.push(message);
      session.lastActivity = new Date();

      // Keep only last 20 messages to prevent memory issues
      if (session.conversationHistory.length > 20) {
        session.conversationHistory = session.conversationHistory.slice(-20);
      }
    }
  }

  /**
   * Get conversation context for AI
   */
  getConversationContext(sessionId: string): {
    previousQueries: ExtractedTravelParams[];
    searchResults?: FlightResult[];
    selectedFlight?: FlightResult;
    recentMessages: ConversationMessage[];
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        previousQueries: [],
        recentMessages: []
      };
    }

    // Extract previous queries from conversation history
    const previousQueries: ExtractedTravelParams[] = [];
    if (session.currentQuery) {
      previousQueries.push(session.currentQuery);
    }

    return {
      previousQueries,
      searchResults: session.searchResults,
      selectedFlight: session.selectedFlight,
      recentMessages: session.conversationHistory.slice(-5) // Last 5 messages
    };
  }

  /**
   * Clear session data
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    oldestSession?: Date;
  } {
    const now = new Date();
    const ttlMs = config.session.ttlMinutes * 60 * 1000;
    
    let activeSessions = 0;
    let oldestSession: Date | undefined;

    for (const session of this.sessions.values()) {
      const isActive = (now.getTime() - session.lastActivity.getTime()) < ttlMs;
      if (isActive) {
        activeSessions++;
      }

      if (!oldestSession || session.createdAt < oldestSession) {
        oldestSession = session.createdAt;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      oldestSession
    };
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const ttlMs = config.session.ttlMinutes * 60 * 1000;
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > ttlMs) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();