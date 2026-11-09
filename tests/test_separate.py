"""GAB-136: the dry copy comes back at the take's rate, length and depth, never clipped, and MP3 at 320k."""

import unittest
from pathlib import Path

import numpy as np
import soundfile as sf

from separate import _finish


class FinishTest(unittest.TestCase):
    def test_stems_come_back_at_the_songs_rate_length_and_depth_without_clipping(self):
        # GAB-136: a 48 kHz / 24-bit take comes back 48 kHz / 24-bit, the same length, never clipped.
        import ox1audio as ox

        folder = Path(__file__).resolve().parent / "_out" / "studio"
        folder.mkdir(parents=True, exist_ok=True)
        for child in folder.iterdir():
            child.unlink()
        song = folder / "take.wav"
        t = np.arange(48000 * 2) / 48000
        sf.write(str(song), np.stack([0.5 * np.sin(2 * np.pi * 220 * t)] * 2, axis=1), 48000, subtype="PCM_24")
        t44 = np.arange(44100 * 2) / 44100
        loud = np.stack([1.5 * np.sin(2 * np.pi * 220 * t44)] * 2, axis=1).astype(np.float32)  # a stem over 0 dBFS
        quiet = (loud * 0.1).astype(np.float32)
        for audio_format in ("wav", "flac", "mp3"):
            vocals, music = folder / "take_(No Reverb).wav", folder / "take_(Reverb).wav"
            sf.write(str(vocals), loud, 44100, subtype="FLOAT")
            sf.write(str(music), quiet, 44100, subtype="FLOAT")
            written = _finish(folder, song, [str(vocals), str(music)], ["No Reverb", "Reverb"], audio_format)
            self.assertEqual(len(written), 2)
            outs = {Path(path).stem: path for path in written}
            info = ox.audio.probe(outs["take_(No Reverb)"])
            self.assertEqual(info.rate, 48000, audio_format)
            got, _ = ox.audio.read(outs["take_(No Reverb)"])
            other, _ = ox.audio.read(outs["take_(Reverb)"])
            self.assertLess(float(np.max(np.abs(got))), 1.0, f"{audio_format}: not clipped")
            # The same gain on both stems: they still add up the way the model made them.
            ratio = float(np.max(np.abs(other)) / np.max(np.abs(got)))
            self.assertAlmostEqual(ratio, 0.1, delta=0.01)
            if audio_format == "mp3":
                self.assertGreaterEqual(info.bitrate or 0, 300)
            else:
                self.assertEqual(info.bits, 24, audio_format)
                self.assertEqual(len(got), 96000, f"{audio_format}: the same length as the song")
                # Not hard-clipped: a clipped sine sits at its peak for a tenth of every cycle.
                top = np.max(np.abs(got[:, 0]))
                self.assertLess(int(np.sum(np.abs(got[:, 0]) >= top - 1e-6)), len(got) // 100)
            for path in written:
                Path(path).unlink()



if __name__ == "__main__":
    unittest.main()
