"""App package for Wind Forecast Insights."""
import sys

# Ensure 'backend.app' alias exists for backwards compatibility
if "backend.app" not in sys.modules:
    import app
    sys.modules["backend.app"] = app
