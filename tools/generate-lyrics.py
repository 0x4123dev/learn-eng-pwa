#!/usr/bin/env python3
"""
generate-lyrics.py — Auto-generate synced lyrics JSON using Whisper.

Usage:
  # Extract .en.txt and .vi.txt from existing JSON:
    python3 tools/generate-lyrics.py --extract audio/wellerman.json

  # Extract all JSONs:
    python3 tools/generate-lyrics.py --extract-all

  # Generate new JSON from MP3 + lyrics files:
    python3 tools/generate-lyrics.py audio/wellerman.mp3

  The script expects:
    audio/<song-id>.mp3       — the audio file
    audio/<song-id>.en.txt    — English lyrics, one line per line
    audio/<song-id>.vi.txt    — Vietnamese translations, one line per line

  It will output:
    audio/<song-id>.json      — synced lyrics in the app's format
"""

import json
import os
import sys
import re
import glob
import subprocess
import argparse


def extract_txt_from_json(json_path):
    """Extract .en.txt and .vi.txt from an existing song JSON."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    base = json_path.rsplit('.', 1)[0]
    en_path = base + '.en.txt'
    vi_path = base + '.vi.txt'

    with open(en_path, 'w', encoding='utf-8') as f:
        for line in data['lines']:
            f.write(line['en'] + '\n')

    with open(vi_path, 'w', encoding='utf-8') as f:
        for line in data['lines']:
            f.write(line['vi'] + '\n')

    print(f"  ✅ {en_path} ({len(data['lines'])} lines)")
    print(f"  ✅ {vi_path} ({len(data['lines'])} lines)")
    return en_path, vi_path


def extract_all(audio_dir='audio'):
    """Extract .en.txt and .vi.txt from all JSON files in audio/."""
    json_files = sorted(glob.glob(os.path.join(audio_dir, '*.json')))
    if not json_files:
        print(f"No JSON files found in {audio_dir}/")
        return

    print(f"Extracting lyrics from {len(json_files)} JSON files...\n")
    for jf in json_files:
        song_id = os.path.basename(jf).rsplit('.', 1)[0]
        print(f"📄 {song_id}:")
        extract_txt_from_json(jf)
        print()


def run_whisper(mp3_path, output_dir='/tmp/whisper-lyrics'):
    """Run Whisper on an MP3 file and return the JSON result."""
    os.makedirs(output_dir, exist_ok=True)

    # Read the .en.txt to use as initial prompt (improves accuracy)
    base = mp3_path.rsplit('.', 1)[0]
    en_path = base + '.en.txt'
    initial_prompt = ''
    if os.path.exists(en_path):
        with open(en_path, 'r', encoding='utf-8') as f:
            lines = [l.strip() for l in f.readlines() if l.strip()]
            # Use first ~500 chars as prompt (Whisper limit)
            initial_prompt = ' '.join(lines)[:500]

    # Find whisper binary
    whisper_bin = 'whisper'
    home_bin = os.path.expanduser('~/Library/Python/3.9/bin/whisper')
    if os.path.exists(home_bin):
        whisper_bin = home_bin

    cmd = [
        whisper_bin, mp3_path,
        '--model', 'base',
        '--language', 'en',
        '--output_format', 'json',
        '--word_timestamps', 'True',
        '--output_dir', output_dir,
    ]

    if initial_prompt:
        cmd.extend(['--initial_prompt', initial_prompt])

    # Ensure ffmpeg is in PATH
    env = os.environ.copy()
    env['PATH'] = '/opt/homebrew/bin:' + env.get('PATH', '')

    print(f"  🎙️  Running Whisper on {mp3_path}...")
    print(f"  ⏳ This may take a few minutes on CPU...")

    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        print(f"  ❌ Whisper error: {result.stderr}")
        return None

    # Read the output JSON
    song_name = os.path.basename(mp3_path).rsplit('.', 1)[0]
    json_out = os.path.join(output_dir, song_name + '.json')
    if not os.path.exists(json_out):
        print(f"  ❌ Whisper output not found: {json_out}")
        return None

    with open(json_out, 'r', encoding='utf-8') as f:
        return json.load(f)


def clean_text(text):
    """Clean whisper text for matching — lowercase, remove punctuation."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def align_lyrics(whisper_data, en_lines, vi_lines, metadata):
    """
    Align English lyrics with Whisper word-level timestamps.

    Strategy:
    1. Build a flat list of ALL words with their start times from Whisper
    2. For each lyric line, calculate an expected time (proportional to position)
    3. Search the word stream NEAR the expected time with bounded sequential cursor
    4. Use the start time of the first matching word as the line timestamp
    5. Interpolate any lines that couldn't be matched
    """
    segments = whisper_data.get('segments', [])
    duration = metadata.get('duration', 120)

    # Build flat word list with timestamps
    all_words = []
    for seg in segments:
        for word_info in seg.get('words', []):
            w = word_info['word'].strip()
            if w:
                all_words.append({
                    'word': w,
                    'clean': re.sub(r'[^\w]', '', w.lower()),
                    'start': word_info['start'],
                    'end': word_info['end'],
                })

    if not all_words:
        print(f"  ❌ No word-level timestamps from Whisper!")
        return [{'time': round(i * duration / len(en_lines), 1), 'en': en_lines[i],
                 'vi': vi_lines[i] if i < len(vi_lines) else ''} for i in range(len(en_lines))]

    print(f"  📝 Whisper produced {len(all_words)} words with timestamps")
    audio_end = all_words[-1]['end']

    # Helper: find word index nearest to a given time
    def word_idx_at_time(target_time):
        best_idx = 0
        best_diff = abs(all_words[0]['start'] - target_time)
        for k in range(1, len(all_words)):
            diff = abs(all_words[k]['start'] - target_time)
            if diff < best_diff:
                best_diff = diff
                best_idx = k
        return best_idx

    # Calculate expected time for each line (proportional to position)
    total_lines = len(en_lines)
    expected_times = []
    for i in range(total_lines):
        expected_times.append(i * audio_end / total_lines)

    # Search cursor — only moves forward, with bounded jumps
    cursor = 0
    avg_words_per_line = max(5, len(all_words) // total_lines)

    result_lines = []

    for i, en_line in enumerate(en_lines):
        vi_line = vi_lines[i] if i < len(vi_lines) else ''

        # Extract searchable words from the lyric line
        # Remove [TAGS] like [ANGEL DUST], [CHARLIE], etc.
        clean_line = re.sub(r'\[.*?\]', '', en_line)
        line_words = [re.sub(r'[^\w]', '', w.lower()) for w in clean_line.split()]
        line_words = [w for w in line_words if w and len(w) > 1]

        if not line_words:
            result_lines.append({'time': None, 'en': en_line, 'vi': vi_line})
            continue

        # Take key words from the line for matching
        key_words = line_words[:min(5, len(line_words))]

        # Define search window: centered around expected position
        expected_idx = word_idx_at_time(expected_times[i])
        window = avg_words_per_line * 3

        # Search range: prefer near cursor or expected_idx, whichever is closer
        search_lo = max(0, min(cursor, expected_idx - window))
        search_hi = min(len(all_words), max(cursor + window, expected_idx + window))

        best_time = None
        best_score = 0
        best_pos = cursor

        for j in range(search_lo, search_hi):
            # Try to match key_words in a small window at position j
            window_size = min(len(key_words) + 4, len(all_words) - j)
            if window_size < 1:
                break

            window_words = [all_words[j + k]['clean'] for k in range(window_size)]

            matches = 0
            for kw in key_words:
                if kw in window_words:
                    matches += 1

            score = matches / len(key_words)

            # Bonus for positions near expected time
            time_diff = abs(all_words[j]['start'] - expected_times[i])
            time_bonus = max(0, 0.15 - time_diff / (duration * 2))
            score += time_bonus

            # Bonus for positions after cursor (sequential order)
            if j >= cursor:
                score += 0.05

            if score > best_score:
                best_score = score
                best_time = all_words[j]['start']
                best_pos = j

            # If excellent match found after cursor, stop early
            if score >= 0.85 and j >= cursor:
                break

        if best_score >= 0.4 and best_time is not None:
            cursor = best_pos + 1
            result_lines.append({
                'time': round(best_time, 1),
                'en': en_line,
                'vi': vi_line,
            })
        else:
            result_lines.append({
                'time': None,
                'en': en_line,
                'vi': vi_line,
            })

    # Count matched vs unmatched
    matched = sum(1 for l in result_lines if l['time'] is not None)
    total = len(result_lines)
    print(f"  🎯 Matched {matched}/{total} lines ({100*matched//total}%)")

    # Interpolate missing timestamps
    for i, line in enumerate(result_lines):
        if line['time'] is not None:
            continue

        prev_time = 0
        next_time = duration
        prev_idx = 0
        next_idx = len(result_lines) - 1

        for j in range(i - 1, -1, -1):
            if result_lines[j]['time'] is not None:
                prev_time = result_lines[j]['time']
                prev_idx = j
                break

        for j in range(i + 1, len(result_lines)):
            if result_lines[j]['time'] is not None:
                next_time = result_lines[j]['time']
                next_idx = j
                break

        gap_count = next_idx - prev_idx
        if gap_count > 0:
            step = (next_time - prev_time) / gap_count
            line['time'] = round(prev_time + step * (i - prev_idx), 1)
        else:
            line['time'] = round(prev_time + 2.0 * (i - prev_idx), 1)

    # Ensure monotonically increasing timestamps
    for i in range(1, len(result_lines)):
        if result_lines[i]['time'] <= result_lines[i-1]['time']:
            result_lines[i]['time'] = round(result_lines[i-1]['time'] + 0.5, 1)

    return result_lines


def generate_song_json(mp3_path):
    """Full pipeline: MP3 + lyrics → synced JSON."""
    base = mp3_path.rsplit('.', 1)[0]
    song_id = os.path.basename(base)
    en_path = base + '.en.txt'
    vi_path = base + '.vi.txt'
    json_path = base + '.json'

    # Check required files
    if not os.path.exists(mp3_path):
        print(f"❌ MP3 not found: {mp3_path}")
        return False

    if not os.path.exists(en_path):
        print(f"❌ English lyrics not found: {en_path}")
        print(f"   Create it first: one line per lyric line")
        return False

    if not os.path.exists(vi_path):
        print(f"⚠️  Vietnamese file not found: {vi_path}")
        print(f"   Will use empty Vietnamese translations")

    # Read lyrics
    with open(en_path, 'r', encoding='utf-8') as f:
        en_lines = [l.rstrip('\n') for l in f.readlines()]

    vi_lines = []
    if os.path.exists(vi_path):
        with open(vi_path, 'r', encoding='utf-8') as f:
            vi_lines = [l.rstrip('\n') for l in f.readlines()]

    # Pad vi_lines if shorter
    while len(vi_lines) < len(en_lines):
        vi_lines.append('')

    # Read existing JSON for metadata (title, artist, duration)
    metadata = {
        'id': song_id,
        'title': song_id.replace('-', ' ').title(),
        'artist': 'Unknown',
        'audio': f'audio/{song_id}.mp3',
        'duration': 120,
    }
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            existing = json.load(f)
            metadata['title'] = existing.get('title', metadata['title'])
            metadata['artist'] = existing.get('artist', metadata['artist'])
            metadata['duration'] = existing.get('duration', metadata['duration'])

    print(f"\n🎵 Processing: {song_id}")
    print(f"   Title: {metadata['title']}")
    print(f"   Lines: {len(en_lines)} EN, {len(vi_lines)} VI")

    # Run Whisper
    whisper_data = run_whisper(mp3_path)
    if not whisper_data:
        return False

    segments = whisper_data.get('segments', [])
    print(f"  ✅ Whisper found {len(segments)} segments")

    # Align lyrics with timestamps
    print(f"  🔗 Aligning lyrics with timestamps...")
    aligned_lines = align_lyrics(whisper_data, en_lines, vi_lines, metadata)

    # Build output JSON
    output = {
        'id': metadata['id'],
        'title': metadata['title'],
        'artist': metadata['artist'],
        'audio': metadata['audio'],
        'duration': metadata['duration'],
        'lines': aligned_lines,
    }

    # Write output
    output_path = json_path + '.new'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  ✅ Generated: {output_path}")
    print(f"  📋 Review the timestamps, then rename to {json_path}")

    # Print comparison if original exists
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            original = json.load(f)

        print(f"\n  📊 Timestamp comparison (first 10 lines):")
        print(f"  {'Line':<4} {'Original':>10} {'Whisper':>10} {'Diff':>8}  Text")
        print(f"  {'─'*4} {'─'*10} {'─'*10} {'─'*8}  {'─'*30}")
        for k in range(min(10, len(aligned_lines))):
            orig_time = original['lines'][k]['time'] if k < len(original['lines']) else '—'
            new_time = aligned_lines[k]['time']
            diff = ''
            if isinstance(orig_time, (int, float)):
                diff = f"{new_time - orig_time:+.1f}s"
            text = aligned_lines[k]['en'][:30]
            print(f"  {k+1:<4} {str(orig_time):>10} {str(new_time):>10} {diff:>8}  {text}")

    return True


def main():
    parser = argparse.ArgumentParser(description='Generate synced lyrics using Whisper')
    parser.add_argument('input', nargs='?', help='MP3 file or JSON file path')
    parser.add_argument('--extract', action='store_true', help='Extract .en.txt and .vi.txt from a JSON')
    parser.add_argument('--extract-all', action='store_true', help='Extract from all JSONs in audio/')
    parser.add_argument('--all', action='store_true', help='Process all MP3 files in audio/')

    args = parser.parse_args()

    if args.extract_all:
        extract_all()
        return

    if args.extract:
        if not args.input:
            print("Usage: python3 tools/generate-lyrics.py --extract audio/song.json")
            return
        extract_txt_from_json(args.input)
        return

    if args.all:
        mp3_files = sorted(glob.glob('audio/*.mp3'))
        print(f"Processing {len(mp3_files)} songs...\n")
        for mp3 in mp3_files:
            generate_song_json(mp3)
            print()
        return

    if args.input:
        if args.input.endswith('.json'):
            extract_txt_from_json(args.input)
        elif args.input.endswith('.mp3'):
            generate_song_json(args.input)
        else:
            print(f"Unknown file type: {args.input}")
        return

    parser.print_help()


if __name__ == '__main__':
    main()
