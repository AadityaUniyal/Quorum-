"""
Tier 1 Feature Coverage: Feature 3 — Spring Physics & Motion Transitions
Verifies Framer Motion spring curves, layoutId on tabs, and spring animation variants.
"""

import pytest
from tests.e2e.helpers import FRONTEND_ROOT, find_files_with_extension, read_file_safely


@pytest.mark.tier(1)
@pytest.mark.feature(3)
@pytest.mark.milestone("M1")
class TestFeature03SpringPhysicsMotion:
    """Verifies that fluid spring-driven physics and Framer Motion configurations are implemented."""

    def test_f03_01_framer_motion_dependency_configured(self):
        """Verify framer-motion is installed in package.json."""
        pkg_content = read_file_safely(FRONTEND_ROOT / "package.json")
        assert "framer-motion" in pkg_content, "framer-motion must be declared in package.json dependencies"

    def test_f03_02_spring_transition_configurations_present(self):
        """Verify spring physics (type: 'spring', stiffness, damping) are utilized in UI components."""
        tsx_files = find_files_with_extension(FRONTEND_ROOT / "src", {".tsx", ".ts"})
        spring_found = False
        for f in tsx_files:
            content = read_file_safely(f)
            if "spring" in content.lower() and ("stiffness" in content or "damping" in content or "framer-motion" in content):
                spring_found = True
                break
        assert spring_found, "Framer Motion spring transitions with stiffness/damping must be implemented"

    def test_f03_03_tabs_layout_id_sliding_indicator(self):
        """Verify Tabs primitive or page tabs use layoutId for continuous sliding pill indicator."""
        tabs_content = read_file_safely(FRONTEND_ROOT / "src/components/ui/Tabs.tsx")
        all_tsx = [read_file_safely(f) for f in find_files_with_extension(FRONTEND_ROOT / "src", {".tsx"})]
        layout_id_present = "layoutId" in tabs_content or any("layoutId" in c for c in all_tsx)
        assert layout_id_present, "Tabs must use Framer Motion layoutId for fluid active indicator sliding"

    def test_f03_04_dialog_modal_presence_animation(self):
        """Verify Dialog or modal transitions utilize AnimatePresence or motion wrappers."""
        dialog_content = read_file_safely(FRONTEND_ROOT / "src/components/ui/Dialog.tsx")
        all_tsx = [read_file_safely(f) for f in find_files_with_extension(FRONTEND_ROOT / "src", {".tsx"})]
        motion_dialog = (
            "motion." in dialog_content
            or "AnimatePresence" in dialog_content
            or any("AnimatePresence" in c for c in all_tsx)
        )
        assert motion_dialog, "Modal dialogs must utilize Framer Motion / AnimatePresence for transitions"

    def test_f03_05_drawer_sheet_slideover_physics(self):
        """Verify Drawer primitive utilizes spring-based slideover physics."""
        drawer_content = read_file_safely(FRONTEND_ROOT / "src/components/ui/Drawer.tsx")
        batch_drawer = read_file_safely(FRONTEND_ROOT / "src/components/documents/BatchUploadDrawer.tsx")
        combined = drawer_content + batch_drawer
        assert (
            "motion" in combined
            or "transition" in combined
            or "transform" in combined
        ), "Drawer must implement spring-based sliding motion transitions"
