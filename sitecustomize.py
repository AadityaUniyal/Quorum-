import pathlib
import sys

repo_root = pathlib.Path(__file__).resolve().parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

# Add tests and backend directories to PYTHONPATH (tests first to avoid conflict)
tests_path = repo_root / 'tests'
if str(tests_path) not in sys.path:
    sys.path.insert(0, str(tests_path))

backend_path = repo_root / 'backend' / 'app'
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

# Alias backend.app as top-level app module for imports
# Deferred import – pytest conftest will set env vars and import backend.app as needed.
