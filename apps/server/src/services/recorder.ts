import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { uploadToR2, isR2Configured } from './r2.js';
import * as db from '../db/index.js';
import type { LanguageCode } from '../websocket/types.js';

const execFileAsync = promisify(execFile);

interface TranscriptEntry {
  timestamp: number;
  source: string;
  translations: Record<string, string>;
}

interface ActiveRecording {
  broadcastLogId: string;
  hasDbLog: boolean;
  sessionId: string | null; // new sessions table
  audioChunks: Buffer[];
  totalAudioBytes: number;
  transcripts: TranscriptEntry[];
  startedAt: number;
  roomName: string;
  sourceLanguage: string;
  transcriptAccess: string;
}

const MAX_AUDIO_BYTES = 120 * 1024 * 1024; // 120MB limit (~60 min of 16kHz PCM)

const recordings = new Map<string, ActiveRecording>();

export function startRecording(roomId: string, broadcastLogId: string, hasDbLog: boolean = false, options?: {
  roomName?: string;
  sourceLanguage?: string;
  transcriptAccess?: string;
  userId?: string | null;
}): void {
  if (recordings.has(roomId)) {
    console.warn(`Recording already active for room ${roomId}`);
    return;
  }

  const roomName = options?.roomName || 'Broadcast';
  const sourceLanguage = options?.sourceLanguage || 'en';
  const transcriptAccess = options?.transcriptAccess || 'owner';

  // Create session
  let sessionId: string | null = null;
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const sessionName = `${roomName} — ${dateStr} ${timeStr}`;
    const sessionSlug = `${roomName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const session = db.createSession({
      roomId,
      userId: options?.userId || null,
      name: sessionName,
      slug: sessionSlug,
      sourceLanguage,
    });
    sessionId = session.id;
    console.log(`Session created: ${sessionName} (${sessionSlug})`);
  } catch (error) {
    console.error(`Failed to create session for room ${roomId}:`, error);
  }

  recordings.set(roomId, {
    broadcastLogId,
    hasDbLog,
    sessionId,
    audioChunks: [],
    totalAudioBytes: 0,
    transcripts: [],
    startedAt: Date.now(),
    roomName,
    sourceLanguage,
    transcriptAccess,
  });

  console.log(`Recording started for room ${roomId} (broadcast: ${broadcastLogId}, session: ${sessionId})`);
}

export function writeAudioChunk(roomId: string, data: Buffer): void {
  const recording = recordings.get(roomId);
  if (!recording) return;

  // Skip if we've hit the memory limit
  if (recording.totalAudioBytes >= MAX_AUDIO_BYTES) return;

  recording.audioChunks.push(data);
  recording.totalAudioBytes += data.length;
}

export function addTranscript(
  roomId: string,
  source: string,
  translations: Map<LanguageCode, { translated: string; audio?: string }>
): void {
  const recording = recordings.get(roomId);
  if (!recording) return;

  const translationsObj: Record<string, string> = {};
  for (const [lang, { translated }] of translations) {
    translationsObj[lang] = translated;
  }

  recording.transcripts.push({
    timestamp: Date.now(),
    source,
    translations: translationsObj,
  });
}

export async function finalize(roomId: string): Promise<void> {
  const recording = recordings.get(roomId);
  if (!recording) return;

  recordings.delete(roomId);

  const { broadcastLogId, audioChunks, transcripts } = recording;

  const { sessionId } = recording;

  console.log(`Finalizing recording for room ${roomId}: ${audioChunks.length} audio chunks, ${transcripts.length} transcripts, session: ${sessionId}`);

  // Save transcripts to old broadcast_logs system (backward compat)
  if (transcripts.length > 0 && recording.hasDbLog) {
    try {
      db.saveTranscripts(broadcastLogId, transcripts.map(t => ({
        timestamp: t.timestamp,
        sourceText: t.source,
        translations: JSON.stringify(t.translations),
      })));
      db.updateBroadcastLogRecording(broadcastLogId, null, transcripts.length);
    } catch (error) {
      console.error(`Failed to save transcripts for broadcast ${broadcastLogId}:`, error);
    }
  }

  // Create verbatim transcript entity
  if (transcripts.length > 0 && sessionId) {
    try {
      const session = db.getSessionById(sessionId);
      const verbatimContent = JSON.stringify({
        segments: transcripts.map(t => ({
          timestamp: t.timestamp,
          source: t.source,
          sourceLanguage: recording.sourceLanguage,
          translations: t.translations,
        })),
      });

      db.createTranscript({
        sessionId,
        type: 'verbatim',
        language: 'multi',
        content: verbatimContent,
        slug: `${session?.slug || sessionId}-verbatim`,
        access: recording.transcriptAccess,
      });
      console.log(`Verbatim transcript created for session ${sessionId}`);
    } catch (error) {
      console.error(`Failed to create verbatim transcript:`, error);
    }
  }

  // Run AI analysis → create summary transcript (async, non-blocking)
  if (transcripts.length > 0) {
    const saveAnalysis = async () => {
      try {
        const { analyzeTranscript, isAnalysisConfigured } = await import('./ai-analysis.js');
        if (!isAnalysisConfigured()) return;

        const result = await analyzeTranscript(transcripts);

        // Save to old broadcast_logs (backward compat)
        if (recording.hasDbLog) {
          db.updateBroadcastLogAnalysis(broadcastLogId, JSON.stringify(result));
        }

        // Create summary transcript entity
        if (sessionId) {
          const session = db.getSessionById(sessionId);
          db.createTranscript({
            sessionId,
            type: 'summary',
            language: recording.sourceLanguage,
            content: JSON.stringify(result),
            slug: `${session?.slug || sessionId}-summary-${recording.sourceLanguage}`,
            access: recording.transcriptAccess,
          });
          db.updateSessionStatus(sessionId, 'complete');
          console.log(`Summary transcript created for session ${sessionId}`);
        }
      } catch (error) {
        console.error(`AI analysis failed:`, error);
        if (sessionId) db.updateSessionStatus(sessionId, 'complete');
      }
    };
    saveAnalysis();
  } else if (sessionId) {
    db.updateSessionStatus(sessionId, 'complete');
  }

  // Upload audio to R2
  if (audioChunks.length > 0 && isR2Configured()) {
    try {
      const pcmBuffer = Buffer.concat(audioChunks);
      const mp3Buffer = await pcmToMp3(pcmBuffer, 16000);

      const ext = mp3Buffer ? 'mp3' : 'wav';
      const contentType = mp3Buffer ? 'audio/mpeg' : 'audio/wav';
      const uploadBuffer = mp3Buffer || pcmToWav(pcmBuffer, 16000, 1, 16);

      const key = `recordings/${broadcastLogId}.${ext}`;
      await uploadToR2(key, uploadBuffer, contentType);

      if (recording.hasDbLog) {
        db.updateBroadcastLogRecording(broadcastLogId, key, transcripts.length);
      }
      if (sessionId) {
        db.updateSessionAudio(sessionId, key);
      }
      console.log(`Uploaded audio (${(uploadBuffer.length / 1024 / 1024).toFixed(1)}MB ${ext.toUpperCase()})`);
    } catch (error) {
      console.error(`Failed to upload audio:`, error);
    }
  }

  // End session
  if (sessionId) {
    db.endSession(sessionId, 0); // peak listeners updated separately
  }
}

export function isRecording(roomId: string): boolean {
  return recordings.has(roomId);
}

// Convert raw PCM to MP3 using system ffmpeg. Returns null if ffmpeg not available.
async function pcmToMp3(pcmData: Buffer, sampleRate: number): Promise<Buffer | null> {
  const pcmPath = join(tmpdir(), `rec-${Date.now()}.pcm`);
  const mp3Path = join(tmpdir(), `rec-${Date.now()}.mp3`);

  try {
    await writeFile(pcmPath, pcmData);
    await execFileAsync('ffmpeg', [
      '-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', pcmPath,
      '-codec:a', 'libmp3lame', '-b:a', '64k', '-y', mp3Path,
    ], { timeout: 120000 });
    const { readFile } = await import('fs/promises');
    const mp3Buffer = await readFile(mp3Path);
    console.log(`ffmpeg: converted ${(pcmData.length / 1024 / 1024).toFixed(1)}MB PCM → ${(mp3Buffer.length / 1024 / 1024).toFixed(1)}MB MP3`);
    return mp3Buffer;
  } catch (error) {
    console.warn('ffmpeg not available, falling back to WAV:', (error as Error).message);
    return null;
  } finally {
    await unlink(pcmPath).catch(() => {});
    await unlink(mp3Path).catch(() => {});
  }
}

// Convert raw PCM to WAV format (fallback when ffmpeg not available)
function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmData.copy(wav, 44);
  return wav;
}
