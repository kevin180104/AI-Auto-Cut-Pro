import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave

import numpy as np

spec = importlib.util.spec_from_file_location('silero_local', Path(__file__).with_name('silero_vad_local.py'))
vad = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vad)


class ChannelUnionTest(unittest.TestCase):
    def test_left_right_and_alternating_are_protected(self):
        # Stub inference checks union/mapping logic; separate runtime evidence uses real Silero.
        def infer(tensor, model, **kwargs):
            array = tensor.numpy()
            return [{'start': i, 'end': i + 1600} for i in range(0, len(array), 1600) if np.max(np.abs(array[i:i + 1600])) > 0.1]
        for channel in ('left', 'right', 'alternating'):
            with self.subTest(channel=channel), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'source.wav'
                samples = np.zeros((16000, 2), dtype='<i2')
                if channel in ('left', 'alternating'): samples[1600:3200, 0] = 8000
                if channel in ('right', 'alternating'): samples[8000:9600, 1] = 8000
                with wave.open(str(path), 'wb') as output:
                    output.setnchannels(2); output.setsampwidth(2); output.setframerate(16000); output.writeframes(samples.tobytes())
                with patch.object(vad, 'load_silero_vad', return_value=object()), patch.object(vad, 'get_speech_timestamps', side_effect=infer):
                    result = vad.detect(path)
                expected = {'left': {0}, 'right': {1}, 'alternating': {0, 1}}[channel]
                self.assertEqual({r['channel'] for r in result['channelRegions']}, expected)
                self.assertTrue(all(r['startFrame'] < r['endFrame'] <= 16000 for r in result['regions']))


if __name__ == '__main__':
    unittest.main()
