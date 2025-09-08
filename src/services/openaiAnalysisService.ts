import OpenAI from 'openai';
import { EnrichedChatSession } from './firestoreService';

export interface ConversationAnalysis {
  sessionId: string;
  firstUserRequest: RequestAnalysis;
  conversationFlow: FlowAnalysis;
  endingAnalysis: EndingAnalysis;
  improvementSuggestions: ImprovementSuggestion[];
  problemTypes: ProblemType[];
}

export interface RequestAnalysis {
  originalMessage: string;
  intent: string;
  category: string;
  urgency: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'neutral' | 'negative';
  clarity: number; // 0-100
  needsClarification: boolean;
}

export interface FlowAnalysis {
  totalMessages: number;
  userMessages: number;
  botMessages: number;
  topicChanges: number;
  userSatisfactionTrend: 'improving' | 'declining' | 'stable';
  keyTopics: string[];
  conversationQuality: number; // 0-100
  misunderstandings: string[];
}

export interface EndingAnalysis {
  endedBy: 'user' | 'bot' | 'timeout';
  resolution: 'resolved' | 'unresolved' | 'abandoned';
  finalSentiment: 'satisfied' | 'neutral' | 'frustrated';
  lastUserMessage?: string;
  reasonForEnding: string;
  followUpNeeded: boolean;
}

export interface ImprovementSuggestion {
  category: 'knowledge' | 'response' | 'flow' | 'clarification';
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  examples: string[];
}

export interface ProblemType {
  type: string;
  description: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high';
  examples: string[];
}

export interface AggregatedAnalysis {
  totalSessions: number;
  analysisDate: Date;
  commonFirstRequests: RequestPattern[];
  conversationPatterns: ConversationPattern[];
  endingPatterns: EndingPattern[];
  topImprovements: ImprovementSuggestion[];
  problemTypeDistribution: ProblemTypeStats[];
  conversationTranscripts: ConversationTranscript[];
}

export interface ConversationTranscript {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  platform: string;
  messageCount: number;
  duration: number;
  messages: TranscriptMessage[];
  analysis?: ConversationAnalysis;
}

export interface TranscriptMessage {
  timestamp: Date;
  isUser: boolean;
  content: string;
  hasActions?: boolean;
  messageLength: number;
}

interface RequestPattern {
  pattern: string;
  count: number;
  percentage: number;
  averageClarity: number;
}

interface ConversationPattern {
  pattern: string;
  frequency: number;
  averageQuality: number;
  commonIssues: string[];
}

interface EndingPattern {
  type: string;
  count: number;
  percentage: number;
  commonReasons: string[];
}

interface ProblemTypeStats {
  type: string;
  occurrences: number;
  percentage: number;
  severity: 'low' | 'medium' | 'high';
  trend: 'increasing' | 'decreasing' | 'stable';
}

export class OpenAIAnalysisService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async analyzeSession(session: EnrichedChatSession): Promise<ConversationAnalysis> {
    try {
      // Prepare conversation transcript
      const transcript = this.prepareTranscript(session);
      
      // Run all 5 analyses in parallel for efficiency
      const [
        firstUserRequest,
        conversationFlow,
        endingAnalysis,
        improvementSuggestions,
        problemTypes
      ] = await Promise.all([
        this.analyzeFirstRequest(session),
        this.analyzeConversationFlow(session, transcript),
        this.analyzeEnding(session, transcript),
        this.generateImprovementSuggestions(session, transcript),
        this.identifyProblemTypes(session, transcript)
      ]);

      return {
        sessionId: session.id,
        firstUserRequest,
        conversationFlow,
        endingAnalysis,
        improvementSuggestions,
        problemTypes
      };
    } catch (error) {
      console.error(`Error analyzing session ${session.id}:`, error);
      throw error;
    }
  }

  private prepareTranscript(session: EnrichedChatSession): string {
    return session.messages
      .map(msg => `${msg.is_user ? 'USER' : 'BOT'}: ${msg.content}`)
      .join('\n');
  }

  // Analysis 1: First User Request
  private async analyzeFirstRequest(session: EnrichedChatSession): Promise<RequestAnalysis> {
    const firstMessage = session.first_user_query || session.messages.find(m => m.is_user)?.content || '';
    
    const prompt = `Analyze this first user request from a support chat:
"${firstMessage}"

Provide analysis in JSON format:
{
  "intent": "main purpose of the request",
  "category": "technical/account/billing/wellness/information/help",
  "urgency": "low/medium/high",
  "sentiment": "positive/neutral/negative",
  "clarity": 0-100,
  "needsClarification": true/false
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      originalMessage: firstMessage,
      ...analysis
    };
  }

  // Analysis 2: Conversation Flow
  private async analyzeConversationFlow(session: EnrichedChatSession, transcript: string): Promise<FlowAnalysis> {
    const prompt = `Analyze this support conversation flow:

${transcript}

Provide analysis in JSON format:
{
  "topicChanges": number of topic shifts,
  "userSatisfactionTrend": "improving/declining/stable",
  "keyTopics": ["topic1", "topic2", ...],
  "conversationQuality": 0-100,
  "misunderstandings": ["description of any misunderstandings"]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      totalMessages: session.messages.length,
      userMessages: session.userMessageCount,
      botMessages: session.botMessageCount,
      ...analysis
    };
  }

  // Analysis 3: How Conversations Ended
  private async analyzeEnding(session: EnrichedChatSession, transcript: string): Promise<EndingAnalysis> {
    const lastMessages = session.messages.slice(-3);
    const lastUserMsg = [...session.messages].reverse().find(m => m.is_user);
    
    const prompt = `Analyze how this support conversation ended:

Full conversation:
${transcript}

Last 3 messages:
${lastMessages.map(m => `${m.is_user ? 'USER' : 'BOT'}: ${m.content}`).join('\n')}

Provide analysis in JSON format:
{
  "endedBy": "user/bot/timeout",
  "resolution": "resolved/unresolved/abandoned",
  "finalSentiment": "satisfied/neutral/frustrated",
  "reasonForEnding": "brief explanation",
  "followUpNeeded": true/false
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      ...analysis,
      lastUserMessage: lastUserMsg?.content
    };
  }

  // Analysis 4: Improvement Suggestions for OpenAI Assistant
  private async generateImprovementSuggestions(
    session: EnrichedChatSession, 
    transcript: string
  ): Promise<ImprovementSuggestion[]> {
    const prompt = `Analyze this support conversation and suggest improvements for the AI assistant:

${transcript}

Identify what information or capabilities the AI assistant needs to handle similar conversations better. 
Provide 3-5 specific suggestions in JSON format:
{
  "suggestions": [
    {
      "category": "knowledge/response/flow/clarification",
      "issue": "specific problem identified",
      "suggestion": "specific improvement recommendation",
      "priority": "high/medium/low",
      "examples": ["example phrases or scenarios"]
    }
  ]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const result = JSON.parse(response.choices[0].message.content || '{"suggestions":[]}');
    return result.suggestions || [];
  }

  // Analysis 5: Problem Types and Prevalence
  private async identifyProblemTypes(
    session: EnrichedChatSession, 
    transcript: string
  ): Promise<ProblemType[]> {
    const prompt = `Identify the types of problems discussed in this support conversation:

${transcript}

Categorize and list all problems mentioned. Provide analysis in JSON format:
{
  "problems": [
    {
      "type": "category of problem",
      "description": "brief description",
      "severity": "low/medium/high",
      "examples": ["specific mentions from conversation"]
    }
  ]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content || '{"problems":[]}');
    
    return (result.problems || []).map((p: any) => ({
      ...p,
      frequency: 1 // Will be aggregated across sessions
    }));
  }

  // Batch analyze multiple sessions
  async analyzeSessions(sessions: EnrichedChatSession[]): Promise<ConversationAnalysis[]> {
    const analyses: ConversationAnalysis[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize);
      const batchAnalyses = await Promise.all(
        batch.map(session => this.analyzeSession(session))
      );
      analyses.push(...batchAnalyses);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < sessions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return analyses;
  }

  // Aggregate analyses for reporting
  aggregateAnalyses(analyses: ConversationAnalysis[], sessions?: EnrichedChatSession[]): AggregatedAnalysis {
    const totalSessions = analyses.length;
    
    // Aggregate first requests
    const requestMap = new Map<string, { count: number; clarity: number[] }>();
    analyses.forEach(a => {
      const intent = a.firstUserRequest.intent;
      const existing = requestMap.get(intent) || { count: 0, clarity: [] };
      existing.count++;
      existing.clarity.push(a.firstUserRequest.clarity);
      requestMap.set(intent, existing);
    });
    
    const commonFirstRequests: RequestPattern[] = Array.from(requestMap.entries())
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        percentage: (data.count / totalSessions) * 100,
        averageClarity: data.clarity.reduce((a, b) => a + b, 0) / data.clarity.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Aggregate conversation patterns
    const flowPatterns = new Map<string, ConversationPattern>();
    analyses.forEach(a => {
      const pattern = `${a.conversationFlow.userSatisfactionTrend}_${a.conversationFlow.topicChanges}topics`;
      const existing = flowPatterns.get(pattern) || {
        pattern,
        frequency: 0,
        averageQuality: 0,
        commonIssues: []
      };
      existing.frequency++;
      existing.averageQuality = (existing.averageQuality + a.conversationFlow.conversationQuality) / 2;
      existing.commonIssues.push(...a.conversationFlow.misunderstandings);
      flowPatterns.set(pattern, existing);
    });
    
    const conversationPatterns = Array.from(flowPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    // Aggregate endings
    const endingMap = new Map<string, EndingPattern>();
    analyses.forEach(a => {
      const type = `${a.endingAnalysis.resolution}_${a.endingAnalysis.endedBy}`;
      const existing = endingMap.get(type) || {
        type,
        count: 0,
        percentage: 0,
        commonReasons: []
      };
      existing.count++;
      existing.commonReasons.push(a.endingAnalysis.reasonForEnding);
      endingMap.set(type, existing);
    });
    
    const endingPatterns = Array.from(endingMap.values())
      .map(e => ({
        ...e,
        percentage: (e.count / totalSessions) * 100
      }))
      .sort((a, b) => b.count - a.count);

    // Aggregate improvements with frequency tracking
    const improvementMap = new Map<string, {suggestion: ImprovementSuggestion, frequency: number}>();
    analyses.forEach(a => {
      a.improvementSuggestions.forEach(suggestion => {
        const key = `${suggestion.category}-${suggestion.issue.substring(0, 50)}`;
        const existing = improvementMap.get(key);
        if (existing) {
          existing.frequency++;
          // Merge examples
          const allExamples = [...existing.suggestion.examples, ...suggestion.examples];
          existing.suggestion.examples = Array.from(new Set(allExamples)).slice(0, 3);
        } else {
          improvementMap.set(key, { 
            suggestion: { ...suggestion }, 
            frequency: 1 
          });
        }
      });
    });
    
    const topImprovements = Array.from(improvementMap.values())
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.suggestion.priority] - priorityOrder[b.suggestion.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.frequency - a.frequency; // Secondary sort by frequency
      })
      .slice(0, 10)
      .map(item => item.suggestion);

    // Aggregate problem types
    const problemMap = new Map<string, ProblemTypeStats>();
    analyses.forEach(a => {
      a.problemTypes.forEach(problem => {
        const existing = problemMap.get(problem.type) || {
          type: problem.type,
          occurrences: 0,
          percentage: 0,
          severity: problem.severity,
          trend: 'stable' as const
        };
        existing.occurrences++;
        problemMap.set(problem.type, existing);
      });
    });
    
    const problemTypeDistribution = Array.from(problemMap.values())
      .map(p => ({
        ...p,
        percentage: (p.occurrences / totalSessions) * 100
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    // Prepare conversation transcripts with analysis
    const conversationTranscripts: ConversationTranscript[] = analyses.map(analysis => {
      const session = sessions?.find(s => s.id === analysis.sessionId);
      
      const messages: TranscriptMessage[] = session ? session.messages.map(msg => ({
        timestamp: msg.timestamp,
        isUser: msg.is_user,
        content: msg.content,
        hasActions: msg.has_actions,
        messageLength: msg.message_length
      })) : [];

      console.log(`Creating transcript for session ${analysis.sessionId}: ${messages.length} messages`);

      return {
        sessionId: analysis.sessionId,
        startTime: session?.created_at || new Date(),
        endTime: session?.last_message_at || new Date(),
        platform: session?.platform || 'unknown',
        messageCount: session?.message_count || 0,
        duration: session?.sessionDurationMinutes || 0,
        messages,
        analysis
      };
    });

    console.log(`Total conversation transcripts created: ${conversationTranscripts.length}`);

    return {
      totalSessions,
      analysisDate: new Date(),
      commonFirstRequests,
      conversationPatterns,
      endingPatterns,
      topImprovements,
      problemTypeDistribution,
      conversationTranscripts
    };
  }

  // Format analysis for clean HTML email report
  formatAnalysisReport(aggregated: AggregatedAnalysis, period?: string, startDate?: Date, endDate?: Date): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Conversation Analysis Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 2.2em;
        }
        .header .date {
            font-size: 1.1em;
            opacity: 0.9;
            margin-top: 10px;
        }
        .overview {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        .stat {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin: 0;
        }
        .stat-label {
            font-size: 0.9em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .section h2 {
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.4em;
        }
        .item {
            padding: 15px;
            margin-bottom: 15px;
            border-left: 4px solid #e9ecef;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .item h3 {
            margin: 0 0 8px 0;
            color: #495057;
            font-size: 1.1em;
        }
        .item .meta {
            font-size: 0.9em;
            color: #6c757d;
            margin-bottom: 8px;
        }
        .item .content {
            color: #495057;
        }
        .priority-high {
            border-left-color: #dc3545;
            background: #fff5f5;
        }
        .priority-medium {
            border-left-color: #ffc107;
            background: #fffdf5;
        }
        .priority-low {
            border-left-color: #28a745;
            background: #f8fff8;
        }
        .severity-high {
            border-left-color: #dc3545;
            background: #fff5f5;
        }
        .severity-medium {
            border-left-color: #ffc107;
            background: #fffdf5;
        }
        .severity-low {
            border-left-color: #28a745;
            background: #f8fff8;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge-high {
            background: #dc3545;
            color: white;
        }
        .badge-medium {
            background: #ffc107;
            color: #333;
        }
        .badge-low {
            background: #28a745;
            color: white;
        }
        .key-insights {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin-top: 30px;
        }
        .key-insights h2 {
            color: white;
            border-bottom: 2px solid rgba(255,255,255,0.3);
            margin-bottom: 20px;
        }
        .conversation-section {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            overflow: hidden;
        }
        .conversation-header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 10px 10px 0 0;
        }
        .conversation-meta {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .conversation-content {
            display: block;
            padding: 25px;
        }
        .message {
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 10px;
            max-width: 80%;
        }
        .message-user {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            margin-left: auto;
            margin-right: 0;
        }
        .message-bot {
            background: #f3e5f5;
            border-left: 4px solid #9c27b0;
            margin-right: auto;
            margin-left: 0;
        }
        .message-timestamp {
            font-size: 0.8em;
            color: #666;
            margin-bottom: 4px;
        }
        .message-content {
            line-height: 1.4;
        }
        .message-actions {
            font-size: 0.8em;
            color: #888;
            margin-top: 4px;
            font-style: italic;
        }
        .session-analysis {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .analysis-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .analysis-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .toggle-icon {
            transition: transform 0.3s ease;
        }
        .toggle-icon.rotated {
            transform: rotate(180deg);
        }
        .insight-item {
            margin-bottom: 10px;
            padding: 8px 0;
        }
        .insight-label {
            font-weight: bold;
            opacity: 0.9;
        }
        .progress-bar {
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            height: 8px;
            margin: 5px 0;
        }
        .progress-fill {
            background: #667eea;
            height: 100%;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI Conversation Analysis</h1>
        <div class="date">${aggregated.analysisDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</div>
        ${period ? `<div class="date" style="margin-top: 5px; font-size: 1.0em;">📊 Report Period: ${period}</div>` : ''}
        ${startDate && endDate ? `<div class="date" style="margin-top: 5px; font-size: 0.9em; opacity: 0.8;">
          📅 ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}
        </div>` : ''}
    </div>

    <div class="overview">
        <div class="stat">
            <div class="stat-number">${aggregated.totalSessions}</div>
            <div class="stat-label">Sessions Analyzed</div>
        </div>
        <div class="stat">
            <div class="stat-number">${aggregated.topImprovements.length}</div>
            <div class="stat-label">Improvements Found</div>
        </div>
        <div class="stat">
            <div class="stat-number">${aggregated.problemTypeDistribution.length}</div>
            <div class="stat-label">Problem Types</div>
        </div>
        <div class="stat">
            <div class="stat-number">${aggregated.endingPatterns.filter(e => e.type.includes('resolved')).reduce((sum, e) => sum + e.count, 0)}</div>
            <div class="stat-label">Resolved Sessions</div>
        </div>
    </div>

    <div class="section">
        <h2>💬 Full Conversation Transcripts & Analysis</h2>
        ${aggregated.conversationTranscripts.map((transcript, index) => `
            <div class="conversation-section">
                <div class="conversation-header">
                    <div>
                        <h3 style="margin: 0;">Session ${index + 1}: ${transcript.platform.toUpperCase()} • ${transcript.messageCount} messages</h3>
                        <div class="conversation-meta">
                            ${transcript.startTime.toLocaleDateString()} ${transcript.startTime.toLocaleTimeString()} • 
                            Duration: ${transcript.duration}min • 
                            Status: ${transcript.analysis?.endingAnalysis.resolution || 'unknown'}
                        </div>
                    </div>
                </div>
                <div class="conversation-content" id="content-${index}">
                    <div class="messages">
                        ${transcript.messages.map(msg => `
                            <div class="message ${msg.isUser ? 'message-user' : 'message-bot'}">
                                <div class="message-timestamp">
                                    ${msg.isUser ? '👤 User' : '🤖 Bot'} • ${msg.timestamp.toLocaleTimeString()}
                                </div>
                                <div class="message-content">${msg.content}</div>
                                ${msg.hasActions ? '<div class="message-actions">Contains action buttons</div>' : ''}
                            </div>
                        `).join('')}
                    </div>
                    
                    ${transcript.analysis ? `
                        <div class="session-analysis">
                            <h4>🔍 AI Analysis for this Session</h4>
                            <div class="analysis-grid">
                                <div class="analysis-card">
                                    <strong>First Request Analysis</strong><br>
                                    <small>Intent:</small> ${transcript.analysis.firstUserRequest.intent}<br>
                                    <small>Category:</small> ${transcript.analysis.firstUserRequest.category}<br>
                                    <small>Clarity:</small> ${transcript.analysis.firstUserRequest.clarity}/100<br>
                                    <small>Urgency:</small> <span class="badge badge-${transcript.analysis.firstUserRequest.urgency}">${transcript.analysis.firstUserRequest.urgency}</span>
                                </div>
                                <div class="analysis-card">
                                    <strong>Conversation Quality</strong><br>
                                    <small>Quality Score:</small> ${transcript.analysis.conversationFlow.conversationQuality}/100<br>
                                    <small>Satisfaction:</small> ${transcript.analysis.conversationFlow.userSatisfactionTrend}<br>
                                    <small>Topic Changes:</small> ${transcript.analysis.conversationFlow.topicChanges}<br>
                                    <small>Misunderstandings:</small> ${transcript.analysis.conversationFlow.misunderstandings.length}
                                </div>
                                <div class="analysis-card">
                                    <strong>Ending Analysis</strong><br>
                                    <small>Resolution:</small> <span class="badge badge-${transcript.analysis.endingAnalysis.resolution === 'resolved' ? 'low' : 'high'}">${transcript.analysis.endingAnalysis.resolution}</span><br>
                                    <small>Ended by:</small> ${transcript.analysis.endingAnalysis.endedBy}<br>
                                    <small>Final sentiment:</small> ${transcript.analysis.endingAnalysis.finalSentiment}<br>
                                    <small>Follow-up needed:</small> ${transcript.analysis.endingAnalysis.followUpNeeded ? 'Yes' : 'No'}
                                </div>
                                <div class="analysis-card">
                                    <strong>Key Problems</strong><br>
                                    ${transcript.analysis.problemTypes.slice(0, 3).map(p => `
                                        <small>${p.type}:</small> <span class="badge badge-${p.severity}">${p.severity}</span><br>
                                    `).join('')}
                                </div>
                            </div>
                            
                            ${transcript.analysis.improvementSuggestions.length > 0 ? `
                                <h5>💡 Specific Improvements for this Session:</h5>
                                <ul>
                                    ${transcript.analysis.improvementSuggestions.slice(0, 3).map(s => `
                                        <li><strong>[${s.priority.toUpperCase()}]</strong> ${s.suggestion}</li>
                                    `).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🎯 First User Requests Analysis</h2>
        ${aggregated.commonFirstRequests.slice(0, 5).map(r => `
            <div class="item">
                <h3>${r.pattern}</h3>
                <div class="meta">${r.count} occurrences (${r.percentage.toFixed(1)}% of sessions)</div>
                <div class="content">
                    <strong>Clarity Score:</strong> ${r.averageClarity.toFixed(0)}/100
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${r.averageClarity}%"></div>
                    </div>
                </div>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🔄 Conversation Flow Patterns</h2>
        ${aggregated.conversationPatterns.slice(0, 5).map(p => `
            <div class="item">
                <h3>${p.pattern.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                <div class="meta">${p.frequency} occurrences</div>
                <div class="content">
                    <strong>Quality Score:</strong> ${p.averageQuality.toFixed(0)}/100
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${p.averageQuality}%"></div>
                    </div>
                    ${p.commonIssues.length > 0 ? `<p><strong>Common Issues:</strong> ${p.commonIssues.slice(0, 2).join('; ')}</p>` : ''}
                </div>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🏁 How Conversations Ended</h2>
        ${aggregated.endingPatterns.slice(0, 5).map(e => `
            <div class="item">
                <h3>${e.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                <div class="meta">${e.count} occurrences (${e.percentage.toFixed(1)}%)</div>
                <div class="content">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${e.percentage}%"></div>
                    </div>
                    <p><strong>Common Reasons:</strong> ${e.commonReasons.slice(0, 2).join('; ')}</p>
                </div>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🚀 Top Improvement Suggestions</h2>
        ${aggregated.topImprovements.slice(0, 8).map((s, i) => `
            <div class="item priority-${s.priority}">
                <h3>
                    ${i + 1}. ${s.issue}
                    <span class="badge badge-${s.priority}">${s.priority}</span>
                </h3>
                <div class="meta">Category: ${s.category}</div>
                <div class="content">
                    <p><strong>Suggestion:</strong> ${s.suggestion}</p>
                    ${s.examples.length > 0 ? `<p><strong>Example:</strong> <em>"${s.examples[0]}"</em></p>` : ''}
                </div>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🔍 Problem Types Distribution</h2>
        ${aggregated.problemTypeDistribution.slice(0, 8).map(p => `
            <div class="item severity-${p.severity}">
                <h3>
                    ${p.type}
                    <span class="badge badge-${p.severity}">${p.severity}</span>
                </h3>
                <div class="meta">${p.occurrences} occurrences (${p.percentage.toFixed(1)}%)</div>
                <div class="content">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${p.percentage}%"></div>
                    </div>
                    <p><strong>Trend:</strong> ${p.trend}</p>
                </div>
            </div>
        `).join('')}
    </div>


    <div class="key-insights">
        <h2>💡 Key Insights Summary</h2>
        <div class="insight-item">
            <span class="insight-label">Most Common Request:</span> ${aggregated.commonFirstRequests[0]?.pattern || 'N/A'}
        </div>
        <div class="insight-item">
            <span class="insight-label">Primary Ending Pattern:</span> ${aggregated.endingPatterns[0]?.type?.replace(/_/g, ' ') || 'N/A'}
        </div>
        <div class="insight-item">
            <span class="insight-label">Top Problem Type:</span> ${aggregated.problemTypeDistribution[0]?.type || 'N/A'}
        </div>
        <div class="insight-item">
            <span class="insight-label">Resolution Rate:</span> ${((aggregated.endingPatterns.filter(e => e.type.includes('resolved')).reduce((sum, e) => sum + e.count, 0) / aggregated.totalSessions) * 100).toFixed(1)}%
        </div>
    </div>

    <div style="text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 0.9em;">
        <p>Generated by Support Agent Analytics Service</p>
        <p>🤖 Powered by OpenAI GPT-4 • 📧 Sent to support@ggtude.com</p>
    </div>

</body>
</html>
    `;
  }
}