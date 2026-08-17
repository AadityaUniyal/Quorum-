import pathlib
import sys

# Ensure repository root is on PYTHONPATH
repo_root = pathlib.Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

# Ensure the tests package directory is also on PYTHONPATH
tests_path = repo_root / "tests"
if str(tests_path) not in sys.path:
    sys.path.insert(0, str(tests_path))
