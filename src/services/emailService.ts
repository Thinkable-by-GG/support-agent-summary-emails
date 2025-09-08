import * as nodemailer from 'nodemailer';
import { Insights } from './insightsService';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendInsightsEmail(insights: Insights, htmlContent: string): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.EMAIL_TO,
      subject: `Support Bot Analytics Report - ${new Date().toLocaleDateString()}`,
      text: this.generateTextVersion(insights),
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendAIAnalysisEmail(htmlContent: string, period?: string): Promise<void> {
    const subject = period ? 
      `🤖 AI Conversation Analysis - ${period} - ${new Date().toLocaleDateString()}` :
      `🤖 AI Conversation Analysis - ${new Date().toLocaleDateString()}`;
      
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.EMAIL_TO,
      subject: subject,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('AI Analysis email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Error sending AI analysis email:', error);
      throw error;
    }
  }

  private generateTextVersion(insights: Insights): string {
    let text = 'SUPPORT BOT ANALYTICS REPORT\n\n';
    
    text += insights.summary + '\n\n';
    
    text += 'KEY METRICS:\n';
    insights.keyMetrics.forEach(metric => {
      text += `- ${metric.name}: ${metric.value}`;
      if (metric.change) text += ` (${metric.change})`;
      text += '\n';
    });
    
    if (insights.alerts.length > 0) {
      text += '\nALERTS:\n';
      insights.alerts.forEach(alert => {
        text += `- [${alert.severity.toUpperCase()}] ${alert.message}\n`;
      });
    }
    
    text += '\nRECOMMENDATIONS:\n';
    insights.recommendations.forEach(rec => {
      text += `- ${rec}\n`;
    });
    
    return text;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}