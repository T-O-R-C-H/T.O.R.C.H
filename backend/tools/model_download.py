"""
Opt-in model downloads.

Both the speech-to-text model and the Kokoro voice are large files fetched from
Hugging Face, and neither may be fetched implicitly: the libraries that use
them will happily download on first use, which would mean pressing a button
starts a hundred-megabyte transfer on someone's metered connection.

This is the shared state machine. Anything that owns a downloadable model
holds one of these and exposes it; the only code that touches the network is
start(), and start() is only ever reached from an explicit yes.
"""

import logging
import os
import threading
from typing import Any, Dict, Sequence

logger = logging.getLogger("torch.tools.model_download")


class ModelDownload:
    """Tracks one downloadable model: whether it is present, and progress."""

    def __init__(
        self,
        *,
        repo_id: str,
        target_dir_factory,
        allow_patterns: Sequence[str],
        required_files: Sequence[str],
        total_bytes: int,
        label: str,
    ) -> None:
        self.repo_id = repo_id
        self._target_dir_factory = target_dir_factory
        self.allow_patterns = list(allow_patterns)
        self.required_files = list(required_files)
        self.total_bytes = total_bytes
        self.label = label

        self._lock = threading.Lock()
        self._state: Dict[str, Any] = {
            "state": "idle",  # idle | downloading | ready | error
            "downloaded_bytes": 0,
            "total_bytes": total_bytes,
            "error": None,
        }

    @property
    def target_dir(self) -> str:
        return self._target_dir_factory()

    def present(self) -> bool:
        """
        Whether the model is usable, judged from the files on disk.

        Not from a flag: the app may have been restarted since the download,
        and a half-finished download must not read as ready and crash the
        loader that trusts it.
        """
        directory = self.target_dir
        for name in self.required_files:
            path = os.path.join(directory, name)
            if not os.path.isfile(path) or os.path.getsize(path) == 0:
                return False
        return True

    def state(self) -> Dict[str, Any]:
        with self._lock:
            snapshot = dict(self._state)
        if snapshot["state"] in ("idle", "ready") and self.present():
            snapshot["state"] = "ready"
            snapshot["downloaded_bytes"] = snapshot["total_bytes"]
        return snapshot

    def _set(self, **changes: Any) -> None:
        with self._lock:
            self._state.update(changes)

    def _progress_tqdm(self):
        """A tqdm stand-in that accumulates bytes across every file's bar."""
        from tqdm import tqdm as _tqdm

        outer = self

        class ProgressTqdm(_tqdm):
            def update(self, n=1):  # type: ignore[override]
                result = super().update(n)
                with outer._lock:
                    outer._state["downloaded_bytes"] += n or 0
                return result

        return ProgressTqdm

    def _worker(self) -> None:
        from huggingface_hub import snapshot_download

        try:
            os.makedirs(self.target_dir, exist_ok=True)
            snapshot_download(
                repo_id=self.repo_id,
                local_dir=self.target_dir,
                allow_patterns=self.allow_patterns,
                tqdm_class=self._progress_tqdm(),
                max_workers=2,
            )
            if not self.present():
                raise RuntimeError("download finished but the files are missing")
            self._set(state="ready", downloaded_bytes=self.total_bytes, error=None)
            logger.info("%s ready at %s", self.label, self.target_dir)
        except Exception as exc:
            logger.error("%s download failed: %s", self.label, exc)
            self._set(
                state="error",
                error="The download didn't finish. Check your connection and try again.",
            )

    def start(self) -> Dict[str, Any]:
        """Begin the download. The only place in TORCH that fetches a model."""
        with self._lock:
            if self._state["state"] == "downloading":
                return dict(self._state)
            if self.present():
                self._state.update(
                    state="ready", downloaded_bytes=self.total_bytes, error=None
                )
                return dict(self._state)
            self._state.update(
                state="downloading",
                downloaded_bytes=0,
                total_bytes=self.total_bytes,
                error=None,
            )

        threading.Thread(
            target=self._worker, daemon=True, name=f"{self.label}-download"
        ).start()
        return self.state()

    def reset(self) -> None:
        """Clear progress between tests."""
        self._set(
            state="idle", downloaded_bytes=0, total_bytes=self.total_bytes, error=None
        )


class UrlModelDownload(ModelDownload):
    """
    A model published as plain files rather than a Hugging Face repo.

    Same contract as the parent - present(), state(), start() - so callers and
    the UI cannot tell the two apart. Only the fetch differs: this streams
    from URLs, because not every model lives on the Hub.
    """

    def __init__(
        self,
        *,
        files: Dict[str, str],
        target_dir_factory,
        total_bytes: int,
        label: str,
    ) -> None:
        super().__init__(
            repo_id="",
            target_dir_factory=target_dir_factory,
            allow_patterns=[],
            required_files=list(files.keys()),
            total_bytes=total_bytes,
            label=label,
        )
        self.files = dict(files)

    def _worker(self) -> None:
        import urllib.request

        try:
            os.makedirs(self.target_dir, exist_ok=True)
            for name, url in self.files.items():
                destination = os.path.join(self.target_dir, name)
                # Download beside the target and rename at the end, so an
                # interrupted transfer cannot leave a truncated file that
                # present() would read as ready.
                partial = destination + ".part"
                with urllib.request.urlopen(url, timeout=60) as response:
                    expected = int(response.headers.get("Content-Length") or 0)
                    written = 0
                    with open(partial, "wb") as handle:
                        while True:
                            block = response.read(262144)
                            if not block:
                                break
                            handle.write(block)
                            written += len(block)
                            with self._lock:
                                self._state["downloaded_bytes"] += len(block)

                # A dropped connection ends the read loop exactly like a
                # finished one. Without this check a truncated file was
                # renamed into place and later read as ready - which is how a
                # 180 MB fragment of a 325 MB model reached the loader and
                # failed there instead, as a protobuf parse error.
                if expected and written != expected:
                    os.remove(partial)
                    raise RuntimeError(
                        f"{name} came down short: {written} of {expected} bytes"
                    )
                os.replace(partial, destination)

            if not self.present():
                raise RuntimeError("download finished but the files are missing")
            self._set(state="ready", downloaded_bytes=self.total_bytes, error=None)
            logger.info("%s ready at %s", self.label, self.target_dir)
        except Exception as exc:
            logger.error("%s download failed: %s", self.label, exc)
            self._set(
                state="error",
                error="The download didn't finish. Check your connection and try again.",
            )
