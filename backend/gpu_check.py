"""
Whether this machine can run the local vision model usefully.

Ollama accelerates on NVIDIA CUDA, AMD ROCm and Apple Metal. Intel integrated
graphics are not supported, so a 7B vision model falls back to CPU — measured
at roughly three minutes per step on this project's hardware, against a
five-minute task limit. Offering it there is offering something that cannot
finish.

Detection is deliberately cheap: no ML libraries are imported.
"""

import functools
import logging
import subprocess

logger = logging.getLogger("torch.gpu")

_DISCRETE_MARKERS = ("nvidia", "geforce", "quadro", "tesla", "radeon", "rx ", "amd ")


def _nvidia_smi_present() -> bool:
    try:
        subprocess.run(
            ["nvidia-smi"],
            capture_output=True,
            timeout=5,
            check=True,
        )
        return True
    except Exception:
        return False


def _windows_gpu_names() -> str:
    """Adapter names from Windows, lowercased. Empty string if unavailable."""
    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_VideoController).Name",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return (result.stdout or "").lower()
    except Exception as exc:
        logger.warning(f"Could not read GPU information: {exc}")
        return ""


@functools.lru_cache(maxsize=1)
def has_accelerated_gpu() -> bool:
    """True when a GPU Ollama can actually use is present."""
    if _nvidia_smi_present():
        return True

    names = _windows_gpu_names()
    if not names:
        return False

    # Intel integrated graphics report as "Intel(R) ... Graphics" and are not
    # accelerated by Ollama, so they must not count as a yes.
    return any(marker in names for marker in _DISCRETE_MARKERS)


def local_vision_status() -> dict:
    """What to tell the user about local vision on this machine."""
    if has_accelerated_gpu():
        return {
            "available": True,
            "message": "Local screen vision can run on this computer.",
        }
    return {
        "available": False,
        "message": (
            "This computer has no graphics card TORCH can use for local screen "
            "vision, so it uses Windows automation instead — which is faster anyway."
        ),
    }
