import { uploadToR2, isR2Configured } from './r2.js';
import * as db from '../db/index.js';
import type { LanguageCode } from '../websocket/types.js';

interface TranscriptEntry {
  timestamp: number;
  source: string;
  translations: Record<string, string>;
}

interface ActiveRecording {
  broadcastLogId: string;
  audioChunks: Buffer[];
  totalAudioBytes: number;
  transcripts: TranscriptEntry[];
  startedAt: number;
}

const MAX_AUDIO_BYTES = 120 * 1024 * 1024; // 120MB limit (~60 min of 16kHz PCM)

const recordings = new Map<string, ActiveRecording>();

export function startRecording(roomId: string, broadcastLogId: string): void {
  if (recordings.has(roomId)) {
    console.warn(`Recording already active for room ${roomId}`);
    return;
  }

  recordings.set(roomId, {
    broadcastLogId,
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

  // Save transcripts to DB
  if (transcripts.length > 0) {
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
  }

  // Upload audio to R2
  if (audioChunks.length > 0 && isR2Configured()) {
    try {
      // Concatenate PCM chunks into single buffer
      const pcmBuffer = Buffer.concat(audioChunks);

      // Convert PCM to WAV (simpler than MP3, no external dependency issues)
      const wavBuffer = pcmToWav(pcmBuffer, 16000, 1, 16);

      const key = `recordings/${broadcastLogId}.wav`;
      await uploadToR2(key, wavBuffer, 'audio/wav');

      db.updateBroadcastLogRecording(broadcastLogId, key, transcripts.length);
      console.log(`Uploaded audio for broadcast ${broadcastLogId} (${(wavBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
    } catch (error) {
      console.error(`Failed to upload audio for broadcast ${broadcastLogId}:`, error);
    }
  }
}

export function isRecording(roomId: string): boolean {
  return recordings.has(roomId);
}

// Convert raw PCM to WAV format
function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;

  const wav = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);

  // fmt sub-chunk
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);          // sub-chunk size
  wav.writeUInt16LE(1, 20);           // PCM format
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmData.copy(wav, headerSize);

  return wav;
}
