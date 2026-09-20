import requests
import sys
from typing import Any

BASE_API = "http://localhost:5173/api"
EMAIL = "tenant@makaan.test"
PASSWORD = "makaan-demo-2026"
TIMEOUT = 30


def _contains_value(obj: Any, target: Any) -> bool:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if _contains_value(v, target):
                return True
    elif isinstance(obj, list):
        for item in obj:
            if _contains_value(item, target):
                return True
    else:
        return obj == target
    return False


def test_get_apimeexport_returns_complete_user_data_export():
    session = requests.Session()
    csrf_token = None
    logged_in = False
    try:
        # Login to obtain session cookie and csrf token
        login_url = f"{BASE_API}/auth/login"
        resp = session.post(
            login_url,
            json={"email": EMAIL, "password": PASSWORD},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Login failed: {resp.status_code} - {resp.text}"
        try:
            login_json = resp.json()
        except ValueError:
            raise AssertionError("Login response is not valid JSON")
        csrf_token = login_json.get("csrfToken")
        assert csrf_token, "Login response did not include csrfToken"
        logged_in = True

        # Request the export endpoint
        export_url = f"{BASE_API}/me/export"
        headers = {
            "Accept": "application/json",
            "x-csrf-token": csrf_token,
        }
        resp_export = session.get(export_url, headers=headers, timeout=TIMEOUT)

        assert resp_export.status_code == 200, f"Export request failed: {resp_export.status_code} - {resp_export.text}"

        ct = resp_export.headers.get("Content-Type", "")
        assert "application/json" in ct.lower() or ct == "", f"Unexpected Content-Type: {ct}"

        try:
            export_json = resp_export.json()
        except ValueError:
            raise AssertionError("Export response is not valid JSON")

        assert isinstance(export_json, dict), f"Export payload is not a JSON object: {type(export_json)}"
        assert len(export_json) > 0, "Export JSON object is empty"

        # Ensure the exported data contains the user's email somewhere
        assert _contains_value(export_json, EMAIL), "Exported data does not contain the user's email"

        print("TC008 passed: /api/me/export returned a non-empty JSON export containing the user's email.")

    finally:
        # Attempt logout to clean up session
        if logged_in and csrf_token:
            try:
                logout_url = f"{BASE_API}/auth/logout"
                session.post(
                    logout_url,
                    headers={"x-csrf-token": csrf_token, "Accept": "application/json"},
                    timeout=TIMEOUT,
                )
            except Exception:
                # Do not mask original test errors; just best-effort cleanup
                pass


if __name__ == "__main__":
    try:
        test_get_apimeexport_returns_complete_user_data_export()
    except AssertionError as e:
        print(f"TC008 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC008 encountered an unexpected error: {e}")
        sys.exit(2)
    sys.exit(0)