import { Firestore } from 'firebase-admin/firestore';

export interface ChatSession {
  id: string;
  created_at: Date;
  platform: string;
  last_message_at: Date;
  first_user_query: string;
  message_count: number;
  last_message: string;
  user_queries: string[];
  session_duration: number;
  start_time: string;
  app_version: string;
  build_number: string;
}

export interface ChatMessage {
  timestamp: Date;
  content: string;
  is_user: boolean;
  action?: string;
  message_length: number;
  has_links: boolean;
  has_actions: boolean;
  platform: string;
  language: string;
}

export interface EnrichedChatSession extends ChatSession {
  messages: ChatMessage[];
  userMessageCount: number;
  botMessageCount: number;
  totalCharacters: number;
  hasActions: boolean;
  uniqueUserQueries: number;
  avgMessageLength: number;
  sessionDurationMinutes: number;
}

export class FirestoreService {
  private db: Firestore;
  private collectionName = 'chat_agent_logs';

  constructor(db: Firestore) {
    this.db = db;
  }

  async fetchSessions(startDate?: Date, endDate?: Date): Promise<ChatSession[]> {
    try {
      let query = this.db.collection(this.collectionName).orderBy('created_at', 'desc');

      if (startDate) {
        query = query.where('created_at', '>=', startDate);
      }

      if (endDate) {
        query = query.where('created_at', '<=', endDate);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate(),
        last_message_at: doc.data().last_message_at?.toDate()
      } as ChatSession));
    } catch (error) {
      console.error('Error fetching sessions from Firestore:', error);
      throw error;
    }
  }

  async fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const messagesSnapshot = await this.db
        .collection(this.collectionName)
        .doc(sessionId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();

      return messagesSnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      } as ChatMessage));
    } catch (error) {
      console.error(`Error fetching messages for session ${sessionId}:`, error);
      return [];
    }
  }

  async fetchEnrichedSessions(startDate?: Date, endDate?: Date): Promise<EnrichedChatSession[]> {
    try {
      const sessions = await this.fetchSessions(startDate, endDate);
      const enrichedSessions: EnrichedChatSession[] = [];

      for (const session of sessions) {
        const messages = await this.fetchSessionMessages(session.id);
        
        const userMessages = messages.filter(m => m.is_user);
        const botMessages = messages.filter(m => !m.is_user);
        const totalCharacters = messages.reduce((sum, m) => sum + m.message_length, 0);
        const hasActions = messages.some(m => m.has_actions);
        const uniqueUserQueries = new Set(session.user_queries || []).size;
        const avgMessageLength = messages.length > 0 ? totalCharacters / messages.length : 0;
        
        // Convert session duration to minutes (assuming it's in some time unit)
        const sessionDurationMinutes = session.session_duration || 0;

        enrichedSessions.push({
          ...session,
          messages,
          userMessageCount: userMessages.length,
          botMessageCount: botMessages.length,
          totalCharacters,
          hasActions,
          uniqueUserQueries,
          avgMessageLength,
          sessionDurationMinutes
        });
      }

      return enrichedSessions;
    } catch (error) {
      console.error('Error fetching enriched sessions:', error);
      throw error;
    }
  }

  async fetchSessionsByTimeRange(hours: number = 24): Promise<EnrichedChatSession[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
    return this.fetchEnrichedSessions(startDate, endDate);
  }

  async fetchAllSessions(): Promise<EnrichedChatSession[]> {
    return this.fetchEnrichedSessions();
  }

  async getSessionCount(startDate?: Date, endDate?: Date): Promise<number> {
    const sessions = await this.fetchSessions(startDate, endDate);
    return sessions.length;
  }

  // Legacy method for backward compatibility with existing analytics
  async fetchLogs(startDate?: Date, endDate?: Date): Promise<any[]> {
    const enrichedSessions = await this.fetchEnrichedSessions(startDate, endDate);
    
    // Convert to legacy format for existing analytics
    return enrichedSessions.flatMap(session => {
      const conversationLogs: any[] = [];
      
      // Create a log entry for each user-bot interaction pair
      const userMessages = session.messages.filter(m => m.is_user);
      const botMessages = session.messages.filter(m => !m.is_user);
      
      for (let i = 0; i < Math.max(userMessages.length, botMessages.length); i++) {
        const userMsg = userMessages[i];
        const botMsg = botMessages[i];
        
        conversationLogs.push({
          id: `${session.id}-${i}`,
          conversationId: session.id,
          userMessage: userMsg?.content || '',
          botResponse: botMsg?.content || '',
          timestamp: userMsg?.timestamp || session.created_at,
          sessionDuration: session.sessionDurationMinutes,
          resolved: session.message_count > 2, // Basic heuristic
          category: this.categorizeQuery(userMsg?.content || ''),
          error: false,
          platform: session.platform,
          metadata: {
            messageCount: session.message_count,
            hasActions: session.hasActions,
            appVersion: session.app_version,
            buildNumber: session.build_number,
            responseTime: botMsg ? 1000 : 0 // Default response time
          }
        });
      }
      
      return conversationLogs;
    });
  }

  private categorizeQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('help') || lowerQuery.includes('support')) return 'help';
    if (lowerQuery.includes('error') || lowerQuery.includes('problem') || lowerQuery.includes('issue')) return 'technical';
    if (lowerQuery.includes('how') || lowerQuery.includes('what') || lowerQuery.includes('where')) return 'information';
    if (lowerQuery.includes('account') || lowerQuery.includes('login') || lowerQuery.includes('password')) return 'account';
    if (lowerQuery.includes('payment') || lowerQuery.includes('billing') || lowerQuery.includes('subscription')) return 'billing';
    if (lowerQuery.includes('meditation') || lowerQuery.includes('relax') || lowerQuery.includes('stress')) return 'wellness';
    
    return 'general';
  }

  async fetchLogsByTimeRange(hours: number = 24): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
    return this.fetchLogs(startDate, endDate);
  }

  async fetchAllLogs(): Promise<any[]> {
    return this.fetchLogs();
  }

  async getLogCount(startDate?: Date, endDate?: Date): Promise<number> {
    const logs = await this.fetchLogs(startDate, endDate);
    return logs.length;
  }
}