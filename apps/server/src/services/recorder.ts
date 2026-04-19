import { uploadToR2, isR2Configured } from './r2.js';
import * as db from '../db/index.js';
import type { LanguageCode } from '../websocket/types.js';
// @ts-ignore — lamejs has no type declarations
import lamejs from 'lamejs';

interface TranscriptEntry {
  timestamp: number;
  source: string;
  translations: Record<string, string>;
}

interface ActiveRecording {
  broadcastLogId: string;
  hasDbLog: boolean; // true if broadcastLogId exists in broadcast_logs table
  audioChunks: Buffer[];
  totalAudioBytes: number;
  transcripts: TranscriptEntry[];
  startedAt: number;
}

const MAX_AUDIO_BYTES = 120 * 1024 * 1024; // 120MB limit (~60 min of 16kHz PCM)

const recordings = new Map<string, ActiveRecording>();

export function startRecording(roomId: string, broadcastLogId: string, hasDbLog: boolean = false): void {
  if (recordings.has(roomId)) {
    console.warn(`Recording already active for room ${roomId}`);
    return;
  }

  recordings.set(roomId, {
    broadcastLogId,
    hasDbLog,
    audioChunks: [],
    totalAudioBytes: 0,
    transcripts: [],
    startedAt: Date.now(),
  });

  console.log(`Recording started for room ${roomId} (broadcast: ${broadcastLogId})`);
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

  console.log(`Finalizing recording for room ${roomId}: ${audioChunks.length} audio chunks, ${transcripts.length} transcripts`);

  // Save transcripts to DB (only if we have a real broadcast log)
  if (transcripts.length > 0 && recording.hasDbLog) {
    try {
      db.saveTranscripts(broadcastLogId, transcripts.map(t => ({
        timestamp: t.timestamp,
        sourceText: t.source,
        translations: JSON.stringify(t.translations),
      })));
      db.updateBroadcastLogRecording(broadcastLogId, null, transcripts.length);
      console.log(`Saved ${transcripts.length} transcripts for broadcast ${broadcastLogId}`);
    } catch (error) {
      console.error(`Failed to save transcripts for broadcast ${broadcastLogId}:`, error);
    }
  } else if (transcripts.length > 0) {
    console.log(`Skipped saving ${transcripts.length} transcripts (no DB log for ${broadcastLogId})`);
  }

  // Upload audio to R2
  if (audioChunks.length > 0 && isR2Configured()) {
    try {
      const pcmBuffer = Buffer.concat(audioChunks);
      const mp3Buffer = pcmToMp3(pcmBuffer, 16000, 1);

      const key = `recordings/${broadcastLogId}.mp3`;
      await uploadToR2(key, mp3Buffer, 'audio/mpeg');

      if (recording.hasDbLog) {
        db.updateBroadcastLogRecording(broadcastLogId, key, transcripts.length);
      }
      console.log(`Uploaded audio for broadcast ${broadcastLogId} (${(mp3Buffer.length / 1024 / 1024).toFixed(1)}MB MP3, from ${(pcmBuffer.length / 1024 / 1024).toFixed(1)}MB PCM)`);
    } catch (error) {
      console.error(`Failed to upload audio for broadcast ${broadcastLogId}:`, error);
    }
  }
}

export function isRecording(roomId: string): boolean {
  return recordings.has(roomId);
}

// Convert raw PCM (16-bit signed LE) to MP3 using lamejs
function pcmToMp3(pcmData: Buffer, sampleRate: number, channels: number): Buffer {
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 64); // 64kbps

  // Convert Buffer to Int16Array
  const samples = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);

  const mp3Parts: Buffer[] = [];
  const blockSize = 1152; // lamejs recommended block size

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Parts.push(Buffer.from(mp3buf));
    }
  }

  // Flush remaining
  const end = mp3encoder.flush();
  if (end.length > 0) {
    mp3Parts.push(Buffer.from(end));
  }

  return Buffer.concat(mp3Parts);
}
