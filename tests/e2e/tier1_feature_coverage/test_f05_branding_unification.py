"""
Tier 1 Feature Coverage: Feature 5 — Quorum OS Branding Unification
Verifies eradication of legacy "DocIntel" branding across user-facing copy, tooltips, dialogs, and charts.
"""

import pytest
from tests.e2e.helpers import FRONTEND_ROOT, read_frontend_file


@pytest.mark.tier(1)
@pytest.mark.feature(5)
@pytest.mark.milestone("M1")
class TestFeature05BrandingUnification:
    """Verifies that Quorum OS branding is unified and legacy 'DocIntel' strings are eradicated."""

    def test_f05_01_root_layout_metadata_branding(self):
        """Verify root layout.tsx metadata titles and descriptions reflect Quorum OS."""
        layout_content = read_frontend_file("src/app/layout.tsx")
        assert (
            "Quorum" in layout_content
        ), "Root layout title/metadata must reference Quorum"
        assert (
            "DocIntel AI — Enterprise" not in layout_content
        ), "Legacy 'DocIntel AI — Enterprise' title must be replaced by Quorum OS"

    def test_f05_02_landing_page_keynote_branding(self):
        """Verify landing page displays Quorum branding in hero keynote and storytelling copy."""
        landing_page = read_frontend_file("src/app/page.tsx")
        landing_comp = read_frontend_file("src/components/landing/LandingPage.tsx")
        combined = landing_page + landing_comp
        assert "Quorum" in combined, "Landing page must prominently present Quorum branding"

    def test_f05_03_benchmarks_consensus_label_branding(self):
        """Verify benchmarks page labels the consensus engine as 'Quorum OS' rather than 'DocIntel AI'."""
        benchmarks_page = read_frontend_file("src/app/benchmarks/page.tsx")
        assert (
            "Quorum" in benchmarks_page
        ), "Benchmarks page must reference Quorum OS Consensus"
        assert (
            "DocIntel 6-Agent" not in benchmarks_page
        ), "Legacy 'DocIntel 6-Agent' copy in benchmarks must be unified to Quorum OS"

    def test_f05_04_brand_logo_component_renders_quorum(self):
        """Verify BrandLogo component displays Quorum OS name and emblem."""
        brand_logo = read_frontend_file("src/components/ui/BrandLogo.tsx")
        assert (
            "Quorum" in brand_logo
        ), "BrandLogo component must display Quorum branding"

    def test_f05_05_sidebar_and_header_branding(self):
        """Verify Sidebar and Header components display Quorum OS identity."""
        sidebar = read_frontend_file("src/components/layout/Sidebar.tsx")
        header = read_frontend_file("src/components/layout/Header.tsx")
        combined = sidebar + header
        assert "Quorum" in combined, "Navigation chrome (Sidebar/Header) must display Quorum OS identity"
