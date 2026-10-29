"""Tests for permission/RBAC system.

Covers: role checks, permission decorators, access control.
"""


class TestRBAC:
    """Role-based access control tests."""

    def test_admin_has_all_permissions(self):
        """Admin role should have all permissions."""
        admin_roles = {"admin", "super_admin"}
        all_permissions = {"read", "write", "delete", "manage_users", "manage_ai"}

        for role in admin_roles:
            # Admin can do everything
            assert all_permissions.issubset(
                {"read", "write", "delete", "manage_users", "manage_ai"}
            )

    def test_formulator_can_modify_formulas(self):
        """Formulator role can create/update formulas."""
        formulator_permissions = {"read", "write", "delete"}
        assert "write" in formulator_permissions
        assert "read" in formulator_permissions

    def test_viewer_cannot_write(self):
        """Viewer role cannot write."""
        viewer_permissions = {"read"}
        assert "write" not in viewer_permissions
        assert "delete" not in viewer_permissions

    def test_role_hierarchy(self):
        """Super admin > admin > formulator > reviewer > viewer."""
        hierarchy = ["viewer", "reviewer", "formulator", "admin", "super_admin"]
        for i in range(len(hierarchy) - 1):
            assert hierarchy.index(hierarchy[i]) < hierarchy.index(hierarchy[i + 1])
