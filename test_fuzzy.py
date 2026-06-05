
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

from tools.files import find_file_fuzzy

def test_fuzzy():
    # Create some dummy files
    test_dir = Path("test_fuzzy_dir")
    test_dir.mkdir(exist_ok=True)
    (test_dir / "Budget_2024_Final.pdf").touch()
    (test_dir / "Project_Roadmap_v2.docx").touch()
    (test_dir / "Meeting_Notes_June.txt").touch()

    print("Testing fuzzy search for 'budget 2024'...")
    res = find_file_fuzzy("budget 2024", path=str(test_dir))
    print(f"Result: {res}")

    print("\nTesting fuzzy search for 'roadmap'...")
    res = find_file_fuzzy("roadmap", path=str(test_dir))
    print(f"Result: {res}")

    print("\nTesting fuzzy search for 'meeting'...")
    res = find_file_fuzzy("meeting", path=str(test_dir))
    print(f"Result: {res}")

    # Cleanup
    for f in test_dir.iterdir():
        f.unlink()
    test_dir.rmdir()

if __name__ == "__main__":
    test_fuzzy()
