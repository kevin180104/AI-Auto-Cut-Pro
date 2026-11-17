"""Offline word-timestamped Vietnamese transcription. Model download is a separate step."""
import argparse
import json
from pathlib import Path
import platform
import os
import subprocess
import hashlib


def file_hash(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def profile(model_dir, ffmpeg, threads):
    from importlib.metadata import version
    files = {
        path.name: file_hash(path)
        for path in sorted(model_dir.iterdir())
        if path.is_file() and path.suffix in {'.bin', '.json', '.txt'}
    }
    if 'model.bin' not in files:
        raise ValueError('Expected a local CTranslate2 model.bin')
    banner = subprocess.run([ffmpeg, '-version'], check=True, capture_output=True).stdout
    return dict(modelFiles=files, ffmpeg=hashlib.sha256(banner).hexdigest(),
                runtime=version('faster-whisper'), ctranslate2=version('ctranslate2'),
                numpy=version('numpy'), platform=platform.platform(), architecture=platform.machine(),
                device='cpu', computeType='int8', threads=threads, beamSize=1, temperature=0.0,
                language='vi', wordTimestamps=True, conditionOnPreviousText=False,
                sampleRate=16000, channels=1, pcm='f32le')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--model', type=Path, required=True)
    args = parser.parse_args()
    os.environ['HF_HUB_OFFLINE'] = '1'
    from faster_whisper import WhisperModel
    from importlib.metadata import version
    import numpy as np
    model_dir = args.model.resolve(strict=True)
    input_hash = file_hash(args.audio)
    ffmpeg = os.environ.get('AACP_FFMPEG', 'C:/Program Files/FormatFactory5.21.0.0/ffmpeg.exe')
    threads = min(os.cpu_count() or 1, 8)
    provenance = profile(model_dir, ffmpeg, threads)
    model = WhisperModel(str(model_dir), device='cpu', compute_type='int8', cpu_threads=threads, local_files_only=True)
    pcm = subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-i', str(args.audio), '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], check=True, stdout=subprocess.PIPE)
    audio = np.frombuffer(pcm.stdout, dtype='<f4').copy()
    segments, info = model.transcribe(audio, language='vi', word_timestamps=True, beam_size=1,
                                      temperature=0.0, condition_on_previous_text=False)
    result = []
    for s in segments:
        result.append(dict(start=s.start, end=s.end, text=s.text, noSpeech=s.no_speech_prob,
                           words=[dict(start=w.start,end=w.end,text=w.word,score=w.probability) for w in (s.words or [])]))
        if len(result) % 50 == 0:
            print(f'ASR progress: {s.end:.0f}s', flush=True)
    if file_hash(args.audio) != input_hash:
        raise RuntimeError('Source changed during transcription')
    with args.output.open('x', encoding='utf8') as stream:
        json.dump(dict(inputSha256=input_hash, model=args.model.name, runtime=version('faster-whisper'),
                       pcmSha256=hashlib.sha256(pcm.stdout).hexdigest(), profile=provenance,
                       language=info.language, segments=result), stream, ensure_ascii=False)

if __name__ == '__main__':
    main()
