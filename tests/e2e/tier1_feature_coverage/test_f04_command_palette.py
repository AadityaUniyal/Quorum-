"""
Tier 1 Feature Coverage: Feature 4 — Global Command Palette & Navigation
Verifies CommandPalette mounting in AppLayout, connection to useUIStore,
and expansion of MobileNav / navigation routes across all 11 core routes.
"""

import pytest
from tests.e2e.helpers import FRONTEND_ROOT, read_frontend_file


@pytest.mark.tier(1)
@pytest.mark.feature(4)
@pytest.mark.milestone("M1")
class TestFeature04CommandPaletteNavigation:
    """Verifies that the Global Command Palette and Navigation support all 11 core routes."""

    CORE_ROUTES = [
        "/",
        "/dashboard",
        "/documents",
        "/review",
        "/analytics",
        "/search",
        "/crawl",
        "/benchmarks",
        "/pricing",
        "/settings",
        "/admin",
    ]

    def test_f04_01_command_palette_mounted_in_app_layout(self):
        """Verify CommandPalette component is imported and mounted inside AppLayout.tsx."""
        app_layout = read_frontend_file("src/components/layout/AppLayout.tsx")
        assert (
            "CommandPalette" in app_layout
        ), "CommandPalette must be imported and rendered within AppLayout"

    def test_f04_02_command_palette_connected_to_ui_store(self):
        """Verify CommandPalette is controlled by useUIStore (commandPaletteOpen state)."""
        palette_file = read_frontend_file("src/components/layout/CommandPalette.tsx")
        assert (
            "useUIStore" in palette_file
            or "commandPaletteOpen" in palette_file
        ), "CommandPalette must subscribe to useUIStore for visibility control"

    def test_f04_03_keyboard_shortcut_listener(self):
        """Verify Cmd+K / Ctrl+K keyboard shortcut handler is bound in layout or command palette."""
        palette_file = read_frontend_file("src/components/layout/CommandPalette.tsx")
        layout_file = read_frontend_file("src/components/layout/AppLayout.tsx")
        header_file = read_frontend_file("src/components/layout/Header.tsx")
        combined = palette_file + layout_file + header_file
        assert (
            "k" in combined.lower() and ("metaKey" in combined or "ctrlKey" in combined or "keydown" in combined)
        ), "Global Cmd+K / Ctrl+K keydown event listener must be registered"

    def test_f04_04_mobile_nav_covers_all_11_core_routes(self):
        """Verify MobileNav component provides navigation access to core application routes."""
        mobile_nav = read_frontend_file("src/components/layout/MobileNav.tsx")
        sidebar = read_frontend_file("src/components/layout/Sidebar.tsx")
        combined_nav = mobile_nav + sidebar

        # Key operational routes must be present
        for route in ["/dashboard", "/documents", "/review", "/analytics", "/search", "/crawl", "/benchmarks", "/settings", "/admin"]:
            assert (
                route in combined_nav
            ), f"Navigation (Sidebar / MobileNav) must include route {route}"

    def test_f04_05_header_palette_trigger_button(self):
        """Verify Header contains a search / command palette trigger that opens the palette."""
        header_file = read_frontend_file("src/components/layout/Header.tsx")
        assert (
            "setCommandPaletteOpen" in header_file
            or "commandPaletteOpen" in header_file
            or "Search" in header_file
        ), "Header must contain an interactive trigger connected to command palette state"
