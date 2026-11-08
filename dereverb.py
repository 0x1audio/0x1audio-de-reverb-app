"""SonicDryer. One action, dry: every run uses UVR-DeEcho-DeReverb by FoxJoy."""

from __future__ import annotations

import time
import traceback
from pathlib import Path

import ox1audio as ox

from separate import separate_file

MODEL = "UVR-DeEcho-DeReverb by FoxJoy"
_KEEP = {"wav", "flac", "mp3", "ogg"}


@ox.action("Dry it", timeout=3 * 3600)
def dry(recording: ox.Files("audio", multiple=False), output: ox.Folder(label="Save to") | None = None):
    """Take the reverb and echo out of one recording. The dry copy lands next to it, or in output."""
    source = str(recording)
    folder = str(output or recording.parent)
    suffix = recording.suffix.lower().lstrip(".")
    written = _dry(source, folder, suffix if suffix in _KEEP else "wav")
    return [ox.sound(path, title=Path(path).stem) for path in written]


def _dry(source: str, output: str, audio_format: str) -> list[str]:
    written: list[str] = []
    started = time.perf_counter()
    folder = Path(output)
    before = {item.name for item in _owned(folder, Path(source).stem)}
    try:
        state = {"fraction": 0.0, "label": "Getting ready"}
        ox.progress(0, state["label"])

        def on_progress(fraction: float, state=state) -> None:
            _show(state, fraction)

        def on_status(text: str, state=state) -> None:
            _show(state, state["fraction"], _phase(text, "Drying audio"))

        gpu = _use_gpu()
        try:
            produced = _once(source, output, audio_format, gpu, on_progress, on_status)
        except (ox.Cancelled, ox.Problem, ValueError):
            raise
        except Exception:
            if not gpu:
                raise
            traceback.print_exc()
            _cleanup(folder, Path(source).stem, before)
            state["fraction"] = 0.0
            state["label"] = "Getting ready"
            ox.progress(0, state["label"])
            produced = _once(source, output, audio_format, False, on_progress, on_status)
        written.extend(_present(path) for path in produced)
    except ox.Cancelled:
        _cleanup(folder, Path(source).stem, before)
        raise
    except (ox.Problem, ValueError) as exc:
        _cleanup(folder, Path(source).stem, before)
        raise ox.Problem(_plain(str(exc))) from exc
    except Exception as exc:
        traceback.print_exc()
        _cleanup(folder, Path(source).stem, before)
        raise ox.Problem("The audio couldn't be dried. Your original file was not changed.") from exc
    ox.progress(1, "Saved.")
    print(f"Dried {Path(source).name} in {time.strftime('%H:%M:%S', time.gmtime(int(time.perf_counter() - started)))}")
    return written


def _once(source, output, audio_format, gpu, on_progress, on_status):
    return separate_file(
        source,
        output,
        method="vr",
        model=MODEL,
        secondary=None,
        algorithm="avg",
        stems=["No Reverb"],
        audio_format=audio_format,
        segment=8,
        overlap=0.25,
        aggression=10,
        window=1024,
        shifts=0,
        denoise=False,
        high_end=False,
        tta=False,
        gpu=gpu,
        on_progress=on_progress,
        on_status=on_status,
        console_prefix="",
    )


def _show(state: dict, fraction: float, label: str | None = None) -> None:
    state["fraction"] = max(state["fraction"], min(1, max(0, fraction)))
    if label:
        state["label"] = label
    ox.progress(state["fraction"], state["label"])  # raises ox.Cancelled after Stop


def _phase(text: str, working: str) -> str | None:
    lowered = " ".join(str(text).split()).lower()
    if not lowered or lowered in {"done!", "done"}:
        return None
    if lowered.startswith("downloading model"):
        return " ".join(str(text).split())
    if "download" in lowered:
        return "Downloading model"
    if "install" in lowered or "runtime" in lowered:
        return "Getting ready"
    if "loading" in lowered:
        return "Loading the model"
    if "sav" in lowered or "export" in lowered:
        return "Saving"
    if "inference" in lowered or "process" in lowered:
        return working
    return None


def _use_gpu() -> bool:
    try:
        import torch
    except Exception:
        return False
    try:
        if torch.cuda.is_available():
            return True
    except Exception:
        pass
    mps = getattr(getattr(torch, "backends", None), "mps", None)
    if mps is None:
        return False
    try:
        return bool(mps.is_available())
    except Exception:
        return False


def _present(path: str) -> str:
    file = Path(path)
    name = file.name.replace("_(No Reverb)", " (Dry audio)")
    target = _unused(file.with_name(name))
    if target != file:
        file.replace(target)
    return str(target)


def _unused(path: Path) -> Path:
    if not path.exists():
        return path
    number = 2
    while True:
        candidate = path.with_name(f"{path.stem} {number}{path.suffix}")
        if not candidate.exists():
            return candidate
        number += 1


def _owned(folder: Path, stem: str):
    if not folder.is_dir() or not stem:
        return []
    return [child for child in folder.iterdir() if child.is_file() and child.name.startswith(stem)]


def _cleanup(folder: Path, stem: str, before: set[str]) -> None:
    for child in _owned(folder, stem):
        if child.name not in before and child.name != stem:
            child.unlink(missing_ok=True)


def _plain(text: str) -> str:
    lowered = text.lower()
    if "download this model" in lowered:
        return "There isn't enough free space to download this model."
    if "stopped before it finished" in lowered:
        return "The model download stopped before it finished. Try it again."
    if "not a supported audio file" in lowered:
        return "That file isn't audio. Choose a recording, like an MP3 or WAV."
    if "no such file" in lowered or "not found" in lowered:
        return "This recording can't be opened."
    if "no space" in lowered or "not enough" in lowered:
        return "There's not enough free space to save the new file."
    if "permission" in lowered:
        return "Couldn't save next to the original. Choose a folder you can write to."
    if "being used" in lowered or "locked" in lowered:
        return "That file is open in another app. Close it, then try again."
    if text.startswith("The audio couldn't") or text.startswith("That file") or text.startswith("That recording") or text.startswith("Couldn't save") or text.startswith("There's not") or text.startswith("This recording"):
        return text
    return "The audio couldn't be dried. Your original file was not changed."

