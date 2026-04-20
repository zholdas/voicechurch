import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import * as db from '../db/index.js';

export interface AnalysisResult {
  summary: string;
  actionItems: string[];
  keyDecisions: string[];
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

export function isAnalysisConfigured(): boolean {
  return !!config.anthropic.apiKey;
}

export async function analyzeTranscript(
  transcripts: Array<{ source: string; translations: Record<string, string> }>
): Promise<AnalysisResult> {
  const anthropic = getClient();

  // Build transcript text from source
  const transcriptText = transcripts.map(t => t.source).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a meeting analyst. Analyze this transcript and provide a structured analysis.

Transcript:
${transcriptText}

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"summary":"A concise summary in 3-5 sentences","actionItems":["Task 1","Task 2"],"keyDecisions":["Decision 1","Decision 2"]}

Important:
- Respond in the same language as the transcript
- If no action items or decisions are found, use empty arrays
- Keep the summary concise but informative`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const result = JSON.parse(text);
    return {
      summary: result.summary || '',
      actionItems: result.actionItems || [],
      keyDecisions: result.keyDecisions || [],
    };
  } catch {
    // If JSON parsing fails, use the raw text as summary
    return {
      summary: text,
      actionItems: [],
      keyDecisions: [],
    };
  }
}

export async function analyzeAndSave(
  broadcastLogId: string,
  transcripts: Array<{ source: string; translations: Record<string, string> }>
): Promise<void> {
  if (!isAnalysisConfigured()) {
    console.log('AI analysis skipped: ANTHROPIC_API_KEY not configured');
    return;
  }

  if (transcripts.length === 0) {
    return;
  }

  console.log(`Starting AI analysis for broadcast ${broadcastLogId} (${transcripts.length} transcripts)`);

  try {
    const result = await analyzeTranscript(transcripts);
    db.updateBroadcastLogAnalysis(broadcastLogId, JSON.stringify(result));
    console.log(`AI analysis completed for broadcast ${broadcastLogId}`);
  } catch (error) {
    console.error(`AI analysis failed for broadcast ${broadcastLogId}:`, error);
  }
}
