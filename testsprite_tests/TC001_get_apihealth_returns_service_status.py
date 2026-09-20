import requests
from datetime import datetime
import sys

BASE = "http://localhost:5173"
TIMEOUT = 30

def test_get_apihealth_returns_service_status():
    url = f"{BASE}/api/health"
    headers = {"Accept": "application/json"}

    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Validate HTTP status
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}, body: {resp.text}"

    # Validate JSON body
    try:
        data = resp.json()
    except ValueError:
        raise AssertionError(f"Response is not valid JSON: {resp.text}")

    expected_keys = ["ok", "service", "ai", "evidence", "time"]
    for k in expected_keys:
        assert k in data, f"Missing key '{k}' in response JSON: {data}"

    # Types and basic value checks
    assert isinstance(data["ok"], bool), f"'ok' should be boolean, got {type(data['ok'])}"
    for key in ["service", "ai", "evidence", "time"]:
        val = data[key]
        assert isinstance(val, str), f"'{key}' should be a string, got {type(val)}"
        assert val.strip() != "", f"'{key}' should not be empty"

    # Try to validate time format (best-effort ISO format)
    time_val = data["time"]
    try:
        # accept a trailing Z by converting to +00:00 for fromisoformat
        if time_val.endswith("Z"):
            dt = datetime.fromisoformat(time_val.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(time_val)
        assert isinstance(dt, datetime)
    except Exception:
        # If parsing fails, still ensure it's a non-empty string (already checked)
        raise AssertionError(f"'time' value is not a valid ISO datetime: {time_val}")

if __name__ == "__main__":
    try:
        test_get_apihealth_returns_service_status()
    except AssertionError as e:
        print("TEST FAILED:", e)
        sys.exit(1)
    except Exception as e:
        print("UNEXPECTED ERROR:", e)
        sys.exit(2)
    else:
        print("TEST PASSED")
        sys.exit(0)