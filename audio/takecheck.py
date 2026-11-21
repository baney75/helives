"""Acoustic checks on one rendered chunk, plus trimming and level matching. Needs numpy.

A take is rejected (and re-rendered) for any problem listed in `problems`:
  long-silence   a pause longer than MAX_GAP_S inside the speech
  clipped-end    the audio stops while speech energy is still high (cut-off last word)
  clipping       too many samples at full scale
  pace-slow / pace-fast   words per second of speech outside [WPS_MIN, WPS_MAX]
  empty          no speech found
"""
from __future__ import annotations

import numpy as np

FRAME_S = 0.02
MAX_GAP_S = 1.5
WPS_MIN = 1.3            # unhurried Scripture reading runs about 2.0 to 2.8 words per second
WPS_MAX = 3.6
PAD_S = 0.06             # silence kept at each end after trimming
TARGET_RMS_DB = -20.0    # speech-level match between chunks before loudness normalization


def frame_rms(audio: np.ndarray, sr: int) -> np.ndarray:
    n = max(1, int(sr * FRAME_S))
    usable = len(audio) // n * n
    if usable == 0:
        return np.zeros(1)
    frames = audio[:usable].reshape(-1, n)
    return np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))


def analyze(audio: np.ndarray, sr: int, words: int) -> dict:
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    problems: list[str] = []
    rms = frame_rms(audio, sr)
    loud = float(np.percentile(rms, 95)) if len(rms) else 0.0
    if loud < 1e-4:
        return {"problems": ["empty"], "speech_seconds": 0.0, "max_gap": 0.0, "wps": 0.0,
                "start": 0, "end": len(audio)}
    thr = max(1e-4, 0.03 * loud)
    voiced = np.nonzero(rms > thr)[0]
    first, last = int(voiced[0]), int(voiced[-1])
    speech_seconds = (last - first + 1) * FRAME_S
    # Longest silent run strictly inside the speech.
    gap, run = 0, 0
    for v in rms[first:last + 1] > thr:
        run = 0 if v else run + 1
        gap = max(gap, run)
    max_gap = gap * FRAME_S
    if max_gap > MAX_GAP_S:
        problems.append("long-silence")
    # Cut-off ending: the last 40 ms still carry speech-level energy.
    tail = rms[-2:]
    median_voiced = float(np.median(rms[voiced]))
    if len(rms) > 4 and float(np.min(tail)) > 0.35 * median_voiced:
        problems.append("clipped-end")
    if np.mean(np.abs(audio) >= 0.999) > 0.001:
        problems.append("clipping")
    wps = words / max(speech_seconds, 1e-3)
    if words >= 5:
        if wps < WPS_MIN:
            problems.append("pace-slow")
        elif wps > WPS_MAX:
            problems.append("pace-fast")
    elif speech_seconds > 1.2 * words + 1.5:
        problems.append("pace-slow")
    n = int(sr * FRAME_S)
    pad = int(sr * PAD_S)
    start = max(0, first * n - pad)
    end = min(len(audio), (last + 1) * n + pad)
    return {"problems": problems, "speech_seconds": round(speech_seconds, 3), "max_gap": round(max_gap, 3),
            "wps": round(wps, 3), "start": start, "end": end}


def finish(audio: np.ndarray, sr: int, info: dict) -> np.ndarray:
    """Trim to speech plus a short pad, fade the edges, and match speech level across chunks."""
    a = np.asarray(audio, dtype=np.float32).reshape(-1)[info["start"]:info["end"]].copy()
    fade = min(len(a) // 4, int(sr * 0.01))
    if fade:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        a[:fade] *= ramp
        a[-fade:] *= ramp[::-1]
    rms = frame_rms(a, sr)
    voiced = rms[rms > 0.03 * (np.percentile(rms, 95) if len(rms) else 0)]
    level = float(np.sqrt(np.mean(voiced ** 2))) if len(voiced) else 0.0
    if level > 0:
        gain = 10 ** (TARGET_RMS_DB / 20) / level
        peak = float(np.max(np.abs(a))) or 1.0
        gain = min(gain, 0.95 / peak)
        a *= gain
    return a
