"""Local Silero inference for PCM16 WAV. Outputs source-frame ranges as JSON."""
import json
import math
import os
import sys
import wave
import numpy as np
from scipy.signal import resample_poly
import torch
from silero_vad import load_silero_vad, get_speech_timestamps

def detect(path):
    with wave.open(os.fspath(path), 'rb') as wav:
        channels, width, rate, frames = wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()
        if channels not in (1, 2) or width != 2 or frames <= 0:
            raise ValueError('Requires PCM16 mono/stereo WAV')
        samples = np.frombuffer(wav.readframes(frames), dtype='<i2').astype(np.float32).reshape(-1, channels)
    divisor = math.gcd(rate, 16000)
    model = load_silero_vad(onnx=True)
    per_channel = []
    for channel in range(channels):
        converted = resample_poly(samples[:, channel] / 32768.0, 16000 // divisor, rate // divisor).astype(np.float32)
        regions = get_speech_timestamps(torch.from_numpy(converted), model, sampling_rate=16000, speech_pad_ms=200)
        for region in regions:
            start = max(0, math.floor(region['start'] * rate / 16000))
            end = min(frames, math.ceil(region['end'] * rate / 16000))
            if start < end:
                per_channel.append({'startFrame': start, 'endFrame': end, 'channel': channel})
    merged = []
    for region in sorted(per_channel, key=lambda item: (item['startFrame'], item['endFrame'])):
        start, end, channel = region['startFrame'], region['endFrame'], region['channel']
        if merged and start <= merged[-1]['endFrame']:
            merged[-1]['endFrame'] = max(end, merged[-1]['endFrame'])
            merged[-1]['channels'] = sorted(set(merged[-1]['channels'] + [channel]))
        else:
            merged.append({'startFrame': start, 'endFrame': end, 'channels': [channel]})
    return {'regions': merged, 'channelRegions': per_channel, 'sampleRate': rate, 'frames': frames, 'channels': channels, 'detector': 'silero-vad-6.2.3-onnx'}

if __name__ == '__main__':
    print(json.dumps(detect(sys.argv[1])))
