#!/usr/bin/env python3
"""Master the user-supplied collection without changing the original downloads."""
from pathlib import Path
import subprocess, json, hashlib, re
ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path.home()/'Downloads'
NAMES = ['Where_the_Light_Rests', 'Before_the_First_Light', 'Sunlight_on_the_Garden_Path',
         'Where_The_River_Stills', 'The_Gentle_Unfurling', 'Under_A_Silent_Sky',
         'Morning_Beneath_the_Oak', 'A_Room_Held_in_Breath', 'Winter_Light_on_the_Floor', 'Before_the_Curtains_Close']
records=[]
for name in NAMES:
    src=SOURCE/(name+'.mp3')
    slug=name.lower().replace('_','-')
    dest=ROOT/'public/audio/music'/(slug+'.mp3')
    report=subprocess.run(['ffmpeg','-hide_banner','-i',str(src),'-af','loudnorm=I=-23:LRA=7:TP=-3:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    m=json.loads(re.search(r'\{\s*"input_i"[\s\S]*?\}',report.stderr)[0])
    filt=f"loudnorm=I=-23:LRA=7:TP=-3:measured_I={m['input_i']}:measured_LRA={m['input_lra']}:measured_TP={m['input_tp']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-map_metadata','-1','-af',filt,'-ar','44100','-ac','2','-c:a','libmp3lame','-b:a','160k',str(dest)],check=True)
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(dest)]))
    records.append({'id':slug,'title':name.replace('_',' '),'file':dest.name,'credit':'Instrumental · supplied by Donovan',
      'source_file':src.name,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'duration':float(info['format']['duration']),
      'original_loudness_lufs':float(m['input_i']),'mastering':'Two-pass -23 LUFS / -3 dBTP target; stereo 44.1 kHz, MP3 160 kbps'})
    print(f'Mastered {name}',flush=True)
(ROOT/'docs/music-provenance.json').write_text(json.dumps({'date':'2026-09-07','source':'User-directed import from Downloads','tracks':records},indent=2)+'\n')
source="export type MusicTrack = { id: string; title: string; file: string; credit: string }\n\n/** Only mastered local files. Provenance: docs/music-provenance.json. */\nexport const MUSIC_TRACKS: readonly MusicTrack[] = "+json.dumps([{k:r[k] for k in ['id','title','file','credit']} for r in records],indent=2)+'\n'
(ROOT/'src/music/catalog.ts').write_text(source)
