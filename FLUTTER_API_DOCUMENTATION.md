# Flutter App Integration Guide - Support Agent Analytics API

## Overview
This guide provides detailed instructions for integrating your Flutter app with the Support Agent Analytics API. The API analyzes chat conversations between users and the AI support bot, providing insights and reports.

## Base URL
```
https://moments.thinkable.app/support
```

## Available Endpoints

### 1. Health Check
Verify the service is running and accessible.

**Endpoint:** `GET /health`

**Flutter Implementation:**
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class SupportAnalyticsService {
  static const String baseUrl = 'https://moments.thinkable.app/support';
  
  Future<bool> checkServiceHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/health'),
      );
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['status'] == 'healthy';
      }
      return false;
    } catch (e) {
      print('Health check failed: $e');
      return false;
    }
  }
}
```

### 2. Trigger AI Analysis (Primary Endpoint)
Analyze conversations from the last N hours using OpenAI GPT-4o.

**Endpoint:** `GET /analyze/ai?hours={number}`

**Parameters:**
- `hours` (optional): Number of hours to look back (default: 24, recommended: 96 for 4 days)

**Response Format:**
```json
{
  "success": true,
  "sessionsAnalyzed": 7,
  "period": "last 96 hours",
  "analysis": {
    "totalSessions": 7,
    "analysisDate": "2025-09-07T14:28:21.848Z",
    "commonFirstRequests": [...],
    "conversationPatterns": [...],
    "endingPatterns": [...],
    "topImprovements": [...],
    "problemTypeDistribution": [...],
    "conversationTranscripts": [...]
  },
  "report": "<HTML formatted report>"
}
```

**Flutter Implementation:**
```dart
class ConversationAnalysis {
  final bool success;
  final int sessionsAnalyzed;
  final String period;
  final Map<String, dynamic>? analysis;
  final String? htmlReport;
  
  ConversationAnalysis({
    required this.success,
    required this.sessionsAnalyzed,
    required this.period,
    this.analysis,
    this.htmlReport,
  });
  
  factory ConversationAnalysis.fromJson(Map<String, dynamic> json) {
    return ConversationAnalysis(
      success: json['success'] ?? false,
      sessionsAnalyzed: json['sessionsAnalyzed'] ?? 0,
      period: json['period'] ?? '',
      analysis: json['analysis'],
      htmlReport: json['report'],
    );
  }
}

class SupportAnalyticsService {
  static const String baseUrl = 'https://moments.thinkable.app/support';
  
  /// Trigger AI analysis for conversations
  /// [hours] - Number of hours to analyze (default: 24, recommended: 96 for 4 days)
  Future<ConversationAnalysis?> triggerAIAnalysis({int hours = 96}) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/analyze/ai?hours=$hours'),
        headers: {
          'Content-Type': 'application/json',
        },
      );
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return ConversationAnalysis.fromJson(data);
      } else if (response.statusCode == 503) {
        print('OpenAI service not available');
        return null;
      } else {
        print('Analysis failed: ${response.body}');
        return null;
      }
    } catch (e) {
      print('Error triggering analysis: $e');
      return null;
    }
  }
}
```

### 3. Analyze Specific Session
Get detailed AI analysis for a single chat session.

**Endpoint:** `POST /analyze/ai/session/{sessionId}`

**Flutter Implementation:**
```dart
class SessionAnalysis {
  final String sessionId;
  final Map<String, dynamic> analysis;
  
  SessionAnalysis({
    required this.sessionId,
    required this.analysis,
  });
  
  factory SessionAnalysis.fromJson(Map<String, dynamic> json) {
    return SessionAnalysis(
      sessionId: json['sessionId'] ?? '',
      analysis: json['analysis'] ?? {},
    );
  }
}

extension SupportAnalyticsServiceExtension on SupportAnalyticsService {
  /// Analyze a specific chat session
  /// [sessionId] - The Firebase session document ID (e.g., "chat_1757226286764-3099")
  Future<SessionAnalysis?> analyzeSession(String sessionId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/analyze/ai/session/$sessionId'),
        headers: {
          'Content-Type': 'application/json',
        },
      );
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          return SessionAnalysis.fromJson(data);
        }
      } else if (response.statusCode == 404) {
        print('Session not found: $sessionId');
      } else if (response.statusCode == 503) {
        print('OpenAI service not available');
      }
      return null;
    } catch (e) {
      print('Error analyzing session: $e');
      return null;
    }
  }
}
```

### 4. Quick Analysis Endpoints
For simpler time-based analysis without AI insights.

**Endpoints:**
- `GET /analyze/daily` - Last 24 hours
- `GET /analyze/weekly` - Last 7 days  
- `GET /analyze/monthly` - Last 30 days

**Flutter Implementation:**
```dart
extension QuickAnalysis on SupportAnalyticsService {
  Future<Map<String, dynamic>?> getDailyAnalysis() async {
    return _getQuickAnalysis('daily');
  }
  
  Future<Map<String, dynamic>?> getWeeklyAnalysis() async {
    return _getQuickAnalysis('weekly');
  }
  
  Future<Map<String, dynamic>?> getMonthlyAnalysis() async {
    return _getQuickAnalysis('monthly');
  }
  
  Future<Map<String, dynamic>?> _getQuickAnalysis(String period) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/analyze/$period'),
      );
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
      return null;
    } catch (e) {
      print('Quick analysis failed: $e');
      return null;
    }
  }
}
```

## Complete Flutter Service Implementation

Here's a complete service class for your Flutter app:

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/material.dart';

/// Main service class for Support Agent Analytics API
class SupportAnalyticsService {
  static const String baseUrl = 'https://moments.thinkable.app/support';
  
  // Singleton pattern
  static final SupportAnalyticsService _instance = SupportAnalyticsService._internal();
  factory SupportAnalyticsService() => _instance;
  SupportAnalyticsService._internal();
  
  /// Check if the analytics service is available
  Future<bool> isServiceAvailable() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/health'),
      ).timeout(const Duration(seconds: 5));
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['status'] == 'healthy';
      }
      return false;
    } catch (e) {
      debugPrint('Service health check failed: $e');
      return false;
    }
  }
  
  /// Request AI analysis for recent conversations
  /// Returns analysis data including insights and HTML report
  Future<AnalysisResult?> requestAIAnalysis({
    int hours = 96, // Default to 4 days
    bool sendEmail = true, // Email will be sent automatically if configured
  }) async {
    try {
      debugPrint('Requesting AI analysis for last $hours hours...');
      
      final response = await http.get(
        Uri.parse('$baseUrl/analyze/ai?hours=$hours'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(minutes: 2)); // AI analysis can take time
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          debugPrint('Analysis complete: ${data['sessionsAnalyzed']} sessions analyzed');
          return AnalysisResult.fromJson(data);
        } else {
          debugPrint('Analysis failed: ${data['error']}');
        }
      } else if (response.statusCode == 503) {
        debugPrint('OpenAI service is not available');
      } else {
        debugPrint('Unexpected response: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error requesting analysis: $e');
    }
    return null;
  }
  
  /// Get analysis for a specific chat session
  Future<SessionAnalysisResult?> analyzeSpecificSession(String sessionId) async {
    try {
      debugPrint('Analyzing session: $sessionId');
      
      final response = await http.post(
        Uri.parse('$baseUrl/analyze/ai/session/$sessionId'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 30));
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          return SessionAnalysisResult.fromJson(data);
        }
      } else if (response.statusCode == 404) {
        debugPrint('Session not found: $sessionId');
      }
    } catch (e) {
      debugPrint('Error analyzing session: $e');
    }
    return null;
  }
  
  /// Get quick daily analysis (non-AI)
  Future<QuickAnalysisResult?> getDailyAnalysis() async {
    return _getQuickAnalysis('daily', 24);
  }
  
  /// Get quick weekly analysis (non-AI)
  Future<QuickAnalysisResult?> getWeeklyAnalysis() async {
    return _getQuickAnalysis('weekly', 168);
  }
  
  /// Get quick monthly analysis (non-AI)
  Future<QuickAnalysisResult?> getMonthlyAnalysis() async {
    return _getQuickAnalysis('monthly', 720);
  }
  
  Future<QuickAnalysisResult?> _getQuickAnalysis(String period, int hours) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/analyze/$period'),
      ).timeout(const Duration(seconds: 10));
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          return QuickAnalysisResult.fromJson(data);
        }
      }
    } catch (e) {
      debugPrint('Quick analysis failed: $e');
    }
    return null;
  }
}

/// Model for AI analysis results
class AnalysisResult {
  final bool success;
  final int sessionsAnalyzed;
  final String period;
  final AnalysisData? analysis;
  final String? htmlReport;
  
  AnalysisResult({
    required this.success,
    required this.sessionsAnalyzed,
    required this.period,
    this.analysis,
    this.htmlReport,
  });
  
  factory AnalysisResult.fromJson(Map<String, dynamic> json) {
    return AnalysisResult(
      success: json['success'] ?? false,
      sessionsAnalyzed: json['sessionsAnalyzed'] ?? 0,
      period: json['period'] ?? '',
      analysis: json['analysis'] != null 
        ? AnalysisData.fromJson(json['analysis']) 
        : null,
      htmlReport: json['report'],
    );
  }
}

/// Detailed analysis data
class AnalysisData {
  final int totalSessions;
  final DateTime analysisDate;
  final List<dynamic> commonFirstRequests;
  final List<dynamic> conversationPatterns;
  final List<dynamic> endingPatterns;
  final List<ImprovementSuggestion> topImprovements;
  final List<dynamic> problemTypeDistribution;
  
  AnalysisData({
    required this.totalSessions,
    required this.analysisDate,
    required this.commonFirstRequests,
    required this.conversationPatterns,
    required this.endingPatterns,
    required this.topImprovements,
    required this.problemTypeDistribution,
  });
  
  factory AnalysisData.fromJson(Map<String, dynamic> json) {
    return AnalysisData(
      totalSessions: json['totalSessions'] ?? 0,
      analysisDate: DateTime.parse(json['analysisDate']),
      commonFirstRequests: json['commonFirstRequests'] ?? [],
      conversationPatterns: json['conversationPatterns'] ?? [],
      endingPatterns: json['endingPatterns'] ?? [],
      topImprovements: (json['topImprovements'] as List?)
        ?.map((item) => ImprovementSuggestion.fromJson(item))
        .toList() ?? [],
      problemTypeDistribution: json['problemTypeDistribution'] ?? [],
    );
  }
}

/// Improvement suggestion model
class ImprovementSuggestion {
  final String category;
  final String issue;
  final String suggestion;
  final String priority;
  final List<String> examples;
  
  ImprovementSuggestion({
    required this.category,
    required this.issue,
    required this.suggestion,
    required this.priority,
    required this.examples,
  });
  
  factory ImprovementSuggestion.fromJson(Map<String, dynamic> json) {
    return ImprovementSuggestion(
      category: json['category'] ?? '',
      issue: json['issue'] ?? '',
      suggestion: json['suggestion'] ?? '',
      priority: json['priority'] ?? 'medium',
      examples: List<String>.from(json['examples'] ?? []),
    );
  }
}

/// Session-specific analysis result
class SessionAnalysisResult {
  final String sessionId;
  final Map<String, dynamic> analysis;
  
  SessionAnalysisResult({
    required this.sessionId,
    required this.analysis,
  });
  
  factory SessionAnalysisResult.fromJson(Map<String, dynamic> json) {
    return SessionAnalysisResult(
      sessionId: json['sessionId'] ?? '',
      analysis: json['analysis'] ?? {},
    );
  }
}

/// Quick analysis result (non-AI)
class QuickAnalysisResult {
  final bool success;
  final String period;
  final Map<String, dynamic> insights;
  
  QuickAnalysisResult({
    required this.success,
    required this.period,
    required this.insights,
  });
  
  factory QuickAnalysisResult.fromJson(Map<String, dynamic> json) {
    return QuickAnalysisResult(
      success: json['success'] ?? false,
      period: json['period'] ?? '',
      insights: json['insights'] ?? {},
    );
  }
}
```

## Usage Example in Flutter App

```dart
import 'package:flutter/material.dart';
import 'package:your_app/services/support_analytics_service.dart';

class AnalyticsScreen extends StatefulWidget {
  @override
  _AnalyticsScreenState createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  final SupportAnalyticsService _analyticsService = SupportAnalyticsService();
  bool _isLoading = false;
  AnalysisResult? _analysisResult;
  
  @override
  void initState() {
    super.initState();
    _checkServiceHealth();
  }
  
  Future<void> _checkServiceHealth() async {
    final isAvailable = await _analyticsService.isServiceAvailable();
    if (!isAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Analytics service is currently unavailable')),
      );
    }
  }
  
  Future<void> _requestAnalysis() async {
    setState(() {
      _isLoading = true;
    });
    
    try {
      // Request AI analysis for last 4 days
      final result = await _analyticsService.requestAIAnalysis(hours: 96);
      
      setState(() {
        _analysisResult = result;
        _isLoading = false;
      });
      
      if (result != null && result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Analysis complete: ${result.sessionsAnalyzed} sessions analyzed'),
            backgroundColor: Colors.green,
          ),
        );
        
        // Show HTML report in a WebView or display insights
        _showAnalysisResults(result);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Analysis failed. Please try again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  
  void _showAnalysisResults(AnalysisResult result) {
    // Display analysis results in your UI
    // You can show the HTML report in a WebView:
    // Navigator.push(
    //   context,
    //   MaterialPageRoute(
    //     builder: (context) => WebViewScreen(html: result.htmlReport),
    //   ),
    // );
    
    // Or display the structured data:
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Analysis Results'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Sessions Analyzed: ${result.sessionsAnalyzed}'),
              Text('Period: ${result.period}'),
              if (result.analysis != null) ...[
                SizedBox(height: 10),
                Text('Total Sessions: ${result.analysis!.totalSessions}'),
                SizedBox(height: 10),
                Text('Top Improvements:'),
                ...result.analysis!.topImprovements.map((improvement) => 
                  Padding(
                    padding: EdgeInsets.only(left: 16, top: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('• ${improvement.issue}', 
                          style: TextStyle(fontWeight: FontWeight.bold)),
                        Text('  ${improvement.suggestion}',
                          style: TextStyle(fontSize: 12)),
                        Text('  Priority: ${improvement.priority}',
                          style: TextStyle(
                            fontSize: 11,
                            color: improvement.priority == 'high' 
                              ? Colors.red 
                              : improvement.priority == 'medium'
                                ? Colors.orange
                                : Colors.green,
                          )),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Close'),
          ),
        ],
      ),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Support Analytics'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_isLoading)
              CircularProgressIndicator()
            else
              ElevatedButton.icon(
                onPressed: _requestAnalysis,
                icon: Icon(Icons.analytics),
                label: Text('Run AI Analysis'),
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                ),
              ),
            
            SizedBox(height: 20),
            
            if (_analysisResult != null && _analysisResult!.success)
              Card(
                margin: EdgeInsets.all(16),
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        'Last Analysis',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      SizedBox(height: 8),
                      Text('Sessions: ${_analysisResult!.sessionsAnalyzed}'),
                      Text('Period: ${_analysisResult!.period}'),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
```

## WebView Implementation for HTML Reports

To display the HTML reports in your Flutter app:

```dart
import 'package:webview_flutter/webview_flutter.dart';

class AnalysisReportWebView extends StatefulWidget {
  final String htmlContent;
  
  const AnalysisReportWebView({Key? key, required this.htmlContent}) : super(key: key);
  
  @override
  _AnalysisReportWebViewState createState() => _AnalysisReportWebViewState();
}

class _AnalysisReportWebViewState extends State<AnalysisReportWebView> {
  late final WebViewController _controller;
  
  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..loadHtmlString(widget.htmlContent);
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Analysis Report'),
        actions: [
          IconButton(
            icon: Icon(Icons.share),
            onPressed: () {
              // Implement sharing functionality
            },
          ),
        ],
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
```

## Required Flutter Packages

Add these to your `pubspec.yaml`:

```yaml
dependencies:
  http: ^1.1.0
  webview_flutter: ^4.4.2
```

## Error Handling Best Practices

```dart
class AnalyticsErrorHandler {
  static void handleError(dynamic error, BuildContext context) {
    String message = 'An unexpected error occurred';
    
    if (error is http.ClientException) {
      message = 'Network error. Please check your connection.';
    } else if (error is TimeoutException) {
      message = 'Request timed out. Please try again.';
    } else if (error is FormatException) {
      message = 'Invalid response format from server.';
    }
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        action: SnackBarAction(
          label: 'Retry',
          textColor: Colors.white,
          onPressed: () {
            // Retry logic
          },
        ),
      ),
    );
  }
}
```

## Testing the Integration

```dart
// Test file: test/services/support_analytics_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:your_app/services/support_analytics_service.dart';

void main() {
  group('SupportAnalyticsService', () {
    late SupportAnalyticsService service;
    
    setUp(() {
      service = SupportAnalyticsService();
    });
    
    test('Service health check', () async {
      final isHealthy = await service.isServiceAvailable();
      expect(isHealthy, isTrue);
    });
    
    test('Request AI analysis', () async {
      final result = await service.requestAIAnalysis(hours: 24);
      expect(result, isNotNull);
      expect(result!.success, isTrue);
    });
  });
}
```

## Important Notes

1. **Authentication**: The current API doesn't require authentication, but you should implement proper security measures if sensitive data is involved.

2. **Rate Limiting**: Be mindful of API usage. The AI analysis endpoint uses OpenAI GPT-4o which has costs associated. Implement appropriate rate limiting in your app.

3. **Email Reports**: When you call the AI analysis endpoint, it automatically sends email reports to the configured email address (support@ggtude.com) if the server is properly configured.

4. **Scheduled Analysis**: The server automatically runs analysis twice weekly (Monday and Thursday at 9 AM). Your app doesn't need to trigger this.

5. **Session IDs**: Session IDs follow the format `chat_[timestamp]-[random]` as created by your Flutter app when initiating chat sessions.

6. **Error Handling**: Always implement proper error handling and user feedback for network failures or service unavailability.

7. **Caching**: Consider implementing local caching of analysis results to reduce unnecessary API calls.

## Support

For issues or questions about the API:
- Repository: https://github.com/Thinkable-by-GG/support-agent-summary-emails
- Email: support@ggtude.com