import re
import uuid

from app.config import settings
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import CHAR, TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified UUID.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
            return value


class Base(DeclarativeBase):
    """SQLAlchemy 2.x declarative base class for all ORM models."""
    pass



def _resolve_db_url(url: str) -> tuple[str, dict]:
    """
    Sanitizes database URL and ensures resilient DNS resolution for cloud Postgres (e.g., Neon).
    If local ISP DNS fails to resolve a cloud hostname, resolves via public DNS (8.8.8.8)
    and passes Neon's required endpoint SNI parameter via options.
    """
    import socket
    import struct
    from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

    connect_args = {"connect_timeout": 15}

    # Strip channel_binding (unsupported by psycopg2)
    clean_url = re.sub(r'[&?]channel_binding=[^&]*', '', url).replace('&&', '&').rstrip('&').rstrip('?')

    if clean_url.startswith("sqlite"):
        return clean_url, {"check_same_thread": False}

    parsed = urlparse(clean_url)
    host = parsed.hostname
    if host and host not in ("localhost", "127.0.0.1", ""):
        needs_fallback = False
        try:
            socket.gethostbyname(host)
        except Exception:
            needs_fallback = True

        if needs_fallback:
            # Query public DNS (8.8.8.8) directly via UDP to bypass local ISP DNS failure
            resolved_ip = None
            try:
                qid = 4242
                header = struct.pack('>HHHHHH', qid, 0x0100, 1, 0, 0, 0)
                qname = b''.join(bytes([len(p)]) + p.encode() for p in host.split('.')) + b'\x00'
                query = header + qname + struct.pack('>HH', 1, 1)
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.settimeout(3.0)
                sock.sendto(query, ("8.8.8.8", 53))
                data, _ = sock.recvfrom(1024)
                ancount = struct.unpack('>H', data[6:8])[0]
                idx = 12
                while data[idx] != 0:
                    idx += data[idx] + 1
                idx += 5
                for _ in range(ancount):
                    if idx >= len(data):
                        break
                    if data[idx] & 0xC0 == 0xC0:
                        idx += 2
                    else:
                        while data[idx] != 0:
                            idx += data[idx] + 1
                        idx += 1
                    atype, aclass, ttl, rdlen = struct.unpack('>HHIH', data[idx:idx+10])
                    idx += 10
                    if atype == 1 and rdlen == 4:
                        resolved_ip = socket.inet_ntoa(data[idx:idx+4])
                        break
                    idx += rdlen
            except Exception:
                pass

            if resolved_ip:
                query_params = dict(parse_qsl(parsed.query))
                query_params.pop('channel_binding', None)
                if 'neon.tech' in host:
                    endpoint_id = host.split('.')[0]
                    query_params['options'] = f'endpoint={endpoint_id}'

                auth = ""
                if parsed.username:
                    auth += parsed.username
                    if parsed.password:
                        auth += f":{parsed.password}"
                    auth += "@"

                port_str = f":{parsed.port}" if parsed.port else ""
                netloc = f"{auth}{resolved_ip}{port_str}"
                clean_url = urlunparse((
                    parsed.scheme,
                    netloc,
                    parsed.path,
                    parsed.params,
                    urlencode(query_params),
                    parsed.fragment
                ))

    # SSL Mode handling
    if "sslmode" in clean_url.lower():
        m = re.search(r"sslmode=([^&]+)", clean_url, re.I)
        if m:
            connect_args["sslmode"] = m.group(1)
    else:
        connect_args["sslmode"] = "require"

    return clean_url, connect_args


# Engine with connection pool tuning for production workloads
_db_url, _connect_args = _resolve_db_url(settings.DATABASE_URL)

if _db_url.startswith("sqlite"):
    engine = create_engine(_db_url, connect_args=_connect_args)
else:
    engine = create_engine(
        _db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=5,
        pool_timeout=30,
        pool_recycle=300,  # 5 minutes recycle for serverless Postgres
        connect_args=_connect_args,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
