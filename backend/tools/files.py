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


def find_file_fuzzy(name: str, path: str = "~") -> dict:
    """
    Search for a file with fuzzy matching when exact match fails.
    Returns: { "found": str|None, "suggestions": list[str], "exact": bool }
    """
    import difflib
    from pathlib import Path

    search_path = Path(path).expanduser().resolve()
    all_files = []
    
    # Clean input name
    search_name = name.lower().strip()
    search_stem = Path(search_name).stem.lower()

    try:
        for root, dirs, files in os.walk(search_path):
            # Skip hidden and system directories
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in (
                'node_modules', '__pycache__', '.git', 'venv', '.venv',
                'Windows', 'Program Files', '$Recycle.Bin', 'AppData'
            )]
            for f in files:
                full_path = os.path.join(root, f)
                all_files.append(full_path)
                if len(all_files) > 5000:  # Increased limit for better results
                    break
            if len(all_files) > 5000:
                break
    except PermissionError:
        pass

    # 1. Check for exact substring matches first (case-insensitive)
    exact_matches = [f for f in all_files if search_name in os.path.basename(f).lower()]
    
    if exact_matches:
        # Sort by length to find the most "exact" one (shorter names often better matches)
        exact_matches.sort(key=lambda x: len(os.path.basename(x)))
        return {
            "found": exact_matches[0],
            "suggestions": exact_matches[:3],
            "exact": True
        }

    # 2. Fuzzy match using difflib
    fuzzy_matches = []
    for fpath in all_files:
        fname = os.path.basename(fpath)
        fstem = Path(fname).stem.lower()
        
        # Compare stems (filenames without extensions)
        ratio = difflib.SequenceMatcher(None, search_stem, fstem).ratio()
        
        # Also check if search_stem is a substring of fstem or vice versa
        if search_stem in fstem or fstem in search_stem:
            ratio = max(ratio, 0.8)
            
        if ratio > 0.6:
            fuzzy_matches.append((ratio, fpath))

    # Sort by ratio (highest first)
    fuzzy_matches.sort(key=lambda x: x[0], reverse=True)
    top_matches = [f for _, f in fuzzy_matches[:3]]

    return {
        "found": top_matches[0] if top_matches else None,
        "suggestions": top_matches,
        "exact": False
    }


def list_directory(path: str = "~") -> str:
    """List all files in a directory in a formatted way."""
    dir_path = Path(path).expanduser().resolve()
    if not dir_path.exists():
        return f"Directory not found: {dir_path}"
    if not dir_path.is_dir():
        return f"Not a directory: {dir_path}"

    try:
        files = list(dir_path.iterdir())
    except PermissionError:
        return f"Permission denied accessing {dir_path}"

    if not files:
        return f"Directory {dir_path} is empty."

    # Sort: directories first, then files by name
    dirs = sorted([f for f in files if f.is_dir()], key=lambda x: x.name.lower())
    docs = sorted([f for f in files if f.is_file()], key=lambda x: x.name.lower())

    lines = [f"Contents of {dir_path}:"]
    
    if dirs:
        lines.append("\nDirectories:")
        for d in dirs[:15]:
            lines.append(f"  [DIR]  {d.name}")
        if len(dirs) > 15:
            lines.append(f"  ... and {len(dirs) - 15} more directories")

    if docs:
        lines.append("\nFiles:")
        for f in docs[:30]:
            size_str = _format_size(f.stat().st_size)
            lines.append(f"  {f.name} ({size_str})")
        if len(docs) > 30:
            lines.append(f"  ... and {len(docs) - 30} more files")

    return "\n".join(lines)
