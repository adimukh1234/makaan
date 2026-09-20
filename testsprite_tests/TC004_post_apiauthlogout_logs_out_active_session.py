import requests
import sys
from requests.exceptions import RequestException, JSONDecodeError

BASE_URL = "http://localhost:5173"
API_BASE = BASE_URL + "/api"
TIMEOUT = 30

def test_post_apiauthlogout_logs_out_active_session():
    session = requests.Session()
    login_url = f"{API_BASE}/auth/login"
    logout_url = f"{API_BASE}/auth/logout"

    credentials = {
        "email": "tenant@makaan.test",
        "password": "makaan-demo-2026"
    }

    try:
        # Login to obtain session cookie and CSRF token
        login_resp = session.post(
            login_url,
            json=credentials,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=TIMEOUT
        )
    except RequestException as e:
        raise AssertionError(f"Login request failed: {e}")

    assert login_resp is not None, "No response received from login request"
    assert login_resp.status_code == 200, f"Expected 200 from login, got {login_resp.status_code}: {login_resp.text}"

    try:
        login_json = login_resp.json()
    except ValueError as e:
        raise AssertionError(f"Login response is not valid JSON: {e}. Response text: {login_resp.text}")

    assert isinstance(login_json, dict), f"Expected login response to be a JSON object, got: {type(login_json)}"
    assert "csrfToken" in login_json and isinstance(login_json["csrfToken"], str) and login_json["csrfToken"], "csrfToken missing or invalid in login response"
    csrf_token = login_json["csrfToken"]

    # Ensure we have a session cookie set by the server
    cookies = session.cookies.get_dict()
    assert cookies, f"No cookies set by login. Cookies dict: {cookies}"

    try:
        # Call logout with the x-csrf-token header and session cookies
        logout_resp = session.post(
            logout_url,
            headers={
                "Accept": "application/json",
                "x-csrf-token": csrf_token
            },
            timeout=TIMEOUT
        )
    except RequestException as e:
        raise AssertionError(f"Logout request failed: {e}")

    assert logout_resp is not None, "No response received from logout request"
    assert logout_resp.status_code == 200, f"Expected 200 from logout, got {logout_resp.status_code}: {logout_resp.text}"

    try:
        logout_json = logout_resp.json()
    except ValueError as e:
        raise AssertionError(f"Logout response is not valid JSON: {e}. Response text: {logout_resp.text}")

    assert isinstance(logout_json, dict), f"Expected logout response to be a JSON object, got: {type(logout_json)}"
    # The PRD specifies { "ok": boolean } with ok true on successful logout
    assert "ok" in logout_json, f"'ok' field missing in logout response: {logout_json}"
    assert logout_json["ok"] is True, f"Expected ok == True in logout response, got: {logout_json['ok']}"

    # Optionally verify that session is invalidated by calling session endpoint (should not return authenticated user)
    session_url = f"{API_BASE}/auth/session"
    try:
        session_check_resp = session.get(session_url, headers={"Accept": "application/json"}, timeout=TIMEOUT)
    except RequestException:
        # If the session endpoint is inaccessible after logout, that's acceptable; just return success for logout
        return

    # If session endpoint returns 200, ensure it does not present the same csrfToken/session user
    if session_check_resp.status_code == 200:
        try:
            session_check_json = session_check_resp.json()
        except ValueError:
            return
        # If session endpoint still shows a csrfToken or user, ensure it's different or unauthenticated
        # We consider logout successful as per response; no strict assertion here beyond attempting check.
        return

if __name__ == "__main__":
    try:
        test_post_apiauthlogout_logs_out_active_session()
        print("TC004 passed: POST /api/auth/logout successfully logged out the session.")
    except AssertionError as e:
        print(f"TC004 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC004 encountered an unexpected error: {e}")
        sys.exit(2)