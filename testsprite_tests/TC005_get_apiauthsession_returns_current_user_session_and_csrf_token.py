import requests
import sys

BASE_API = "http://localhost:5173/api"
LOGIN_PATH = "/auth/login"
SESSION_PATH = "/auth/session"
LOGOUT_PATH = "/auth/logout"
TIMEOUT = 30.0

def test_get_auth_session():
    session = requests.Session()
    csrf_token = None
    credentials = {
        "email": "tenant@makaan.test",
        "password": "makaan-demo-2026"
    }

    try:
        # Login to create an authenticated session and obtain csrfToken
        login_url = BASE_API + LOGIN_PATH
        resp = session.post(login_url, json=credentials, timeout=TIMEOUT)
        assert resp is not None, "No response from login request"
        assert resp.status_code == 200, f"Expected 200 from login, got {resp.status_code}: {resp.text}"
        try:
            login_json = resp.json()
        except ValueError:
            raise AssertionError(f"Login response is not valid JSON: {resp.text}")

        assert isinstance(login_json, dict), "Login response JSON is not an object"
        assert "user" in login_json and isinstance(login_json["user"], dict), "Login response missing 'user' object"
        assert "csrfToken" in login_json and isinstance(login_json["csrfToken"], str) and login_json["csrfToken"], "Login response missing 'csrfToken'"

        csrf_token = login_json["csrfToken"]

        # GET current session
        session_url = BASE_API + SESSION_PATH
        headers = {"x-csrf-token": csrf_token}
        resp2 = session.get(session_url, headers=headers, timeout=TIMEOUT)
        assert resp2 is not None, "No response from session request"
        assert resp2.status_code == 200, f"Expected 200 from session, got {resp2.status_code}: {resp2.text}"
        try:
            session_json = resp2.json()
        except ValueError:
            raise AssertionError(f"Session response is not valid JSON: {resp2.text}")

        assert isinstance(session_json, dict), "Session response JSON is not an object"
        assert "user" in session_json and isinstance(session_json["user"], dict), "Session response missing 'user' object"
        assert "csrfToken" in session_json and isinstance(session_json["csrfToken"], str) and session_json["csrfToken"], "Session response missing 'csrfToken'"

        # Validate that the returned user matches the logged in credentials
        returned_email = session_json["user"].get("email") or login_json["user"].get("email")
        assert returned_email == credentials["email"], f"Session user email mismatch: expected {credentials['email']}, got {returned_email}"

        print("TC005 passed: GET /api/auth/session returned current user and csrfToken as expected.")
    except AssertionError as ae:
        print(f"Assertion failed: {ae}", file=sys.stderr)
        raise
    except requests.RequestException as re:
        print(f"Request error: {re}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        raise
    finally:
        # Attempt to logout to clean up the session if possible
        try:
            if csrf_token:
                logout_url = BASE_API + LOGOUT_PATH
                session.post(logout_url, headers={"x-csrf-token": csrf_token}, timeout=TIMEOUT)
        except Exception:
            pass
        session.close()

if __name__ == "__main__":
    test_get_auth_session()