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
      const mp3Buffer = await pcmToMp3(pcmBuffer, 16000);

      const ext = mp3Buffer ? 'mp3' : 'wav';
      const contentType = mp3Buffer ? 'audio/mpeg' : 'audio/wav';
      const uploadBuffer = mp3Buffer || pcmToWav(pcmBuffer, 16000, 1, 16);

      const key = `recordings/${broadcastLogId}.${ext}`;
      await uploadToR2(key, uploadBuffer, contentType);

      if (recording.hasDbLog) {
        db.updateBroadcastLogRecording(broadcastLogId, key, transcripts.length);
      }
      console.log(`Uploaded audio for broadcast ${broadcastLogId} (${(uploadBuffer.length / 1024 / 1024).toFixed(1)}MB ${ext.toUpperCase()}, from ${(pcmBuffer.length / 1024 / 1024).toFixed(1)}MB PCM)`);
    } catch (error) {
      console.error(`Failed to upload audio for broadcast ${broadcastLogId}:`, error);
    }
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
