import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import speech_module as sm


class SpeechModuleTests(unittest.TestCase):
    def test_build_transcript_strips_fillers_but_keeps_raw(self):
        words = [
            {"word": "Um,", "start": 0.0, "end": 0.2},
            {"word": "I", "start": 0.2, "end": 0.4},
            {"word": "built", "start": 0.4, "end": 0.7},
            {"word": "it", "start": 0.7, "end": 0.9},
            {"word": "lah.", "start": 0.9, "end": 1.2},
        ]
        t = sm.build_transcript(words)
        self.assertEqual(t["raw_text"], "Um, I built it lah.")
        self.assertEqual(t["clean_text"], "I built it")
        self.assertEqual(t["duration_sec"], 1.2)

    def test_detect_fillers_handles_english_manglish_contextual_like_and_soft(self):
        words = [
            {"word": "Um,", "start": 0.0, "end": 0.2},
            {"word": "actually", "start": 0.2, "end": 0.5},
            {"word": "I", "start": 0.5, "end": 0.6},
            {"word": "like", "start": 0.6, "end": 0.8},
            {"word": "teamwork,", "start": 0.8, "end": 1.1},
            {"word": "like", "start": 1.15, "end": 1.35},  # follows comma -> filler
            {"word": "you", "start": 1.4, "end": 1.5},
            {"word": "know", "start": 1.5, "end": 1.7},
            {"word": "lah.", "start": 1.7, "end": 1.9},
        ]
        res = sm.detect_fillers(words)
        self.assertEqual(res["total"], 4)  # um, like (filler), you know, lah
        self.assertEqual(res["manglish_total"], 1)
        self.assertEqual(res["breakdown"]["like"], 1)
        self.assertEqual(res["breakdown"]["actually"], 1)

    def test_detect_pauses_and_fluency_score_caps(self):
        words = [
            {"word": "Start", "start": 0.0, "end": 0.4},
            {"word": "middle", "start": 1.1, "end": 1.5},   # 0.7s natural pause
            {"word": "end", "start": 4.0, "end": 4.4},      # 2.5s long pause
        ]
        pauses = sm.detect_pauses(words)
        self.assertEqual(pauses["natural_pause_count"], 1)
        self.assertEqual(pauses["long_pause_count"], 1)
        self.assertEqual(pauses["longest_pause_sec"], 2.5)

        ideal = sm.fluency_score(filler_rate=0.0, long_pauses=0, wpm=140.0)
        self.assertEqual(ideal["score"], 100)

        capped = sm.fluency_score(filler_rate=50.0, long_pauses=10, wpm=20.0)
        self.assertEqual(capped["score"], 0)
        self.assertEqual(capped["penalties"], {"filler": 40, "pause": 30, "speaking_rate": 30})

    def test_speaking_rate_excludes_fillers(self):
        words = [
            {"word": "Um", "start": 0.0, "end": 1.0},
            {"word": "I", "start": 1.0, "end": 2.0},
            {"word": "debugged", "start": 2.0, "end": 30.0},
        ]
        self.assertEqual(sm.speaking_rate(words), 4.0)

    def test_preprocess_audio_timeout_raises_runtime_error(self):
        with patch("shutil.which", return_value="ffmpeg"), patch(
            "subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="ffmpeg", timeout=30)
        ):
            with self.assertRaises(RuntimeError):
                sm.preprocess_audio("fake.webm")


if __name__ == "__main__":
    unittest.main()
