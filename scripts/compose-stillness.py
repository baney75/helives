#!/usr/bin/env python3
"""Original 96-second instrumental study. Deterministic synthesis; no sampled recordings.
Dmaj9 → Bm7 → Gmaj9 → Asus4. Felt-like struck partials, slow bowed tones.
Reverb tails wrap into the opening so the underlying PCM can repeat continuously.
"""
from pathlib import Path
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE, SECONDS = 44100, 96
N = RATE * SECONDS
mix = np.zeros((N, 2), dtype=np.float64)
rng = np.random.default_rng(71419)

def add_note(midi, start, duration, level, pan=0, bowed=False):
    t = np.arange(int(duration * RATE)) / RATE
    f = 440 * 2 ** ((midi - 69) / 12)
    tone = np.zeros_like(t)
    if bowed:
        for k, amp in [(1, 1), (2, .18), (3, .075), (4, .025)]:
            tone += amp * np.sin(2*np.pi*f*k*t + .018*np.sin(2*np.pi*4.6*t))
        envelope = np.sin(np.pi*t/duration)**2
    else:
        for k, amp in [(1, 1), (2, .24), (3, .09), (4, .032), (5, .008)]:
            tone += amp * np.sin(2*np.pi*f*k*(1+.00009*k*k)*t) * np.exp(-t*(.28+.17*k))
        envelope = (1-np.exp(-t*75)) * np.minimum(1, (duration-t)/.8)
    mono = tone * envelope * level
    stereo = mono[:,None] * np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])
    idx = (np.arange(len(t)) + int(start*RATE)) % N
    mix[idx] += stereo

chords = [[38,57,61,64,66], [35,54,57,61,66], [31,54,57,62,69], [33,55,57,62,64]]
melodies = [[74,69,76,73], [74,69,66,69], [74,76,69,66], [69,74,76,69]]
for bar in range(24):
    chord = chords[(bar//2)%4]
    start = bar * 4
    if bar%2 == 0:
        add_note(chord[0], start, 11, .047, -.12, True)
        for i,note in enumerate(chord[1:4]):
            add_note(note, start + .12*i, 10, .018, (i-1)*.32, True)
    # Sparse accompaniment, slightly varied touch, no percussion.
    for beat, note in zip([.06, 1.54, 2.98], [chord[1],chord[3],chord[2]]):
        add_note(note, start+beat, 7, .057*rng.uniform(.88,1.04), rng.uniform(-.3,.3))
    if bar%2 == 0:
        phrase = melodies[(bar//2)%4]
        note = phrase[(bar//8)%4]
        add_note(note, start+.7, 8, .095, .16)
    if bar in [5,13,21]:
        add_note(76, start+2.4, 8, .053, -.18)
# Diffuse room, with different delays in each channel. Wrapped tails preserve loop.
dry = mix.copy()
for delay, gain in [(.113,.13),(.179,.11),(.293,.09),(.419,.075),(.613,.06),(.887,.045),(1.213,.035),(1.733,.025)]:
    mix[:,0] += np.roll(dry[:,1], int(delay*RATE))*gain
    mix[:,1] += np.roll(dry[:,0], int((delay+.019)*RATE))*gain
mix *= .65 / max(np.max(np.abs(mix)), .001)
staging = ROOT/'demo/audio-staging'
staging.mkdir(parents=True, exist_ok=True)
raw = staging/'stillness-master.wav'
with wave.open(str(raw), 'wb') as out:
    out.setnchannels(2); out.setsampwidth(2); out.setframerate(RATE)
    out.writeframes((mix*32767).astype('<i2').tobytes())
dest = ROOT/'public/audio/music/stillness.mp3'
dest.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-af','loudnorm=I=-23:LRA=7:TP=-3',
    '-ar','44100','-c:a','libmp3lame','-b:a','160k','-metadata','title=Stillness',
    '-metadata','comment=Original programmatic instrumental study for He Lives; no vocals or samples.',str(dest)],check=True)
print(f'Created {dest.name}: {SECONDS}s, original instrumental, stereo, -23 LUFS target')
