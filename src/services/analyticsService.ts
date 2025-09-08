import { EnrichedChatSession } from './firestoreService';

// Legacy interface for backward compatibility
export interface ChatLog {
  id: string;
  conversationId?: string;
  userId?: string;
  userMessage?: string;
  botResponse?: string;
  timestamp?: Date;
  sessionDuration?: number;
  resolved?: boolean;
  rating?: number;
  category?: string;
  error?: boolean;
  errorMessage?: string;
  platform?: string;
  metadata?: Record<string, any>;
}

export interface Analytics {
  totalConversations: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  averageRating: number;
  resolvedRate: number;
  errorRate: number;
  topCategories: CategoryCount[];
  hourlyDistribution: HourlyCount[];
  dailyTrend: DailyCount[];
  commonIssues: IssuePattern[];
  userSentiment: SentimentAnalysis;
  responseTimeAnalysis: ResponseTimeStats;
  platformDistribution: PlatformCount[];
  appVersions: VersionCount[];
  averageMessagesPerSession: number;
  sessionsWithActions: number;
  totalMessages: number;
  averageMessageLength: number;
}

interface CategoryCount {
  category: string;
  count: number;
  percentage: number;
}

interface HourlyCount {
  hour: number;
  count: number;
}

interface DailyCount {
  date: string;
  count: number;
  resolved: number;
  errors: number;
}

interface IssuePattern {
  pattern: string;
  frequency: number;
  examples: string[];
}

interface SentimentAnalysis {
  positive: number;
  neutral: number;
  negative: number;
}

interface ResponseTimeStats {
  average: number;
  median: number;
  p95: number;
  p99: number;
}

interface PlatformCount {
  platform: string;
  count: number;
  percentage: number;
}

interface VersionCount {
  version: string;
  count: number;
  percentage: number;
}

export class AnalyticsService {
  
  analyzeLogsAggregation(logs: ChatLog[]): Analytics {
    const totalConversations = logs.length;
    const uniqueUsers = this.getUniqueUsers(logs);
    const averageSessionDuration = this.calculateAverageSessionDuration(logs);
    const averageRating = this.calculateAverageRating(logs);
    const resolvedRate = this.calculateResolvedRate(logs);
    const errorRate = this.calculateErrorRate(logs);
    const topCategories = this.getTopCategories(logs);
    const hourlyDistribution = this.getHourlyDistribution(logs);
    const dailyTrend = this.getDailyTrend(logs);
    const commonIssues = this.findCommonIssues(logs);
    const userSentiment = this.analyzeUserSentiment(logs);
    const responseTimeAnalysis = this.analyzeResponseTimes(logs);
    const platformDistribution = this.getPlatformDistribution(logs);
    const appVersions = this.getAppVersions(logs);
    const averageMessagesPerSession = this.calculateAverageMessagesPerSession(logs);
    const sessionsWithActions = this.getSessionsWithActions(logs);
    const totalMessages = this.getTotalMessages(logs);
    const averageMessageLength = this.calculateAverageMessageLength(logs);

    return {
      totalConversations,
      uniqueUsers,
      averageSessionDuration,
      averageRating,
      resolvedRate,
      errorRate,
      topCategories,
      hourlyDistribution,
      dailyTrend,
      commonIssues,
      userSentiment,
      responseTimeAnalysis,
      platformDistribution,
      appVersions,
      averageMessagesPerSession,
      sessionsWithActions,
      totalMessages,
      averageMessageLength
    };
  }

  private getUniqueUsers(logs: ChatLog[]): number {
    const uniqueUserIds = new Set(logs.map(log => log.userId).filter(id => id));
    return uniqueUserIds.size;
  }

  private calculateAverageSessionDuration(logs: ChatLog[]): number {
    const durations = logs.map(log => log.sessionDuration || 0).filter(d => d > 0);
    if (durations.length === 0) return 0;
    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  private calculateAverageRating(logs: ChatLog[]): number {
    const ratings = logs.map(log => log.rating || 0).filter(r => r > 0);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }

  private calculateResolvedRate(logs: ChatLog[]): number {
    if (logs.length === 0) return 0;
    const resolved = logs.filter(log => log.resolved === true).length;
    return (resolved / logs.length) * 100;
  }

  private calculateErrorRate(logs: ChatLog[]): number {
    if (logs.length === 0) return 0;
    const errors = logs.filter(log => log.error === true).length;
    return (errors / logs.length) * 100;
  }

  private getTopCategories(logs: ChatLog[]): CategoryCount[] {
    const categoryMap = new Map<string, number>();
    
    logs.forEach(log => {
      if (log.category) {
        categoryMap.set(log.category, (categoryMap.get(log.category) || 0) + 1);
      }
    });

    const total = logs.length;
    const categories = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return categories;
  }

  private getHourlyDistribution(logs: ChatLog[]): HourlyCount[] {
    const hourlyMap = new Map<number, number>();
    
    logs.forEach(log => {
      if (log.timestamp) {
        const hour = new Date(log.timestamp).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      }
    });

    const distribution: HourlyCount[] = [];
    for (let hour = 0; hour < 24; hour++) {
      distribution.push({
        hour,
        count: hourlyMap.get(hour) || 0
      });
    }

    return distribution;
  }

  private getDailyTrend(logs: ChatLog[]): DailyCount[] {
    const dailyMap = new Map<string, { count: number; resolved: number; errors: number }>();
    
    logs.forEach(log => {
      if (log.timestamp) {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { count: 0, resolved: 0, errors: 0 };
        
        existing.count++;
        if (log.resolved) existing.resolved++;
        if (log.error) existing.errors++;
        
        dailyMap.set(date, existing);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  private findCommonIssues(logs: ChatLog[]): IssuePattern[] {
    const issuePatterns = new Map<string, { count: number; examples: Set<string> }>();
    
    const commonKeywords = [
      'error', 'not working', 'broken', 'failed', 'issue', 'problem',
      'help', 'stuck', 'crash', 'slow', 'timeout', 'login', 'password',
      'payment', 'checkout', 'loading', 'display', 'missing', 'wrong'
    ];

    logs.forEach(log => {
      if (log.userMessage) {
        const message = log.userMessage.toLowerCase();
        commonKeywords.forEach(keyword => {
          if (message.includes(keyword)) {
            const pattern = issuePatterns.get(keyword) || { count: 0, examples: new Set() };
            pattern.count++;
            if (pattern.examples.size < 3 && log.userMessage) {
              pattern.examples.add(log.userMessage.substring(0, 100));
            }
            issuePatterns.set(keyword, pattern);
          }
        });
      }
    });

    return Array.from(issuePatterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        examples: Array.from(data.examples)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private analyzeUserSentiment(logs: ChatLog[]): SentimentAnalysis {
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    const positiveWords = ['thank', 'great', 'excellent', 'good', 'perfect', 'amazing', 'helpful', 'solved'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'disappointed', 'useless'];

    logs.forEach(log => {
      if (log.userMessage) {
        const message = log.userMessage.toLowerCase();
        let sentimentScore = 0;

        positiveWords.forEach(word => {
          if (message.includes(word)) sentimentScore++;
        });

        negativeWords.forEach(word => {
          if (message.includes(word)) sentimentScore--;
        });

        if (sentimentScore > 0) positive++;
        else if (sentimentScore < 0) negative++;
        else neutral++;
      }
    });

    const total = positive + negative + neutral || 1;
    return {
      positive: (positive / total) * 100,
      neutral: (neutral / total) * 100,
      negative: (negative / total) * 100
    };
  }

  private analyzeResponseTimes(logs: ChatLog[]): ResponseTimeStats {
    const responseTimes: number[] = [];
    
    logs.forEach(log => {
      if (log.metadata?.responseTime) {
        responseTimes.push(log.metadata.responseTime);
      }
    });

    if (responseTimes.length === 0) {
      return { average: 0, median: 0, p95: 0, p99: 0 };
    }

    responseTimes.sort((a, b) => a - b);

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const median = responseTimes[Math.floor(responseTimes.length / 2)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];

    return { average, median, p95, p99 };
  }

  private getPlatformDistribution(logs: ChatLog[]): PlatformCount[] {
    const platformMap = new Map<string, number>();
    
    logs.forEach(log => {
      if (log.platform) {
        platformMap.set(log.platform, (platformMap.get(log.platform) || 0) + 1);
      }
    });

    const total = logs.length;
    return Array.from(platformMap.entries())
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count);
  }

  private getAppVersions(logs: ChatLog[]): VersionCount[] {
    const versionMap = new Map<string, number>();
    
    logs.forEach(log => {
      if (log.metadata?.appVersion) {
        const version = log.metadata.appVersion;
        versionMap.set(version, (versionMap.get(version) || 0) + 1);
      }
    });

    const total = logs.length;
    return Array.from(versionMap.entries())
      .map(([version, count]) => ({
        version,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateAverageMessagesPerSession(logs: ChatLog[]): number {
    if (logs.length === 0) return 0;
    
    const sessionMessageCounts = new Map<string, number>();
    logs.forEach(log => {
      if (log.conversationId) {
        sessionMessageCounts.set(log.conversationId, (sessionMessageCounts.get(log.conversationId) || 0) + 1);
      }
    });

    const totalSessions = sessionMessageCounts.size;
    const totalMessages = Array.from(sessionMessageCounts.values()).reduce((sum, count) => sum + count, 0);
    
    return totalSessions > 0 ? totalMessages / totalSessions : 0;
  }

  private getSessionsWithActions(logs: ChatLog[]): number {
    const sessionsWithActions = new Set<string>();
    
    logs.forEach(log => {
      if (log.metadata?.hasActions && log.conversationId) {
        sessionsWithActions.add(log.conversationId);
      }
    });

    return sessionsWithActions.size;
  }

  private getTotalMessages(logs: ChatLog[]): number {
    return logs.reduce((total, log) => {
      return total + (log.metadata?.messageCount || 1);
    }, 0);
  }

  private calculateAverageMessageLength(logs: ChatLog[]): number {
    const messageLengths: number[] = [];
    
    logs.forEach(log => {
      if (log.userMessage) messageLengths.push(log.userMessage.length);
      if (log.botResponse) messageLengths.push(log.botResponse.length);
    });

    if (messageLengths.length === 0) return 0;
    return messageLengths.reduce((sum, length) => sum + length, 0) / messageLengths.length;
  }
}