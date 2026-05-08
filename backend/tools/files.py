"""
TORCH Tools — File Operations
Search, read, move, delete, and manage files.
"""

import os
import shutil
import zipfile
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

logger = logging.getLogger("torch.tools.files")


def find_file(name: str, path: str = "~") -> str:
    """Recursively search for a file by name."""
    search_path = Path(path).expanduser().resolve()
    logger.info(f"Searching for '{name}' in {search_path}")

    matches = []
    try:
        for root, dirs, files in os.walk(search_path):
            # Skip hidden and system directories
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in (
                'node_modules', '__pycache__', '.git', 'venv', '.venv'
            )]
            for f in files:
                if name.lower() in f.lower():
                    full_path = os.path.join(root, f)
                    size = os.path.getsize(full_path)
                    matches.append({"path": full_path, "size": size})
                    if len(matches) >= 20:  # Limit results
                        break
            if len(matches) >= 20:
                break
    except PermissionError:
        pass

    if not matches:
        return f"No files matching '{name}' found in {search_path}"

    result_lines = [f"Found {len(matches)} file(s):"]
    for m in matches:
        size_str = _format_size(m["size"])
        result_lines.append(f"  {m['path']} ({size_str})")

    return "\n".join(result_lines)


def read_pdf(filepath: str) -> str:
    """Extract text from a PDF file."""
    import pdfplumber

    filepath = Path(filepath).expanduser().resolve()
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    text_parts = []
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                text_parts.append(f"--- Page {i + 1} ---\n{text}")

    if not text_parts:
        return "PDF contains no extractable text"

    return "\n\n".join(text_parts)


def read_word(filepath: str) -> str:
    """Extract text from a Word document."""
    from docx import Document

    filepath = Path(filepath).expanduser().resolve()
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    doc = Document(str(filepath))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs) if paragraphs else "Document is empty"


def read_excel(filepath: str) -> str:
    """Extract data from an Excel file."""
    from openpyxl import load_workbook

    filepath = Path(filepath).expanduser().resolve()
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    wb = load_workbook(str(filepath), read_only=True, data_only=True)
    results = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        results.append(f"Sheet: {sheet_name}")
        for row in rows[:50]:  # Limit rows
            results.append("  " + " | ".join(str(c) if c is not None else "" for c in row))

    wb.close()
    return "\n".join(results) if results else "Spreadsheet is empty"


def move_file(src: str, dst: str) -> str:
    """Move a file from source to destination."""
    src_path = Path(src).expanduser().resolve()
    dst_path = Path(dst).expanduser().resolve()

    if not src_path.exists():
        raise FileNotFoundError(f"Source not found: {src_path}")

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src_path), str(dst_path))
    return f"Moved {src_path} → {dst_path}"


def delete_file(filepath: str) -> str:
    """Delete a file. Always requires HITL approval."""
    path = Path(filepath).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if path.is_dir():
        shutil.rmtree(path)
        return f"Deleted directory: {path}"
    else:
        path.unlink()
        return f"Deleted file: {path}"


def create_folder(path: str) -> str:
    """Create a new directory."""
    dir_path = Path(path).expanduser().resolve()
    dir_path.mkdir(parents=True, exist_ok=True)
    return f"Created directory: {dir_path}"


def zip_files(files: List[str], output: str) -> str:
    """Compress files into a zip archive."""
    output_path = Path(output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(str(output_path), 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            fp = Path(f).expanduser().resolve()
            if fp.exists():
                zf.write(str(fp), fp.name)

    return f"Created archive: {output_path}"


def _format_size(size_bytes: int) -> str:
    """Format bytes to human-readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f}TB"
