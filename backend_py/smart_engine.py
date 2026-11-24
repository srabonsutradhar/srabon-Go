#!/usr/bin/env python3
"""
Srabon Go — Python 3 Smart Backend Engine
Provides fast Unicode script analysis, TTS sentence chunking,
salon queue optimization, and WAV/PCM audio DSP inspection
using only the Python 3 standard library.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import os
import re
import signal
import struct
import sys
import unicodedata
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional, Tuple


DEFAULT_TIME_SLOTS: List[str] = [
    "09:30 AM",
    "10:30 AM",
    "11:30 AM",
    "12:30 PM",
    "02:00 PM",
    "03:30 PM",
    "05:00 PM",
    "06:30 PM",
    "08:00 PM",
    "09:15 PM",
]

SERVICE_DURATION_MINS: Dict[str, int] = {
    "haircut": 30,
    "beard": 20,
    "shave": 25,
    "color": 45,
    "facial": 40,
    "combo": 60,
}

BENGALI_RANGE_START = 0x0980
BENGALI_RANGE_END = 0x09FF

PORTUGUESE_CHARS = set("ãõáàâêéíóôúçÃÕÁÀÂÊÉÍÓÔÚÇ")
PORTUGUESE_HINTS = {
    "olá", "ola", "bom", "dia", "noite", "tarde", "você", "voce", "não", "nao",
    "para", "com", "muito", "obrigado", "obrigada", "corte", "barba", "salão",
    "salao", "horário", "horario", "agendar", "voz", "estúdio", "estudio", "português",
}
ENGLISH_HINTS = {
    "the", "and", "is", "are", "morning", "wake", "study", "today", "hello",
    "welcome", "voice", "studio", "time", "start", "please", "thank", "you",
}

STYLE_PRESET_VALUES: Dict[str, str] = {
    "alarm": "Energetic, bright, motivating morning wake-up announcement in clear Bengali",
    "warm": "Warm, gentle, encouraging morning greeting in Bengali",
    "coach": "Firm, confident study coach pushing for focus and discipline",
    "calm": "Calm, steady, crisp studio narration",
    "documentary": "Deep, thoughtful documentary narrator with clear pacing",
    "newsroom": "Crisp, authoritative broadcast news anchor delivery",
    "podcast": "Conversational, upbeat podcast host speaking naturally",
    "meditation": "Slow, soothing, peaceful mindfulness meditation guide",
}


def detect_language_breakdown(text: str) -> Dict[str, Any]:
    bn_chars = 0
    latin_chars = 0
    pt_markers = 0

    for ch in text:
        code = ord(ch)
        if BENGALI_RANGE_START <= code <= BENGALI_RANGE_END:
            bn_chars += 1
        elif ch.isalpha():
            latin_chars += 1
            if ch in PORTUGUESE_CHARS:
                pt_markers += 1

    total_alpha = bn_chars + latin_chars
    if total_alpha == 0:
        return {"primary": "en", "bengaliPercent": 0, "latinPercent": 0}

    bn_pct = round((bn_chars / total_alpha) * 100)
    latin_pct = 100 - bn_pct

    words_lower = set(re.findall(r"[a-zA-ZÀ-ÿ]+", text.lower()))
    pt_score = pt_markers * 2 + len(words_lower.intersection(PORTUGUESE_HINTS)) * 3
    en_score = len(words_lower.intersection(ENGLISH_HINTS)) * 2

    if bn_pct >= 65:
        primary = "bn"
    elif bn_pct >= 20:
        primary = "mixed"
    elif pt_score > en_score and pt_score >= 2:
        primary = "pt"
    else:
        primary = "en"

    return {
        "primary": primary,
        "bengaliPercent": bn_pct,
        "latinPercent": latin_pct,
    }


def split_sentences(text: str) -> List[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    parts = re.split(r"(?<=[।.!?])\s+", normalized)
    return [p.strip() for p in parts if p.strip()]


def build_smart_chunks(text: str, max_chunk_chars: int = 1200) -> List[str]:
    sentences = split_sentences(text)
    if not sentences:
        return []
    chunks: List[str] = []
    current = ""
    for sent in sentences:
        if len(sent) > max_chunk_chars:
            if current:
                chunks.append(current)
                current = ""
            for i in range(0, len(sent), max_chunk_chars):
                chunks.append(sent[i : i + max_chunk_chars].strip())
            continue
        candidate = f"{current} {sent}".strip() if current else sent
        if len(candidate) <= max_chunk_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = sent
    if current:
        chunks.append(current)
    return chunks


def recommend_style_preset(text: str, lang_primary: str) -> Dict[str, str]:
    lower = text.lower()
    exclamations = text.count("!")
    questions = text.count("?") + text.count("？")

    if any(k in lower for k in ["ঘুম", "সকাল", "অ্যালার্ম", "উঠুন", "wake up", "alarm", "morning", "acorde", "despertar"]):
        if exclamations >= 1 or any(k in lower for k in ["দ্রুত", "আর ঘুম নয়", "wake up", "rush", "agora"]):
            preset_id = "alarm"
        else:
            preset_id = "warm"
    elif any(k in lower for k in ["মনোযোগ", "পড়া", "অধ্যায়", "study", "focus", "discipline", "estudo", "foco"]):
        preset_id = "coach"
    elif any(k in lower for k in ["খবর", "ব্রেকিং", "সংবাদ", "news", "breaking", "report", "notícia"]):
        preset_id = "newsroom"
    elif any(k in lower for k in ["শ্বাস", "শান্ত", "ধ্যান", "meditation", "breathe", "relax", "calma", "respiração"]):
        preset_id = "meditation"
    elif any(k in lower for k in ["গল্প", "ইতিহাস", "রহস্য", "story", "history", "documentary", "história"]):
        preset_id = "documentary"
    elif questions >= 1 or len(text) > 220:
        preset_id = "podcast"
    else:
        preset_id = "calm"

    return {
        "presetId": preset_id,
        "stylePrompt": STYLE_PRESET_VALUES.get(preset_id, STYLE_PRESET_VALUES["calm"]),
        "language": lang_primary,
    }


def analyze_script(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw_text = payload.get("text")
    text = raw_text.strip() if isinstance(raw_text, str) else ""
    max_chars_raw = payload.get("maxChars")
    max_chars = int(max_chars_raw) if isinstance(max_chars_raw, (int, float)) and max_chars_raw > 0 else 5000

    if not text:
        return {
            "engine": "python",
            "charCount": 0,
            "wordCount": 0,
            "sentenceCount": 0,
            "estimatedSeconds": 0,
            "estimatedTokens": 0,
            "language": {"primary": "bn", "bengaliPercent": 0, "latinPercent": 0},
            "recommendedStyle": {"presetId": "calm", "stylePrompt": STYLE_PRESET_VALUES["calm"], "language": "bn"},
            "chunkCount": 0,
            "chunks": [],
            "overLimit": False,
        }

    # Normalize Unicode cleanly for accurate Bengali/accented character counting
    clean_text = unicodedata.normalize("NFC", text)
    words = [w for w in re.split(r"\s+", clean_text) if w.strip()]
    sentences = split_sentences(clean_text)
    lang_info = detect_language_breakdown(clean_text)

    # Speaking rate calibration: Bengali averages ~125 WPM (~2.08 w/s), English/PT ~145 WPM (~2.42 w/s)
    wpm = 125.0 if lang_info["bengaliPercent"] >= 45 else 145.0
    estimated_seconds = max(1, round((len(words) / wpm) * 60.0)) if words else 0
    estimated_tokens = max(12, math.ceil(len(clean_text) / 2.5) + 25)

    chunks = build_smart_chunks(clean_text, max_chunk_chars=min(max_chars, 1200))
    recommended_style = recommend_style_preset(clean_text, lang_info["primary"])

    return {
        "engine": "python",
        "charCount": len(clean_text),
        "wordCount": len(words),
        "sentenceCount": max(1, len(sentences)) if words else 0,
        "estimatedSeconds": estimated_seconds,
        "estimatedTokens": estimated_tokens,
        "language": lang_info,
        "recommendedStyle": recommended_style,
        "chunkCount": len(chunks),
        "chunks": chunks[:10],
        "overLimit": len(clean_text) > max_chars,
    }


def parse_slot_minutes(time_slot: str) -> int:
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$", time_slot or "", re.IGNORECASE)
    if not m:
        return 12 * 60
    hours = int(m.group(1))
    mins = int(m.group(2))
    period = m.group(3).upper()
    if period == "PM" and hours != 12:
        hours += 12
    if period == "AM" and hours == 12:
        hours = 0
    return max(0, min(1439, hours * 60 + mins))


def analyze_salon_insights(payload: Dict[str, Any]) -> Dict[str, Any]:
    booking_date = str(payload.get("bookingDate") or "").strip()
    today_date = str(payload.get("todayDate") or "").strip()
    now_minutes_raw = payload.get("nowMinutes")
    now_minutes = int(now_minutes_raw) if isinstance(now_minutes_raw, (int, float)) else -1
    tickets = payload.get("tickets")
    if not isinstance(tickets, list):
        tickets = []
    time_slots = payload.get("timeSlots")
    if not isinstance(time_slots, list) or not time_slots:
        time_slots = DEFAULT_TIME_SLOTS

    is_today = bool(booking_date and today_date and booking_date == today_date)

    slot_active_counts: Dict[str, int] = {str(s): 0 for s in time_slots}
    active_tickets = 0
    estimated_queue_wait_mins = 0

    for t in tickets:
        if not isinstance(t, dict):
            continue
        status = str(t.get("status") or "pending").lower()
        if status in ("pending", "confirmed"):
            active_tickets += 1
            slot_key = str(t.get("timeSlot") or "")
            if slot_key in slot_active_counts:
                slot_active_counts[slot_key] += 1
            svc_key = str(t.get("serviceKey") or "haircut").lower()
            base_dur = SERVICE_DURATION_MINS.get(svc_key, 30)
            estimated_queue_wait_mins += max(10, round(base_dur * 0.8))

    slot_summaries: List[Dict[str, Any]] = []
    open_candidates: List[Tuple[int, int, str]] = []

    for idx, raw_slot in enumerate(time_slots):
        slot = str(raw_slot)
        slot_mins = parse_slot_minutes(slot)
        expired = is_today and now_minutes >= 0 and slot_mins <= now_minutes
        booked_count = slot_active_counts.get(slot, 0)
        if expired:
            load_level = "expired"
        elif booked_count == 0:
            load_level = "open"
        elif booked_count == 1:
            load_level = "moderate"
        else:
            load_level = "busy"

        slot_summaries.append({
            "timeSlot": slot,
            "bookedCount": booked_count,
            "expired": expired,
            "loadLevel": load_level,
            "estimatedWaitMins": booked_count * 25,
        })
        if not expired:
            open_candidates.append((booked_count, idx, slot))

    open_candidates.sort(key=lambda item: (item[0], item[1]))
    best_slot = open_candidates[0][2] if open_candidates else None
    best_slot_booked = open_candidates[0][0] if open_candidates else 0

    return {
        "engine": "python",
        "bookingDate": booking_date,
        "activeQueueCount": active_tickets,
        "estimatedQueueWaitMins": estimated_queue_wait_mins,
        "bestSlot": best_slot,
        "bestSlotBookedCount": best_slot_booked,
        "openSlotsCount": len(open_candidates),
        "slots": slot_summaries,
    }


def inspect_audio_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    b64_data = payload.get("audioData")
    if not isinstance(b64_data, str) or not b64_data.strip():
        return {"error": "audioData (base64) is required"}

    try:
        raw_bytes = base64.b64decode(b64_data.strip(), validate=False)
    except Exception as exc:
        return {"error": f"Invalid base64 audio payload: {exc}"}

    sample_rate = int(payload.get("sampleRate") or 24000)
    channels = int(payload.get("channels") or 1)
    pcm_bytes = raw_bytes

    if len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WAVE":
        try:
            with wave.open(io.BytesIO(raw_bytes), "rb") as wf:
                channels = wf.getnchannels() or 1
                sample_rate = wf.getframerate() or 24000
                pcm_bytes = wf.readframes(wf.getnframes())
        except Exception:
            pass

    sample_count = len(pcm_bytes) // 2
    if sample_count == 0:
        return {
            "engine": "python",
            "sampleRate": sample_rate,
            "channels": channels,
            "durationSeconds": 0.0,
            "peakDbfs": -96.0,
            "rmsDbfs": -96.0,
            "byteLength": len(raw_bytes),
        }

    # Unpack 16-bit signed PCM frames cleanly with struct
    samples = struct.unpack(f"<{sample_count}h", pcm_bytes[: sample_count * 2])
    peak = 0
    sum_sq = 0.0
    step = 1 if sample_count <= 48000 else max(1, sample_count // 24000)
    sampled_n = 0
    for i in range(0, sample_count, step):
        val = abs(samples[i])
        if val > peak:
            peak = val
        sum_sq += float(val * val)
        sampled_n += 1

    peak_norm = max(1e-6, peak / 32768.0)
    rms_norm = max(1e-6, math.sqrt(sum_sq / max(1, sampled_n)) / 32768.0)
    peak_db = round(20.0 * math.log10(peak_norm), 1)
    rms_db = round(20.0 * math.log10(rms_norm), 1)
    duration_sec = round(sample_count / max(1, sample_rate * channels), 2)

    return {
        "engine": "python",
        "sampleRate": sample_rate,
        "channels": channels,
        "durationSeconds": duration_sec,
        "peakDbfs": peak_db,
        "rmsDbfs": rms_db,
        "byteLength": len(raw_bytes),
    }


class SmartEngineHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep stdout quiet except for startup/errors
        pass

    def _send_json(self, status: int, body: Dict[str, Any]) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json_body(self) -> Optional[Dict[str, Any]]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length <= 0 or length > 16 * 1024 * 1024:
            return {}
        raw = self.rfile.read(length)
        try:
            parsed = json.loads(raw.decode("utf-8"))
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return None

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(
                200,
                {
                    "status": "ok",
                    "engine": "python",
                    "pythonVersion": sys.version.split()[0],
                    "pid": os.getpid(),
                },
            )
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            self._send_json(400, {"error": "Invalid JSON body"})
            return

        if self.path == "/analyze-script":
            self._send_json(200, analyze_script(payload))
            return
        if self.path == "/salon-insights":
            self._send_json(200, analyze_salon_insights(payload))
            return
        if self.path == "/audio-inspect":
            res = inspect_audio_payload(payload)
            status = 400 if "error" in res else 200
            self._send_json(status, res)
            return

        self._send_json(404, {"error": "Unknown smart engine endpoint"})


def main() -> None:
    parser = argparse.ArgumentParser(description="Srabon Go Python Smart Backend")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PY_ENGINE_PORT", "8765")))
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), SmartEngineHandler)
    server.daemon_threads = True

    def _shutdown(_signum: int, _frame: Any) -> None:
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    print(f"[Python Smart Engine] Listening on http://{args.host}:{args.port} (Python {sys.version.split()[0]})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
