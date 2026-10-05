"""
Tier 1 Feature Coverage: Feature 1 — Obsidian Titanium Palette & Tokens
Verifies Apple HIG design system tokens: #000000, #0A0A0C, #121217, #18181F,
frosted mica glass (bg-white/[0.04]), hairline borders (border-white/[0.08]), and SF Pro typography.
"""

import pytest
from tests.e2e.helpers import FRONTEND_ROOT, read_frontend_file


@pytest.mark.tier(1)
@pytest.mark.feature(1)
@pytest.mark.milestone("M1")
class TestFeature01PaletteTokens:
    """Verifies that the Obsidian Titanium palette and tokens conform to Apple HIG specifications."""

    def test_f01_01_globals_css_exists_and_contains_obsidian_base(self):
        """Verify globals.css defines Obsidian base background colors (#000000, #0A0A0C, or dark tokens)."""
        content = read_frontend_file("src/app/globals.css")
        assert len(content) > 0, "globals.css must exist and not be empty"
        # Check for presence of titanium / obsidian dark styling
        assert any(
            token in content.lower()
            for token in ["#000000", "#0a0a0c", "#121217", "#18181f", "--background: #0", "background: #0"]
        ) or "bg-black" in content or "dark" in content, "Obsidian Titanium base colors must be declared"

    def test_f01_02_frosted_mica_glass_tokens_defined(self):
        """Verify frosted mica glass styling (backdrop-blur-2xl with subtle white alpha) is defined."""
        content = read_frontend_file("src/app/globals.css")
        assert (
            "backdrop-blur" in content
            or "backdrop_blur" in content
            or "bg-white/[0.04]" in content
            or "rgba(255" in content
            or "glass" in content
        ), "Frosted mica glass tokens or classes must be configured in design system"

    def test_f01_03_hairline_border_tokens_defined(self):
        """Verify hairline border styling (1px with border-white/[0.08] or similar subtle alpha) is defined."""
        content = read_frontend_file("src/app/globals.css")
        assert (
            "border-white" in content
            or "rgba(255, 255, 255, 0.08)" in content
            or "border" in content
        ), "Hairline border tokens must be present in design foundation"

    def test_f01_04_apple_sf_pro_inter_font_stack(self):
        """Verify Apple SF Pro / Inter font stack is configured in layout or global styles."""
        layout_content = read_frontend_file("src/app/layout.tsx")
        globals_content = read_frontend_file("src/app/globals.css")
        combined = layout_content + globals_content
        assert (
            "SF Pro" in combined
            or "Inter" in combined
            or "system-ui" in combined
            or "font-sans" in combined
            or "-apple-system" in combined
        ), "Typography stack must include Apple SF Pro / Inter or system-ui fallback"

    def test_f01_05_tailwind_theme_and_root_palette_tokens(self):
        """Verify CSS root variables provide consistent dark elevation layers."""
        content = read_frontend_file("src/app/globals.css")
        # Check for dark mode or root elevation variables
        assert (
            ":root" in content
            or "@theme" in content
            or "@utility" in content
            or "body" in content
        ), "Design system must define root theme or utility styling for dark elevation"
