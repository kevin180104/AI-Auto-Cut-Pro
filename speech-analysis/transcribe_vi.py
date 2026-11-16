"""Offline word-timestamped Vietnamese transcription. Model download is a separate step."""
import argparse
import json
from pathlib import Path
import os
import subprocess
import hashlib

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--model', type=Path, required=True)
    args = parser.parse_args()
    os.environ['HF_HUB_OFFLINE'] = '1'
    from faster_whisper import WhisperModel
    from importlib.metadata import version
    model = WhisperModel(str(args.model.resolve(strict=True)), device='cpu', compute_type='int8', cpu_threads=min(os.cpu_count() or 1, 8), local_files_only=True)
    import numpy as np
    with args.audio.open('rb') as stream:
        input_hash = hashlib.file_digest(stream, 'sha256').hexdigest()
    ffmpeg = os.environ.get('AACP_FFMPEG', 'C:/Program Files/FormatFactory5.21.0.0/ffmpeg.exe')
    pcm = subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-i', str(args.audio), '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], check=True, stdout=subprocess.PIPE)
    audio = np.frombuffer(pcm.stdout, dtype='<f4').copy()
    segments, info = model.transcribe(audio, language='vi', word_timestamps=True, beam_size=1, condition_on_previous_text=False)
    result = []
    for s in segments:
        result.append(dict(start=s.start, end=s.end, text=s.text, noSpeech=s.no_speech_prob,
                           words=[dict(start=w.start,end=w.end,text=w.word,score=w.probability) for w in (s.words or [])]))
        if len(result) % 50 == 0:
            print(f'ASR progress: {s.end:.0f}s', flush=True)
    with args.output.open('x', encoding='utf8') as stream:
        json.dump(dict(inputSha256=input_hash, model=args.model.name, runtime=version('faster-whisper'), language=info.language, segments=result), stream, ensure_ascii=False)

if __name__ == '__main__':
    main()
