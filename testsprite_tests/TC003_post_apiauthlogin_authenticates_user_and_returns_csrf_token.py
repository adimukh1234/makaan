import requests
import sys

BASE_URL = "http://localhost:5173"
TIMEOUT = 30


def test_post_apiauthlogin_authenticates_user_and_returns_csrf_token_TC003():
    """
    TC003: Test POST /api/auth/login with valid email and password returns 200
    with user object and csrfToken.
    """
    session = requests.Session()
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": "tenant@makaan.test",
        "password": "makaan-demo-2026"
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    try:
        resp = session.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Request to {url} failed: {e}")

    # Validate status code
    assert resp.status_code == 200, f"Expected status code 200, got {resp.status_code}. Response: {resp.text}"

    # Validate JSON body
    try:
        data = resp.json()
    except ValueError:
        raise AssertionError("Response is not valid JSON")

    assert isinstance(data, dict), f"Expected JSON object in response, got {type(data)}"

    # Check presence and types of user and csrfToken
    assert "user" in data and isinstance(data["user"], dict), "Response JSON missing 'user' object"
    assert "csrfToken" in data and isinstance(data["csrfToken"], str) and data["csrfToken"].strip() != "", "Response JSON missing or invalid 'csrfToken'"

    # Optionally ensure session cookie was set (server may set a session cookie)
    # This is not strictly required by the PRD but is a useful check.
    # If there are no cookies, we don't fail the test; just ensure response contains expected fields.
    cookies = session.cookies.get_dict()
    # No assertion here; just make it available in debug output if needed.

    print("TC003 passed: /api/auth/login returned 200 with user object and csrfToken.")
    return {
        "status_code": resp.status_code,
        "response_json": data,
        "cookies": cookies
    }


if __name__ == "__main__":
    try:
        result = test_post_apiauthlogin_authenticates_user_and_returns_csrf_token_TC003()
        # Optionally pretty-print result summary
        print("Result summary:", {"status_code": result["status_code"], "has_user": "user" in result["response_json"], "has_csrfToken": "csrfToken" in result["response_json"], "cookies": result["cookies"]})
    except AssertionError as e:
        print(f"Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error during test execution: {e}")
        sys.exit(2)
    sys.exit(0)