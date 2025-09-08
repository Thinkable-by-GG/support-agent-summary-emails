import { Analytics, ChatLog } from './analyticsService';

export interface Insights {
  summary: string;
  keyMetrics: KeyMetric[];
  alerts: Alert[];
  recommendations: string[];
  trendsAnalysis: string;
  performanceHighlights: string[];
}

interface KeyMetric {
  name: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
}

interface Alert {
  severity: 'high' | 'medium' | 'low';
  message: string;
  metric?: string;
  value?: number;
}

export class InsightsService {
  
  generateInsights(analytics: Analytics, previousAnalytics?: Analytics): Insights {
    const keyMetrics = this.generateKeyMetrics(analytics, previousAnalytics);
    const alerts = this.generateAlerts(analytics);
    const recommendations = this.generateRecommendations(analytics);
    const trendsAnalysis = this.analyzeTrends(analytics);
    const performanceHighlights = this.getPerformanceHighlights(analytics);
    const summary = this.generateSummary(analytics, keyMetrics);

    return {
      summary,
      keyMetrics,
      alerts,
      recommendations,
      trendsAnalysis,
      performanceHighlights
    };
  }

  private generateKeyMetrics(analytics: Analytics, previous?: Analytics): KeyMetric[] {
    const metrics: KeyMetric[] = [];

    metrics.push({
      name: 'Total Conversations',
      value: analytics.totalConversations,
      change: previous ? this.calculateChange(analytics.totalConversations, previous.totalConversations) : undefined,
      trend: previous ? this.getTrend(analytics.totalConversations, previous.totalConversations) : undefined
    });

    metrics.push({
      name: 'Active Users',
      value: analytics.uniqueUsers,
      change: previous ? this.calculateChange(analytics.uniqueUsers, previous.uniqueUsers) : undefined,
      trend: previous ? this.getTrend(analytics.uniqueUsers, previous.uniqueUsers) : undefined
    });

    metrics.push({
      name: 'Resolution Rate',
      value: `${analytics.resolvedRate.toFixed(1)}%`,
      change: previous ? this.calculateChange(analytics.resolvedRate, previous.resolvedRate) : undefined,
      trend: previous ? this.getTrend(analytics.resolvedRate, previous.resolvedRate) : undefined
    });

    metrics.push({
      name: 'Average Rating',
      value: analytics.averageRating.toFixed(2),
      change: previous ? this.calculateChange(analytics.averageRating, previous.averageRating) : undefined,
      trend: previous ? this.getTrend(analytics.averageRating, previous.averageRating) : undefined
    });

    metrics.push({
      name: 'Error Rate',
      value: `${analytics.errorRate.toFixed(1)}%`,
      change: previous ? this.calculateChange(analytics.errorRate, previous.errorRate) : undefined,
      trend: previous ? this.getTrend(analytics.errorRate, previous.errorRate) : 'stable'
    });

    metrics.push({
      name: 'Avg Session Duration',
      value: `${Math.round(analytics.averageSessionDuration / 60)} min`,
      trend: 'stable'
    });

    return metrics;
  }

  private generateAlerts(analytics: Analytics): Alert[] {
    const alerts: Alert[] = [];

    if (analytics.errorRate > 10) {
      alerts.push({
        severity: 'high',
        message: `High error rate detected: ${analytics.errorRate.toFixed(1)}%`,
        metric: 'errorRate',
        value: analytics.errorRate
      });
    }

    if (analytics.resolvedRate < 60) {
      alerts.push({
        severity: 'high',
        message: `Low resolution rate: ${analytics.resolvedRate.toFixed(1)}%`,
        metric: 'resolvedRate',
        value: analytics.resolvedRate
      });
    }

    if (analytics.averageRating < 3 && analytics.averageRating > 0) {
      alerts.push({
        severity: 'medium',
        message: `Low average rating: ${analytics.averageRating.toFixed(2)}/5`,
        metric: 'averageRating',
        value: analytics.averageRating
      });
    }

    if (analytics.userSentiment.negative > 30) {
      alerts.push({
        severity: 'medium',
        message: `High negative sentiment: ${analytics.userSentiment.negative.toFixed(1)}%`,
        metric: 'sentiment',
        value: analytics.userSentiment.negative
      });
    }

    if (analytics.responseTimeAnalysis.p95 > 5000) {
      alerts.push({
        severity: 'low',
        message: `Slow response times - P95: ${(analytics.responseTimeAnalysis.p95 / 1000).toFixed(1)}s`,
        metric: 'responseTime',
        value: analytics.responseTimeAnalysis.p95
      });
    }

    const peakHour = analytics.hourlyDistribution.reduce((max, hour) => 
      hour.count > max.count ? hour : max, analytics.hourlyDistribution[0]);
    
    if (peakHour && peakHour.count > analytics.totalConversations * 0.15) {
      alerts.push({
        severity: 'low',
        message: `High traffic concentration at ${peakHour.hour}:00 (${peakHour.count} conversations)`,
        metric: 'trafficPeak',
        value: peakHour.count
      });
    }

    return alerts;
  }

  private generateRecommendations(analytics: Analytics): string[] {
    const recommendations: string[] = [];

    if (analytics.errorRate > 5) {
      recommendations.push('Investigate and fix the top error patterns to improve user experience');
    }

    if (analytics.resolvedRate < 70) {
      recommendations.push('Review unresolved conversations to identify gaps in bot knowledge');
    }

    if (analytics.commonIssues.length > 0) {
      const topIssue = analytics.commonIssues[0];
      recommendations.push(`Create targeted responses for "${topIssue.pattern}" issues (${topIssue.frequency} occurrences)`);
    }

    if (analytics.userSentiment.negative > 25) {
      recommendations.push('Implement sentiment-based escalation to human agents for negative interactions');
    }

    const peakHours = analytics.hourlyDistribution
      .filter(h => h.count > analytics.totalConversations * 0.1)
      .map(h => h.hour);
    
    if (peakHours.length > 0) {
      recommendations.push(`Consider scaling resources during peak hours: ${peakHours.join(', ')}:00`);
    }

    if (analytics.topCategories.length > 0 && analytics.topCategories[0].percentage > 30) {
      recommendations.push(`Enhance bot capabilities for "${analytics.topCategories[0].category}" category (${analytics.topCategories[0].percentage.toFixed(1)}% of queries)`);
    }

    if (analytics.averageSessionDuration > 600) {
      recommendations.push('Long session durations detected - optimize conversation flow for quicker resolutions');
    }

    return recommendations;
  }

  private analyzeTrends(analytics: Analytics): string {
    const trends: string[] = [];

    if (analytics.dailyTrend.length > 7) {
      const lastWeek = analytics.dailyTrend.slice(-7);
      const weeklyAvg = lastWeek.reduce((sum, day) => sum + day.count, 0) / 7;
      const previousWeek = analytics.dailyTrend.slice(-14, -7);
      const prevWeeklyAvg = previousWeek.reduce((sum, day) => sum + day.count, 0) / 7;
      
      if (weeklyAvg > prevWeeklyAvg * 1.2) {
        trends.push(`Traffic increased ${((weeklyAvg / prevWeeklyAvg - 1) * 100).toFixed(0)}% this week`);
      }
    }

    const weekendTraffic = analytics.hourlyDistribution.slice(0, 8).reduce((sum, h) => sum + h.count, 0);
    const weekdayTraffic = analytics.hourlyDistribution.slice(8, 20).reduce((sum, h) => sum + h.count, 0);
    
    if (weekendTraffic > weekdayTraffic * 0.3) {
      trends.push('Significant weekend activity detected');
    }

    if (analytics.topCategories.length >= 2) {
      const topTwo = analytics.topCategories.slice(0, 2);
      trends.push(`Top categories: ${topTwo.map(c => `${c.category} (${c.percentage.toFixed(0)}%)`).join(', ')}`);
    }

    return trends.join('. ') || 'No significant trends detected in the current period.';
  }

  private getPerformanceHighlights(analytics: Analytics): string[] {
    const highlights: string[] = [];

    if (analytics.resolvedRate > 80) {
      highlights.push(`Excellent resolution rate: ${analytics.resolvedRate.toFixed(1)}%`);
    }

    if (analytics.averageRating >= 4) {
      highlights.push(`High user satisfaction: ${analytics.averageRating.toFixed(1)}/5 rating`);
    }

    if (analytics.errorRate < 2) {
      highlights.push(`Low error rate: ${analytics.errorRate.toFixed(1)}%`);
    }

    if (analytics.userSentiment.positive > 60) {
      highlights.push(`Positive user sentiment: ${analytics.userSentiment.positive.toFixed(0)}%`);
    }

    if (analytics.responseTimeAnalysis.median < 1000 && analytics.responseTimeAnalysis.median > 0) {
      highlights.push(`Fast median response time: ${(analytics.responseTimeAnalysis.median / 1000).toFixed(1)}s`);
    }

    return highlights;
  }

  private generateSummary(analytics: Analytics, keyMetrics: KeyMetric[]): string {
    const period = analytics.dailyTrend.length > 0 
      ? `${analytics.dailyTrend[0].date} to ${analytics.dailyTrend[analytics.dailyTrend.length - 1].date}`
      : 'current period';

    let summary = `During ${period}, the support bot handled ${analytics.totalConversations} conversations from ${analytics.uniqueUsers} unique users. `;
    
    summary += `The overall resolution rate was ${analytics.resolvedRate.toFixed(1)}% `;
    
    if (analytics.averageRating > 0) {
      summary += `with an average user rating of ${analytics.averageRating.toFixed(1)}/5. `;
    }

    if (analytics.errorRate > 5) {
      summary += `Note: Error rate is elevated at ${analytics.errorRate.toFixed(1)}%. `;
    }

    const topCategory = analytics.topCategories[0];
    if (topCategory) {
      summary += `The most common query category was "${topCategory.category}" (${topCategory.percentage.toFixed(0)}% of conversations).`;
    }

    return summary;
  }

  private calculateChange(current: number, previous: number): string {
    if (previous === 0) return '+100%';
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  }

  private getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const threshold = 0.05;
    if (current > previous * (1 + threshold)) return 'up';
    if (current < previous * (1 - threshold)) return 'down';
    return 'stable';
  }

  formatInsightsAsHTML(insights: Insights): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        h2 { color: #666; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .metric-name { font-size: 12px; color: #666; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .trend-up { color: #4CAF50; }
        .trend-down { color: #f44336; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .alert-high { background: #ffebee; border-left: 4px solid #f44336; }
        .alert-medium { background: #fff3e0; border-left: 4px solid #ff9800; }
        .alert-low { background: #e3f2fd; border-left: 4px solid #2196F3; }
        .recommendation { background: #e8f5e9; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .highlight { background: #f3e5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Support Bot Analytics Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p>${insights.summary}</p>
    </div>

    <h2>Key Metrics</h2>
    <div class="metrics">
        ${insights.keyMetrics.map(metric => `
            <div class="metric">
                <div class="metric-name">${metric.name}</div>
                <div class="metric-value">
                    ${metric.value}
                    ${metric.trend ? `<span class="trend-${metric.trend}">
                        ${metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                    </span>` : ''}
                </div>
                ${metric.change ? `<div style="font-size: 12px; color: #666;">${metric.change}</div>` : ''}
            </div>
        `).join('')}
    </div>

    ${insights.alerts.length > 0 ? `
        <h2>Alerts</h2>
        ${insights.alerts.map(alert => `
            <div class="alert alert-${alert.severity}">
                <strong>${alert.severity.toUpperCase()}:</strong> ${alert.message}
            </div>
        `).join('')}
    ` : ''}

    ${insights.performanceHighlights.length > 0 ? `
        <h2>Performance Highlights</h2>
        ${insights.performanceHighlights.map(highlight => `
            <div class="highlight">✓ ${highlight}</div>
        `).join('')}
    ` : ''}

    <h2>Recommendations</h2>
    ${insights.recommendations.map(rec => `
        <div class="recommendation">💡 ${rec}</div>
    `).join('')}

    <h2>Trends Analysis</h2>
    <p>${insights.trendsAnalysis}</p>

    <hr style="margin-top: 40px;">
    <p style="font-size: 12px; color: #666;">
        Generated on ${new Date().toLocaleString()}
    </p>
</body>
</html>
    `;

    return html;
  }

  formatInsightsAsText(insights: Insights): string {
    let text = '=== SUPPORT BOT ANALYTICS REPORT ===\n\n';
    
    text += 'SUMMARY\n';
    text += '─'.repeat(50) + '\n';
    text += insights.summary + '\n\n';

    text += 'KEY METRICS\n';
    text += '─'.repeat(50) + '\n';
    insights.keyMetrics.forEach(metric => {
      text += `${metric.name}: ${metric.value}`;
      if (metric.change) text += ` (${metric.change})`;
      if (metric.trend) text += ` ${metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}`;
      text += '\n';
    });
    text += '\n';

    if (insights.alerts.length > 0) {
      text += 'ALERTS\n';
      text += '─'.repeat(50) + '\n';
      insights.alerts.forEach(alert => {
        text += `[${alert.severity.toUpperCase()}] ${alert.message}\n`;
      });
      text += '\n';
    }

    if (insights.performanceHighlights.length > 0) {
      text += 'PERFORMANCE HIGHLIGHTS\n';
      text += '─'.repeat(50) + '\n';
      insights.performanceHighlights.forEach(highlight => {
        text += `✓ ${highlight}\n`;
      });
      text += '\n';
    }

    text += 'RECOMMENDATIONS\n';
    text += '─'.repeat(50) + '\n';
    insights.recommendations.forEach((rec, index) => {
      text += `${index + 1}. ${rec}\n`;
    });
    text += '\n';

    text += 'TRENDS ANALYSIS\n';
    text += '─'.repeat(50) + '\n';
    text += insights.trendsAnalysis + '\n\n';

    text += '─'.repeat(50) + '\n';
    text += `Generated on ${new Date().toLocaleString()}\n`;

    return text;
  }
}