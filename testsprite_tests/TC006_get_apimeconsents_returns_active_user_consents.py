import requests
import sys

BASE = "http://localhost:5173/api"
USERNAME = "tenant@makaan.test"
PASSWORD = "makaan-demo-2026"
TIMEOUT = 30


def test_get_me_consents_returns_active_user_consents():
    session = requests.Session()
    csrf_token = None
    try:
        # Login to obtain session cookie and csrfToken
        login_url = f"{BASE}/auth/login"
        login_payload = {"email": USERNAME, "password": PASSWORD}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        try:
            resp = session.post(login_url, json=login_payload, headers=headers, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Login request failed: {e}")

        if resp.status_code != 200:
            raise AssertionError(f"Expected 200 from login, got {resp.status_code}, body: {resp.text}")

        try:
            login_json = resp.json()
        except ValueError:
            raise AssertionError(f"Login response is not valid JSON: {resp.text}")

        csrf_token = login_json.get("csrfToken")
        # If csrf token not returned, try session endpoint to fetch it
        if not csrf_token:
            try:
                sresp = session.get(f"{BASE}/auth/session", headers={"Accept": "application/json"}, timeout=TIMEOUT)
            except requests.RequestException as e:
                raise AssertionError(f"Session request failed while retrieving csrf token: {e}")
            if sresp.status_code != 200:
                raise AssertionError(f"Expected 200 from session, got {sresp.status_code}, body: {sresp.text}")
            try:
                sjson = sresp.json()
            except ValueError:
                raise AssertionError(f"Session response not valid JSON: {sresp.text}")
            csrf_token = sjson.get("csrfToken")

        # Prepare headers for the authenticated GET
        get_headers = {"Accept": "application/json"}
        if csrf_token:
            get_headers["x-csrf-token"] = csrf_token

        # GET /api/me/consents
        consents_url = f"{BASE}/me/consents"
        try:
            creq = session.get(consents_url, headers=get_headers, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Request to GET /api/me/consents failed: {e}")

        assert creq.status_code == 200, f"Expected 200 from GET /api/me/consents, got {creq.status_code}, body: {creq.text}"

        try:
            cjson = creq.json()
        except ValueError:
            raise AssertionError(f"GET /api/me/consents did not return valid JSON: {creq.text}")

        # According to PRD, response_schema: { "consents": "array" }
        assert "consents" in cjson, f"'consents' key not found in response: {cjson}"
        assert isinstance(cjson["consents"], list), f"'consents' is not a list: {type(cjson['consents'])}"

        # Basic validation of consent items if present
        for idx, item in enumerate(cjson["consents"]):
            assert isinstance(item, dict), f"Consent item at index {idx} is not an object: {item}"
            # best-effort checks: common consent fields
            if "purpose" in item:
                assert isinstance(item["purpose"], str), f"Consent purpose at index {idx} is not a string"
            if "granted" in item:
                assert isinstance(item["granted"], bool), f"Consent granted at index {idx} is not a boolean"

        print("TC006 passed: GET /api/me/consents returned 200 and a consents array.")

    finally:
        # Attempt logout to clean up the session if possible
        try:
            if csrf_token:
                logout_headers = {"Accept": "application/json", "Content-Type": "application/json", "x-csrf-token": csrf_token}
            else:
                logout_headers = {"Accept": "application/json", "Content-Type": "application/json"}
            logout_url = f"{BASE}/auth/logout"
            try:
                lresp = session.post(logout_url, headers=logout_headers, timeout=TIMEOUT)
                # optional check: if logout returns ok true
                if lresp.status_code == 200:
                    try:
                        lj = lresp.json()
                        # it's fine if it doesn't include ok; ignore if not present
                        if "ok" in lj and lj["ok"] is not True:
                            print(f"Logout response returned ok != true: {lj}", file=sys.stderr)
                    except ValueError:
                        # non-json logout response; ignore
                        pass
                else:
                    # Not critical; just inform
                    print(f"Logout returned status {lresp.status_code}", file=sys.stderr)
            except requests.RequestException:
                # ignore logout failures
                pass
        finally:
            session.close()


if __name__ == "__main__":
    test_get_me_consents_returns_active_user_consents()