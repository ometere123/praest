"""Windows compatibility for gltest's open-stdin temporary file cleanup."""

import os
import tempfile
from pathlib import Path


_open_temp_paths: set[str] = set()


if os.name == "nt":
    _real_mkstemp = tempfile.mkstemp
    _real_unlink = os.unlink

    def _mkstemp(*args, **kwargs):
        fd, path = _real_mkstemp(*args, **kwargs)
        _open_temp_paths.add(os.path.abspath(path))
        return fd, path

    def _unlink(path, *args, **kwargs):
        normalized = os.path.abspath(os.fspath(path))
        if normalized in _open_temp_paths:
            return
        return _real_unlink(path, *args, **kwargs)

    tempfile.mkstemp = _mkstemp
    os.unlink = _unlink


def pytest_sessionfinish(session, exitstatus):
    for path in tuple(_open_temp_paths):
        try:
            _real_unlink(path)
        except (FileNotFoundError, PermissionError):
            pass
