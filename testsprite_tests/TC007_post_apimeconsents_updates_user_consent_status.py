import requests
import sys

BASE = "http://localhost:5173/api"
LOGIN_URL = f"{BASE}/auth/login"
CONSENTS_URL = f"{BASE}/me/consents"
TIMEOUT = 30.0

USERNAME = "tenant@makaan.test"
PASSWORD = "makaan-demo-2026"


def test_post_me_consents_updates_user_consent_status():
    session = requests.Session()
    try:
        # Login to obtain session cookie and csrf token
        login_payload = {"email": USERNAME, "password": PASSWORD}
        resp = session.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT, headers={"Accept": "application/json"})
        resp.raise_for_status()
        login_json = resp.json()
        assert resp.status_code == 200, f"Expected 200 from login, got {resp.status_code}"
        assert "csrfToken" in login_json, "Login response missing csrfToken"
        csrf_token = login_json["csrfToken"]

        # Fetch current consents to record previous state for cleanup
        resp = session.get(CONSENTS_URL, timeout=TIMEOUT, headers={"Accept": "application/json"})
        resp.raise_for_status()
        assert resp.status_code == 200, f"Expected 200 from GET consents, got {resp.status_code}"
        consents_json = resp.json()
        consents_list = consents_json.get("consents", []) if isinstance(consents_json, dict) else []

        # Choose a purpose to update: reuse an existing one if available, otherwise pick a test purpose
        if consents_list and isinstance(consents_list, list) and len(consents_list) > 0:
            original_consent = consents_list[0]
            purpose = original_consent.get("purpose", "test:consent")
            previous_granted = original_consent.get("granted")
        else:
            purpose = "test:integration-consent"
            previous_granted = None

        # Determine new granted value (toggle if we had a previous boolean, otherwise set True)
        new_granted = (not previous_granted) if isinstance(previous_granted, bool) else True

        # Perform POST to update consent
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-csrf-token": csrf_token,
        }
        payload = {"purpose": purpose, "granted": new_granted}
        resp = session.post(CONSENTS_URL, json=payload, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        assert resp.status_code == 200, f"Expected 200 from POST /me/consents, got {resp.status_code}"
        resp_json = resp.json()
        assert isinstance(resp_json, dict), "Response JSON is not an object"
        assert "consent" in resp_json, "Response missing 'consent' object"
        consent = resp_json["consent"]
        assert consent.get("purpose") == purpose, f"Consent purpose mismatch: expected {purpose}, got {consent.get('purpose')}"
        # Some APIs might return boolean or string; ensure boolean comparison
        assert bool(consent.get("granted")) == bool(new_granted), f"Consent granted mismatch: expected {new_granted}, got {consent.get('granted')}"

        print("TC007 passed: POST /api/me/consents updated consent and returned the updated consent object.")

    except requests.exceptions.RequestException as e:
        print(f"HTTP request failed: {e}", file=sys.stderr)
        raise
    finally:
        # Attempt to restore previous consent state to avoid side-effects
        try:
            # Need to re-use csrf_token; if not available, try to obtain session csrf via session GET /auth/session
            if 'csrf_token' not in locals() or csrf_token is None:
                try:
                    sresp = session.get(f"{BASE}/auth/session", timeout=TIMEOUT, headers={"Accept": "application/json"})
                    if sresp.status_code == 200:
                        csrf_token = sresp.json().get("csrfToken")
                except Exception:
                    csrf_token = None

            if csrf_token:
                restore_headers = {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "x-csrf-token": csrf_token,
                }
                if previous_granted is None:
                    # If there was no previous consent, disable it to minimize footprint
                    restore_payload = {"purpose": purpose, "granted": False}
                else:
                    restore_payload = {"purpose": purpose, "granted": previous_granted}
                try:
                    r = session.post(CONSENTS_URL, json=restore_payload, headers=restore_headers, timeout=TIMEOUT)
                    # Accept both 200 and other responses but log if non-200
                    if r.status_code != 200:
                        print(f"Warning: failed to restore consent state (status {r.status_code}): {r.text}", file=sys.stderr)
                except requests.exceptions.RequestException as e:
                    print(f"Warning: exception while restoring consent: {e}", file=sys.stderr)
        finally:
            session.close()


if __name__ == "__main__":
    test_post_me_consents_updates_user_consent_status()