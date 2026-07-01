from __future__ import annotations

import io
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import librosa
import imageio_ffmpeg


def _decode_with_ffmpeg(input_path: str, format_hint: str | None = None) -> tuple[np.ndarray, int]:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
        output_path = temp_wav.name

    try:
        command = [
            ffmpeg_exe,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
        ]
        if format_hint:
            command.extend(["-f", format_hint])
        command.extend(
            [
                "-i",
                input_path,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ac",
                "1",
                "-ar",
                "16000",
                output_path,
            ]
        )

        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            error_text = (result.stderr or result.stdout or "unknown ffmpeg error").strip()
            raise RuntimeError(error_text)

        data, sr = sf.read(output_path, dtype="float32", always_2d=False)
        if isinstance(data, np.ndarray) and data.ndim == 2:
            data = np.mean(data, axis=1).astype(np.float32)
        return np.asarray(data, dtype=np.float32), int(sr)
    finally:
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except OSError:
            pass


def decode_audio_bytes(audio_bytes: bytes, filename: str | None = None) -> tuple[np.ndarray, int]:
    """Decode audio bytes. Prefer soundfile, then fallback to bundled ffmpeg transcode."""
    if not audio_bytes:
        raise ValueError("empty audio")

    try:
        data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
        if data.ndim == 2:
            data = np.mean(data, axis=1).astype(np.float32)
        return data.astype(np.float32), int(sr)
    except Exception as exc:
        extension = Path((filename or "")).suffix.lower()
        with tempfile.NamedTemporaryFile(suffix=extension or ".audio", delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_path = temp_audio.name

        try:
            if extension in {".m4a", ".mp4"}:
                hints = [None, "mp4", "mov"]
            elif extension == ".aac":
                hints = [None, "aac"]
            else:
                hints = [None]

            errors: list[str] = []
            for hint in hints:
                try:
                    return _decode_with_ffmpeg(temp_path, hint)
                except Exception as ffmpeg_exc:
                    hint_label = hint or "auto"
                    errors.append(f"{hint_label}: {ffmpeg_exc}")

            detail = " | ".join(errors[:3])
            raise ValueError(
                "Audio decoding failed. Supported formats are WAV, FLAC, OGG, and M4A. "
                f"ffmpeg details: {detail}"
            ) from exc
        finally:
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except OSError:
                pass


def to_16k_mono(waveform: np.ndarray, sr: int) -> tuple[np.ndarray, int]:
    if waveform.ndim != 1:
        waveform = np.mean(waveform, axis=-1)
    waveform = waveform.astype(np.float32)
    if sr != 16000:
        waveform = librosa.resample(waveform, orig_sr=sr, target_sr=16000)
        sr = 16000
    return waveform.astype(np.float32), sr
