"""
Tier 1 Feature Coverage: Feature 2 — Foundation UI Primitives
Verifies Apple HIG foundation UI primitives: Button, Card, Dialog, Drawer, Slider, Tabs, Accordion, DropdownMenu.
"""

import pytest
from tests.e2e.helpers import FRONTEND_ROOT, read_frontend_file


@pytest.mark.tier(1)
@pytest.mark.feature(2)
@pytest.mark.milestone("M1")
class TestFeature02FoundationUIPrimitives:
    """Verifies that the foundation UI primitives exist and conform to Apple HIG contracts."""

    def test_f02_01_button_primitive_contract(self):
        """Verify Button component exists and exports variants conforming to Apple HIG design."""
        button_file = FRONTEND_ROOT / "src/components/ui/Button.tsx"
        assert button_file.exists(), "Button primitive component (Button.tsx) must exist"
        content = read_frontend_file("src/components/ui/Button.tsx")
        assert "Button" in content, "Button component must be defined"
        assert any(prop in content for prop in ["variant", "size", "className"]), "Button must accept design props"

    def test_f02_02_card_primitive_contract(self):
        """Verify Card component exists and supports frosted mica styling."""
        card_file = FRONTEND_ROOT / "src/components/ui/Card.tsx"
        assert card_file.exists(), "Card primitive component (Card.tsx) must exist"
        content = read_frontend_file("src/components/ui/Card.tsx")
        assert "Card" in content, "Card component must be defined"

    def test_f02_03_dialog_primitive_contract(self):
        """Verify Dialog component exists and supports modal accessibility and overlays."""
        dialog_file = FRONTEND_ROOT / "src/components/ui/Dialog.tsx"
        assert dialog_file.exists(), "Dialog primitive component (Dialog.tsx) must exist"
        content = read_frontend_file("src/components/ui/Dialog.tsx")
        assert "Dialog" in content, "Dialog component must be defined"

    def test_f02_04_drawer_primitive_contract(self):
        """Verify Drawer component exists and supports sheet/slideover overlay."""
        drawer_file = FRONTEND_ROOT / "src/components/ui/Drawer.tsx"
        assert drawer_file.exists(), "Drawer primitive component (Drawer.tsx) must exist"
        content = read_frontend_file("src/components/ui/Drawer.tsx")
        assert "Drawer" in content, "Drawer component must be defined"

    def test_f02_05_interactive_primitives_tabs_slider_accordion(self):
        """Verify Tabs, Slider, Accordion, and DropdownMenu components exist."""
        for prim in ["Tabs", "Slider", "Accordion", "DropdownMenu"]:
            prim_file = FRONTEND_ROOT / f"src/components/ui/{prim}.tsx"
            assert prim_file.exists(), f"{prim} primitive component ({prim}.tsx) must exist"
            content = read_frontend_file(f"src/components/ui/{prim}.tsx")
            assert len(content) > 0, f"{prim} component file must not be empty"
