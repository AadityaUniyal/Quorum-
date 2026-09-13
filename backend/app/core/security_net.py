"""
Network Security & SSRF Protection Policy

Provides strict URL validation and DNS resolution checks to protect
webhooks, crawlers, and HTTP clients against Server-Side Request Forgery (SSRF).
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Disallowed private, link-local, loopback, and cloud metadata IP ranges
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # Current network (only valid as source)
    ipaddress.ip_network("10.0.0.0/8"),         # RFC 1918 Private IPv4
    ipaddress.ip_network("100.64.0.0/10"),      # Shared Address Space (Carrier-grade NAT)
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-Local (Cloud metadata 169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),      # RFC 1918 Private IPv4
    ipaddress.ip_network("192.0.0.0/24"),       # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),       # TEST-NET-1 (Documentation)
    ipaddress.ip_network("192.168.0.0/16"),     # RFC 1918 Private IPv4
    ipaddress.ip_network("198.18.0.0/15"),      # Network benchmark tests
    ipaddress.ip_network("198.51.100.0/24"),    # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),     # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved / Future use
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
    # IPv6 Networks
    ipaddress.ip_network("::/128"),             # Unspecified
    ipaddress.ip_network("::1/128"),           # Loopback
    ipaddress.ip_network("::ffff:0:0/96"),      # IPv4-mapped IPv6
    ipaddress.ip_network("64:ff9b::/96"),       # IPv4-IPv6 translation
    ipaddress.ip_network("100::/64"),           # Discard prefix
    ipaddress.ip_network("2001::/23"),          # IETF Protocol
    ipaddress.ip_network("2001:db8::/32"),      # Documentation
    ipaddress.ip_network("fc00::/7"),           # Unique Local IPv6 (ULA)
    ipaddress.ip_network("fe80::/10"),          # Link-Local IPv6
    ipaddress.ip_network("ff00::/8"),           # Multicast IPv6
]

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443, 8000, 8080, 8443}


def is_ip_blocked(ip_addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Check if an IP address belongs to any blocked or private network range."""
    # Convert IPv4-mapped IPv6 to standard IPv4 if present
    if isinstance(ip_addr, ipaddress.IPv6Address) and ip_addr.ipv4_mapped:
        ip_addr = ip_addr.ipv4_mapped

    if ip_addr.is_private or ip_addr.is_loopback or ip_addr.is_link_local or ip_addr.is_multicast or ip_addr.is_reserved or ip_addr.is_unspecified:
        return True

    for network in BLOCKED_IP_NETWORKS:
        if ip_addr in network:
            return True

    return False


def resolve_and_validate_host(hostname: str, allow_local_for_testing: bool = False) -> list[str]:
    """
    Resolve a hostname via DNS and ensure all resolved IP addresses are public and safe.
    Raises ValueError if hostname resolves to private, loopback, or cloud-metadata IPs.
    """
    clean_host = hostname.strip().lower()
    if not clean_host:
        raise ValueError("Host cannot be empty.")

    # Check for direct IP literal
    try:
        ip_obj = ipaddress.ip_address(clean_host)
        if not allow_local_for_testing and is_ip_blocked(ip_obj):
            raise ValueError(f"Target IP address '{clean_host}' is blocked for SSRF security.")
        return [str(ip_obj)]
    except ValueError as err:
        if "is blocked" in str(err):
            raise
        # Not an IP literal, proceed to DNS resolution

    try:
        addr_infos = socket.getaddrinfo(clean_host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise ValueError(f"Unable to resolve host '{clean_host}': {e}") from e

    resolved_ips = []
    for _family, _, _, _, sockaddr in addr_infos:
        ip_str = sockaddr[0]
        ip_obj = ipaddress.ip_address(ip_str)
        if not allow_local_for_testing and is_ip_blocked(ip_obj):
            raise ValueError(f"Host '{clean_host}' resolves to blocked IP '{ip_str}' (SSRF prevention).")
        resolved_ips.append(ip_str)

    if not resolved_ips:
        raise ValueError(f"Host '{clean_host}' resolved to no valid IP addresses.")

    return list(set(resolved_ips))


def validate_safe_url(url: str, allow_local_for_testing: bool = False) -> str:
    """
    Validates a URL against SSRF attack vectors:
    - Must be http or https
    - Host must not be empty or localhost
    - Host must resolve to public IP addresses only
    - Port must be standard web port if specified
    """
    if not url or not isinstance(url, str):
        raise ValueError("URL must be a non-empty string.")

    cleaned_url = url.strip()
    parsed = urlparse(cleaned_url)

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}'. Only http and https are allowed.")

    if not parsed.netloc:
        raise ValueError("URL missing hostname/network location.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL does not contain a valid hostname.")

    # Check blocked hostnames directly
    lowered_host = hostname.lower()
    if not allow_local_for_testing:
        if lowered_host in ("localhost", "localhost.localdomain", "127.0.0.1", "::1", "metadata.google.internal", "instance-data"):
            raise ValueError(f"Access to '{hostname}' is blocked.")

    # Validate port if explicitly present
    if parsed.port and parsed.port not in ALLOWED_PORTS and not allow_local_for_testing:
        raise ValueError(f"Port '{parsed.port}' is not allowed for webhooks/crawlers.")

    # Perform DNS check
    resolve_and_validate_host(hostname, allow_local_for_testing=allow_local_for_testing)

    return cleaned_url
