"""
Quorum OS — E2E Testing Suite Helpers & Validators
Provides reusable inspection, AST, and HTTP utilities for opaque-box E2E tests.
"""

import json
import os
import pathlib
import re
from typing import Any, Dict, List, Optional, Set

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[2]
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
BACKEND_ROOT = PROJECT_ROOT / "backend"


def get_project_root() -> pathlib.Path:
    return PROJECT_ROOT


def get_frontend_root() -> pathlib.Path:
    return FRONTEND_ROOT


def get_backend_root() -> pathlib.Path:
    return BACKEND_ROOT


def read_file_safely(path: pathlib.Path) -> str:
    """Reads a file with UTF-8 encoding, returning empty string if missing."""
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return path.read_text(encoding="latin-1", errors="ignore")


def read_frontend_file(rel_path: str) -> str:
    """Reads a file relative to frontend root."""
    return read_file_safely(FRONTEND_ROOT / rel_path)


def read_backend_file(rel_path: str) -> str:
    """Reads a file relative to backend root."""
    return read_file_safely(BACKEND_ROOT / rel_path)


def extract_css_properties(css_content: str) -> Dict[str, str]:
    """Extracts CSS variable definitions from CSS content."""
    properties = {}
    pattern = re.compile(r"(--[\w-]+)\s*:\s*([^;]+);")
    for match in pattern.finditer(css_content):
        properties[match.group(1).strip()] = match.group(2).strip()
    return properties


def check_regex_in_file(path: pathlib.Path, pattern: str) -> bool:
    """Returns True if the regex pattern is found in the file."""
    content = read_file_safely(path)
    return bool(re.search(pattern, content))


def find_files_with_extension(root_dir: pathlib.Path, extensions: Set[str]) -> List[pathlib.Path]:
    """Recursively finds files with given extensions, ignoring node_modules and .next."""
    matched = []
    ignored = {"node_modules", ".next", ".git", "__pycache__", ".venv"}
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in ignored]
        for file in files:
            ext = pathlib.Path(file).suffix
            if ext in extensions:
                matched.append(pathlib.Path(root) / file)
    return matched


def scan_for_forbidden_strings(root_dir: pathlib.Path, forbidden_strings: List[str], extensions: Set[str]) -> List[Dict[str, Any]]:
    """Scans files for forbidden strings, returning list of violations with file and line numbers."""
    violations = []
    files = find_files_with_extension(root_dir, extensions)
    for f in files:
        content = read_file_safely(f)
        lines = content.splitlines()
        for idx, line in enumerate(lines, start=1):
            for forbidden in forbidden_strings:
                if forbidden.lower() in line.lower():
                    # Ignore comment exclusions or benign imports if specified
                    violations.append({
                        "file": str(f.relative_to(PROJECT_ROOT)),
                        "line": idx,
                        "content": line.strip(),
                        "matched": forbidden,
                    })
    return violations


def get_fastapi_registered_routes(app: Any) -> List[Dict[str, Any]]:
    """Returns all registered routes in a FastAPI application."""
    routes = []
    for route in app.routes:
        methods = getattr(route, "methods", set())
        path = getattr(route, "path", "")
        name = getattr(route, "name", "")
        routes.append({
            "path": path,
            "methods": sorted(list(methods)) if methods else [],
            "name": name,
        })
    return routes


def check_route_exists(app: Any, path_prefix: str, method: str) -> bool:
    """Checks if a route matching path_prefix and method exists in FastAPI app."""
    for route in app.routes:
        methods = getattr(route, "methods", set())
        path = getattr(route, "path", "")
        if method.upper() in methods and (path == path_prefix or path.startswith(path_prefix)):
            return True
    return False


def extract_ts_method_signatures(ts_file_content: str) -> List[str]:
    """Extracts async method names declared in an object or class."""
    pattern = re.compile(r"^\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)", re.MULTILINE)
    return pattern.findall(ts_file_content)
