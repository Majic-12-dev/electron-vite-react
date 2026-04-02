import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'node:path';
import { ensureDir } from '../utils/fs';

ffmpeg.setFfmpegPath(ffmpegStatic);

export const trimAudio = async (payload: {
  inputPath: string;
  outputDir: string;
  startTime: number;
  duration: number;
}) => {
  const { inputPath, outputDir, startTime, duration } = payload;
  const fileName = path.basename(inputPath);
  const outputPath = path.join(outputDir, `trimmed_${fileName}`);
  
  await ensureDir(outputDir);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err: any) => reject(err))
      .run();
  });
};

export const compressVideo = async (payload: {
  inputPath: string;
  outputDir: string;
  crf: number;
}) => {
  const { inputPath, outputDir, crf } = payload;
  const fileName = path.basename(inputPath);
  const outputPath = path.join(outputDir, `compressed_${fileName}`);

  await ensureDir(outputDir);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .outputOptions([`-crf ${crf}`, '-preset medium'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err: any) => reject(err))
      .run();
  });
};
