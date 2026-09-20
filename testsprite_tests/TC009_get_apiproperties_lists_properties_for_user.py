import requests
import sys

BASE_API = "http://localhost:5173/api"
LOGIN_EMAIL = "tenant@makaan.test"
LOGIN_PASSWORD = "makaan-demo-2026"
TIMEOUT = 30


def test_get_properties_for_user_TC009():
    session = requests.Session()
    csrf_token = None
    logged_in = False

    try:
        # Login to obtain session cookie and csrf token
        login_url = f"{BASE_API}/auth/login"
        login_payload = {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}
        headers = {"Content-Type": "application/json"}
        resp = session.post(login_url, json=login_payload, headers=headers, timeout=TIMEOUT)
        try:
            resp.raise_for_status()
        except requests.RequestException as e:
            raise AssertionError(f"Login request failed: {e}; status_code={resp.status_code}, body={resp.text}")

        login_json = resp.json()
        assert resp.status_code == 200, f"Expected 200 from login, got {resp.status_code}"
        assert isinstance(login_json, dict), "Login response is not a JSON object"
        assert "csrfToken" in login_json, "Login response missing csrfToken"
        assert "user" in login_json, "Login response missing user object"
        csrf_token = login_json["csrfToken"]
        logged_in = True

        # GET /api/properties using authenticated session
        properties_url = f"{BASE_API}/properties"
        get_headers = {"Accept": "application/json"}
        # include CSRF token header even though GETs typically don't require it
        if csrf_token:
            get_headers["x-csrf-token"] = csrf_token

        resp_props = session.get(properties_url, headers=get_headers, timeout=TIMEOUT)
        try:
            resp_props.raise_for_status()
        except requests.RequestException as e:
            raise AssertionError(f"GET /api/properties request failed: {e}; status_code={resp_props.status_code}, body={resp_props.text}")

        props_json = resp_props.json()
        assert resp_props.status_code == 200, f"Expected 200 from GET /api/properties, got {resp_props.status_code}"
        assert isinstance(props_json, dict), "Properties response is not a JSON object"
        assert "properties" in props_json, "Response JSON missing 'properties' key"
        assert isinstance(props_json["properties"], list), f"'properties' is not a list (type={type(props_json['properties'])})"

        # If further checks desired: ensure each property has an id/title (best-effort, not required by PRD)
        for idx, p in enumerate(props_json["properties"]):
            assert isinstance(p, dict), f"Property at index {idx} is not an object"
        print("TC009 passed: GET /api/properties returned 200 and properties array present.")

    finally:
        # Attempt to logout to clean up session
        if logged_in and csrf_token:
            try:
                logout_url = f"{BASE_API}/auth/logout"
                logout_headers = {"Content-Type": "application/json", "x-csrf-token": csrf_token}
                resp_logout = session.post(logout_url, headers=logout_headers, timeout=TIMEOUT)
                # best-effort: don't fail the test if logout fails, but log if unexpected
                if resp_logout.status_code != 200:
                    print(f"Warning: logout returned status {resp_logout.status_code}: {resp_logout.text}", file=sys.stderr)
            except requests.RequestException as e:
                print(f"Warning: logout request failed: {e}", file=sys.stderr)


if __name__ == "__main__":
    test_get_properties_for_user_TC009()