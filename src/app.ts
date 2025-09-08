import express from 'express';
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';
import { initializeFirebase } from './config/firebase';
import { FirestoreService } from './services/firestoreService';
import { AnalyticsService } from './services/analyticsService';
import { InsightsService } from './services/insightsService';
import { EmailService } from './services/emailService';
import { OpenAIAnalysisService } from './services/openaiAnalysisService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let firestoreService: FirestoreService;
let analyticsService: AnalyticsService;
let insightsService: InsightsService;
let emailService: EmailService;
let openaiAnalysisService: OpenAIAnalysisService;

async function initializeServices() {
  try {
    const db = initializeFirebase();
    firestoreService = new FirestoreService(db);
    analyticsService = new AnalyticsService();
    insightsService = new InsightsService();
    emailService = new EmailService();
    
    try {
      openaiAnalysisService = new OpenAIAnalysisService();
      console.log('OpenAI analysis service initialized');
    } catch (error) {
      console.warn('OpenAI service initialization failed:', error);
    }
    
    await emailService.verifyConnection();
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

async function runAnalysis(timeRange?: { hours?: number; startDate?: Date; endDate?: Date }) {
  try {
    console.log('Starting analysis...');
    
    let logs;
    if (timeRange?.hours) {
      logs = await firestoreService.fetchLogsByTimeRange(timeRange.hours);
    } else if (timeRange?.startDate && timeRange?.endDate) {
      logs = await firestoreService.fetchLogs(timeRange.startDate, timeRange.endDate);
    } else {
      logs = await firestoreService.fetchLogsByTimeRange(24);
    }
    
    console.log(`Fetched ${logs.length} logs`);
    
    const analytics = analyticsService.analyzeLogsAggregation(logs);
    const insights = insightsService.generateInsights(analytics);
    
    const htmlContent = insightsService.formatInsightsAsHTML(insights);
    
    if (process.env.SMTP_USER && process.env.EMAIL_TO) {
      await emailService.sendInsightsEmail(insights, htmlContent);
      console.log('Analysis complete and email sent');
    } else {
      console.log('Email configuration missing - skipping email notification');
      console.log('\n' + insightsService.formatInsightsAsText(insights));
    }
    
    return { insights, analytics };
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/analyze', async (req, res) => {
  try {
    const { hours, startDate, endDate } = req.body;
    const timeRange: any = {};
    
    if (hours) timeRange.hours = hours;
    if (startDate) timeRange.startDate = new Date(startDate);
    if (endDate) timeRange.endDate = new Date(endDate);
    
    const result = await runAnalysis(timeRange);
    res.json({
      success: true,
      insights: result.insights,
      analytics: result.analytics
    });
  } catch (error) {
    console.error('Analysis endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    });
  }
});

app.get('/analyze/daily', async (req, res) => {
  try {
    const result = await runAnalysis({ hours: 24 });
    res.json({
      success: true,
      period: 'last 24 hours',
      insights: result.insights
    });
  } catch (error) {
    console.error('Daily analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    });
  }
});

app.get('/analyze/weekly', async (req, res) => {
  try {
    const result = await runAnalysis({ hours: 168 });
    res.json({
      success: true,
      period: 'last 7 days',
      insights: result.insights
    });
  } catch (error) {
    console.error('Weekly analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    });
  }
});

app.get('/analyze/monthly', async (req, res) => {
  try {
    const result = await runAnalysis({ hours: 720 });
    res.json({
      success: true,
      period: 'last 30 days',
      insights: result.insights
    });
  } catch (error) {
    console.error('Monthly analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    });
  }
});

app.get('/analyze/ai', async (req, res) => {
  try {
    if (!openaiAnalysisService) {
      return res.status(503).json({ 
        success: false, 
        error: 'OpenAI service not available' 
      });
    }

    const hours = parseInt(req.query.hours as string) || 24;
    const sessions = await firestoreService.fetchSessionsByTimeRange(hours);
    
    if (sessions.length === 0) {
      return res.json({
        success: true,
        message: 'No sessions found in the specified time range',
        analysis: null
      });
    }

    console.log(`Analyzing ${sessions.length} sessions with OpenAI...`);
    
    // Analyze sessions
    const analyses = await openaiAnalysisService.analyzeSessions(sessions);
    const aggregated = openaiAnalysisService.aggregateAnalyses(analyses, sessions);
    
    // Calculate date range for the period
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
    const period = `last ${hours} hours`;
    
    const report = openaiAnalysisService.formatAnalysisReport(aggregated, period, startDate, endDate);
    
    // Send email with AI analysis
    if (process.env.SMTP_USER && process.env.EMAIL_TO) {
      await emailService.sendAIAnalysisEmail(report, period);
    }
    
    res.json({
      success: true,
      sessionsAnalyzed: sessions.length,
      period: `last ${hours} hours`,
      analysis: aggregated,
      report: report
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'AI analysis failed' 
    });
  }
});

app.post('/analyze/ai/session/:sessionId', async (req, res) => {
  try {
    if (!openaiAnalysisService) {
      return res.status(503).json({ 
        success: false, 
        error: 'OpenAI service not available' 
      });
    }

    const { sessionId } = req.params;
    const sessions = await firestoreService.fetchEnrichedSessions();
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const analysis = await openaiAnalysisService.analyzeSession(session);
    
    res.json({
      success: true,
      sessionId,
      analysis
    });
  } catch (error) {
    console.error('Session AI analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Session analysis failed' 
    });
  }
});

async function startServer() {
  await initializeServices();
  
  const schedule = process.env.ANALYSIS_SCHEDULE || '0 9 * * *';
  cron.schedule(schedule, async () => {
    console.log('Running scheduled AI analysis for last 4 days...');
    try {
      if (!openaiAnalysisService) {
        console.error('OpenAI service not available for scheduled analysis');
        return;
      }

      const hours = 96; // 4 days
      const sessions = await firestoreService.fetchSessionsByTimeRange(hours);
      
      if (sessions.length === 0) {
        console.log('No sessions found in the last 4 days');
        return;
      }

      console.log(`Analyzing ${sessions.length} sessions from last 4 days with OpenAI...`);
      
      // Analyze sessions with OpenAI
      const analyses = await openaiAnalysisService.analyzeSessions(sessions);
      const aggregated = openaiAnalysisService.aggregateAnalyses(analyses, sessions);
      
      // Calculate date range for the period
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
      const period = 'last 4 days';
      
      const report = openaiAnalysisService.formatAnalysisReport(aggregated, period, startDate, endDate);
      
      // Send email with AI analysis
      if (process.env.SMTP_USER && process.env.EMAIL_TO) {
        await emailService.sendAIAnalysisEmail(report, period);
        console.log(`Scheduled analysis complete: ${sessions.length} sessions analyzed and email sent`);
      } else {
        console.log('Email configuration missing - skipping scheduled email notification');
      }
    } catch (error) {
      console.error('Scheduled AI analysis failed:', error);
    }
  });
  
  console.log(`Scheduled analysis set for: ${schedule}`);
  
  app.listen(port, () => {
    console.log(`Support Agent Analytics Service running on port ${port}`);
    console.log('Available endpoints:');
    console.log('  GET  /health');
    console.log('  POST /analyze');
    console.log('  GET  /analyze/daily');
    console.log('  GET  /analyze/weekly');
    console.log('  GET  /analyze/monthly');
    console.log('  GET  /analyze/ai - AI-powered conversation analysis');
    console.log('  POST /analyze/ai/session/:sessionId - Analyze specific session');
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});