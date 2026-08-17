import os, sys
# Ensure the backend/app package can be imported as top-level `app`
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
if _root not in sys.path:
    sys.path.insert(0, _root)
