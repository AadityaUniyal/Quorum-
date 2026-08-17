import pathlib

# Expose backend/app as this package's path so submodules resolve correctly
repo_root = pathlib.Path(__file__).resolve().parent.parent
backend_path = repo_root / 'backend' / 'app'
__path__ = [str(backend_path)]
