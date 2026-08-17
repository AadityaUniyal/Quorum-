# conftest to ensure the local tests package is importable before pytest collection
import pathlib
import sys

# Add repository root to sys.path early
repo_root = pathlib.Path(__file__).resolve().parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
