"""
Storage Service & Pluggable Object Storage Abstraction

Supports:
- Local filesystem storage adapter
- MinIO / AWS S3 compatible object storage adapter
- SHA-256 content hashing for integrity, versioning, and deduplication
- File extension and magic-byte MIME type validation
- Size limit enforcement and path traversal sanitization
"""

import abc
import hashlib
import logging
import os
import re
import uuid
from typing import Any

from app.config import settings
from fastapi import HTTPException, UploadFile, status

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".tiff"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit

# Mapping from MIME types to allowed extensions
_MIME_TO_EXTENSIONS = {
    "application/pdf": {".pdf"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "text/plain": {".txt"},
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/tiff": {".tiff"},
}

# Magic number signatures for manual fallback MIME detection
_FILE_SIGNATURES = [
    (b"%PDF", "application/pdf"),
    (b"PK\x03\x04", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"II\x2a\x00", "image/tiff"),
    (b"MM\x00\x2a", "image/tiff"),
]

_magic_available = False
try:
    import magic as _magic
    _magic_available = True
except ImportError:
    _magic = None


def sanitize_filename(filename: str | None) -> str:
    """Sanitizes filename against path traversal and special control characters."""
    if not filename:
        return "unnamed_document"
    base = os.path.basename(filename)
    sanitized = re.sub(r"[^\w\-.]", "_", base)
    return sanitized or "unnamed_document"


def _detect_mime_from_bytes(header: bytes) -> str | None:
    """Detect MIME type from initial header bytes."""
    for sig, mime_type in _FILE_SIGNATURES:
        if header.startswith(sig):
            return mime_type
    return None


def _detect_mime_from_path(file_path: str) -> str | None:
    """Detect MIME type from file content using python-magic or manual header signatures."""
    if _magic_available and _magic is not None:
        try:
            return _magic.from_file(file_path, mime=True)
        except Exception as e:
            logger.warning(f"python-magic detection failed: {e}. Falling back to header signatures.")

    try:
        with open(file_path, "rb") as f:
            header = f.read(16)
        return _detect_mime_from_bytes(header)
    except Exception as err:
        logger.warning(f"Manual header signature detection failed: {err}")

    return None


def _validate_mime_type(file_path: str, extension: str) -> None:
    """
    Validate that the actual file content matches the claimed extension.
    Raises HTTPException if a mismatch is detected.
    """
    if extension == ".txt":
        return

    detected_mime = _detect_mime_from_path(file_path)
    if detected_mime is None:
        logger.warning(f"Could not detect MIME type for {file_path}. Allowing upload based on extension alone.")
        return

    allowed_exts = _MIME_TO_EXTENSIONS.get(detected_mime)
    if allowed_exts is not None and extension not in allowed_exts:
        try:
            os.remove(file_path)
        except OSError:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"MIME type mismatch: file content detected as '{detected_mime}' "
                f"but extension is '{extension}'. Upload rejected."
            ),
        )


class ObjectStorage(abc.ABC):
    @abc.abstractmethod
    def save(self, file: UploadFile) -> dict[str, Any]:
        """Save file and return stored metadata dict."""
        pass

    @abc.abstractmethod
    def get_bytes(self, file_path_or_key: str) -> bytes:
        """Retrieve stored file bytes."""
        pass

    @abc.abstractmethod
    def delete(self, file_path_or_key: str) -> None:
        """Delete stored file."""
        pass


class LocalObjectStorage(ObjectStorage):
    """Local filesystem storage adapter."""

    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def save(self, file: UploadFile) -> dict[str, Any]:
        raw_name = file.filename or ""
        clean_name = sanitize_filename(raw_name)
        _, ext = os.path.splitext(clean_name)
        ext = ext.lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{ext}' is not supported. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        unique_filename = f"{uuid.uuid4()}{ext}"
        dest_path = os.path.join(self.upload_dir, unique_filename)

        sha256 = hashlib.sha256()
        size = 0

        try:
            with open(dest_path, "wb") as buffer:
                while chunk := file.file.read(8192):
                    size += len(chunk)
                    if size > MAX_FILE_SIZE:
                        buffer.close()
                        os.remove(dest_path)
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE / (1024 * 1024)} MB."
                        )
                    sha256.update(chunk)
                    buffer.write(chunk)
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save file: {str(e)}"
            ) from e

        if size == 0:
            if os.path.exists(dest_path):
                os.remove(dest_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes)."
            )

        _validate_mime_type(dest_path, ext)
        content_hash = sha256.hexdigest()

        return {
            "filename": clean_name,
            "saved_filename": unique_filename,
            "file_path": dest_path,
            "file_type": ext.replace(".", "").upper(),
            "mime_type": _detect_mime_from_path(dest_path) or f"application/{ext.replace('.', '')}",
            "size_bytes": size,
            "content_hash": content_hash,
            "storage_backend": "local",
        }

    def get_bytes(self, file_path_or_key: str) -> bytes:
        if not os.path.exists(file_path_or_key):
            raise FileNotFoundError(f"File not found: {file_path_or_key}")
        with open(file_path_or_key, "rb") as f:
            return f.read()

    def delete(self, file_path_or_key: str) -> None:
        if file_path_or_key and os.path.exists(file_path_or_key):
            try:
                os.remove(file_path_or_key)
            except Exception as err:
                logger.warning(f"Failed to delete file {file_path_or_key}: {err}")


class MinioObjectStorage(ObjectStorage):
    """MinIO / S3 compatible object storage adapter."""

    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket_name: str, secure: bool = False):
        self.endpoint = endpoint
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket_name = bucket_name
        self.secure = secure
        self._local_fallback = LocalObjectStorage(settings.UPLOAD_DIR)

    def _get_client(self):
        try:
            from minio import Minio
            client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure,
            )
            if not client.bucket_exists(self.bucket_name):
                client.make_bucket(self.bucket_name)
            return client
        except Exception as e:
            logger.warning(f"MinIO client unavailable ({e}). Falling back to local storage.")
            return None

    def save(self, file: UploadFile) -> dict[str, Any]:
        client = self._get_client()
        if client is None:
            return self._local_fallback.save(file)

        raw_name = file.filename or ""
        clean_name = sanitize_filename(raw_name)
        _, ext = os.path.splitext(clean_name)
        ext = ext.lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{ext}' is not supported."
            )

        content = file.file.read()
        size = len(content)
        if size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum limit of {MAX_FILE_SIZE / (1024 * 1024)} MB."
            )
        if size == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

        content_hash = hashlib.sha256(content).hexdigest()
        object_name = f"{uuid.uuid4()}{ext}"

        import io
        client.put_object(
            self.bucket_name,
            object_name,
            io.BytesIO(content),
            length=size,
            content_type=_detect_mime_from_bytes(content[:16]) or "application/octet-stream",
        )

        return {
            "filename": clean_name,
            "saved_filename": object_name,
            "file_path": f"minio://{self.bucket_name}/{object_name}",
            "file_type": ext.replace(".", "").upper(),
            "mime_type": _detect_mime_from_bytes(content[:16]) or "application/octet-stream",
            "size_bytes": size,
            "content_hash": content_hash,
            "storage_backend": "minio",
        }

    def get_bytes(self, file_path_or_key: str) -> bytes:
        client = self._get_client()
        if client is None or not file_path_or_key.startswith("minio://"):
            return self._local_fallback.get_bytes(file_path_or_key)

        object_name = file_path_or_key.replace(f"minio://{self.bucket_name}/", "")
        response = client.get_object(self.bucket_name, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete(self, file_path_or_key: str) -> None:
        client = self._get_client()
        if client is None or not file_path_or_key.startswith("minio://"):
            self._local_fallback.delete(file_path_or_key)
            return

        object_name = file_path_or_key.replace(f"minio://{self.bucket_name}/", "")
        try:
            client.remove_object(self.bucket_name, object_name)
        except Exception as err:
            logger.warning(f"Failed to delete object from MinIO: {err}")


def get_storage() -> ObjectStorage:
    backend = getattr(settings, "STORAGE_BACKEND", "local").lower()
    if backend == "minio":
        return MinioObjectStorage(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            bucket_name=settings.MINIO_BUCKET,
            secure=settings.MINIO_SECURE,
        )
    return LocalObjectStorage(settings.STORAGE_LOCAL_DIR or settings.UPLOAD_DIR)


def save_uploaded_file(file: UploadFile) -> dict[str, Any]:
    return get_storage().save(file)


def delete_stored_file(file_path: str) -> None:
    get_storage().delete(file_path)
