"""Local Silero inference for PCM16 WAV. Outputs source-frame ranges as JSON."""
import json
import math
import sys
import wave
import numpy as np
from scipy.signal import resample_poly
import torch
from silero_vad import load_silero_vad, get_speech_timestamps

def detect(path):
    with wave.open(path, 'rb') as wav:
        channels, width, rate, frames = wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()
        if channels not in (1, 2) or width != 2 or frames <= 0:
            raise ValueError('Requires PCM16 mono/stereo WAV')
        samples = np.frombuffer(wav.readframes(frames), dtype='<i2').astype(np.float32).reshape(-1, channels)
    # Max-energy channel avoids cancellation of opposite-polarity stereo.
    channel = int(np.argmax(np.mean(samples * samples, axis=0)))
    mono = samples[:, channel] / 32768.0
    divisor = math.gcd(rate, 16000)
    converted = resample_poly(mono, 16000 // divisor, rate // divisor).astype(np.float32)
    model = load_silero_vad(onnx=True)
    regions = get_speech_timestamps(torch.from_numpy(converted), model, sampling_rate=16000, speech_pad_ms=200)
    merged = []
    for region in regions:
        start = max(0, math.floor(region['start'] * rate / 16000))
        end = min(frames, math.ceil(region['end'] * rate / 16000))
        if start >= end:
            continue
        if merged and start <= merged[-1]['endFrame']:
            merged[-1]['endFrame'] = max(end, merged[-1]['endFrame'])
        else:
            merged.append({'startFrame': start, 'endFrame': end})
    return {'regions': merged, 'sampleRate': rate, 'frames': frames, 'channels': channels, 'detector': 'silero-vad-6.2.3-onnx', 'selectedChannel': channel}

if __name__ == '__main__':
    print(json.dumps(detect(sys.argv[1])))
