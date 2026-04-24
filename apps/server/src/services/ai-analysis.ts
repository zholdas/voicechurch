import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import * as db from '../db/index.js';

export type TranscriptType = 'summary' | 'meeting_minutes' | 'recap';

export interface AnalysisResult {
  summary?: string;
  actionItems?: string[];
  keyDecisions?: string[];
  // meeting_minutes fields
  agenda?: string[];
  attendeeActions?: Array<{ person: string; action: string }>;
  nextSteps?: string[];
  // recap field
  recap?: string;
  // raw content for flexibility
  [key: string]: unknown;
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

const PROMPTS: Record<TranscriptType, string> = {
  summary: `You are a meeting analyst. Analyze this transcript and provide a structured analysis.

Transcript:
{TEXT}

Respond ONLY with valid JSON (no markdown, no code blocks):
{"summary":"A concise summary in 3-5 sentences","actionItems":["Task 1","Task 2"],"keyDecisions":["Decision 1","Decision 2"]}

Important:
- {LANG_INSTRUCTION}
- If no action items or decisions are found, use empty arrays
- Keep the summary concise but informative`,

  meeting_minutes: `You are a professional meeting secretary. Create formal meeting minutes from this transcript.

Transcript:
{TEXT}

Respond ONLY with valid JSON (no markdown, no code blocks):
{"summary":"Brief overview of the meeting","agenda":["Topic 1 discussed","Topic 2 discussed"],"keyDecisions":["Decision 1","Decision 2"],"attendeeActions":[{"person":"Name or Speaker","action":"What they committed to"}],"nextSteps":["Next step 1","Next step 2"]}

Important:
- {LANG_INSTRUCTION}
- Extract specific commitments with person names when mentioned
- If no specific names are mentioned, use "Speaker" as the person
- Use empty arrays for any section without content`,

  recap: `You are a concise writer. Create an ultra-brief recap of this transcript in 1-2 sentences.

Transcript:
{TEXT}

Respond ONLY with valid JSON (no markdown, no code blocks):
{"recap":"One or two sentence recap of the key point"}

Important:
- {LANG_INSTRUCTION}
- Maximum 2 sentences
- Focus on the single most important takeaway`,
};

export async function analyzeTranscript(
  transcripts: Array<{ source: string; translations: Record<string, string> }>,
  targetLanguage?: string,
  type: TranscriptType = 'summary'
): Promise<AnalysisResult> {
  const anthropic = getClient();

  const transcriptText = targetLanguage
    ? transcripts.map(t => t.translations[targetLanguage] || t.source).join('\n')
    : transcripts.map(t => t.source).join('\n');

  const languageInstruction = targetLanguage
    ? `Respond in ${targetLanguage} language.`
    : `Respond in the same language as the transcript.`;

  const prompt = PROMPTS[type]
    .replace('{TEXT}', transcriptText)
    .replace('{LANG_INSTRUCTION}', languageInstruction);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch {
    return { summary: text };
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

  if (transcripts.length === 0) return;

  console.log(`Starting AI analysis for broadcast ${broadcastLogId} (${transcripts.length} transcripts)`);

  try {
    const result = await analyzeTranscript(transcripts);
    db.updateBroadcastLogAnalysis(broadcastLogId, JSON.stringify(result));
    console.log(`AI analysis completed for broadcast ${broadcastLogId}`);
  } catch (error) {
    console.error(`AI analysis failed for broadcast ${broadcastLogId}:`, error);
  }
}
