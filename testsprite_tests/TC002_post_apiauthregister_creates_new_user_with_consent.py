import requests
import uuid
import sys

BASE = "http://localhost:5173/api"
TIMEOUT = 30

LANDLORD_EMAIL = "landlord@makaan.test"
LANDLORD_PASSWORD = "makaan-demo-2026"


def test_post_apiauthregister_creates_new_user_with_consent():
    session = requests.Session()
    user_id = None
    created_user_email = None

    # Login as landlord to obtain CSRF token and session cookie (mutations require x-csrf-token)
    try:
        login_payload = {"email": LANDLORD_EMAIL, "password": LANDLORD_PASSWORD}
        r = session.post(f"{BASE}/auth/login", json=login_payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Login request failed: {e}")

    if r.status_code != 200:
        raise AssertionError(f"Expected 200 from login, got {r.status_code}: {r.text}")

    try:
        login_json = r.json()
    except ValueError:
        raise AssertionError("Login response is not valid JSON")

    csrf_token = login_json.get("csrfToken")
    if not csrf_token:
        raise AssertionError("Login response did not contain csrfToken")

    headers = {"x-csrf-token": csrf_token, "Content-Type": "application/json"}

    # Prepare unique test user payload
    unique_suffix = uuid.uuid4().hex
    created_user_email = f"testuser_{unique_suffix}@makaan.test"
    created_user_password = "makaan-test-pass-2026"
    register_payload = {
        "email": created_user_email,
        "password": created_user_password,
        "name": "Test User",
        "role": "tenant",
        "consent": {
            "marketing": False,
            "research": True
        }
    }

    try:
        # POST /api/auth/register
        try:
            resp = session.post(f"{BASE}/auth/register", json=register_payload, headers=headers, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Register request failed: {e}")

        # Handle expected responses
        if resp.status_code == 201:
            try:
                resp_json = resp.json()
            except ValueError:
                raise AssertionError("Register response is not valid JSON")

            # Validate presence of user object and csrfToken
            assert "user" in resp_json, f"'user' not in response: {resp.text}"
            assert "csrfToken" in resp_json, f"'csrfToken' not in response: {resp.text}"

            user = resp_json["user"]
            # Basic validations on user object
            assert isinstance(user, dict), "user is not an object"
            assert user.get("email") == created_user_email, f"Registered user email mismatch: expected {created_user_email}, got {user.get('email')}"
            # Try to capture user id if present for cleanup
            user_id = user.get("id") or user.get("userId") or user.get("_id")
        elif resp.status_code == 409:
            raise AssertionError(f"Register failed with 409 Conflict (email may already exist): {resp.text}")
        else:
            raise AssertionError(f"Unexpected status code from register: {resp.status_code}, body: {resp.text}")

    finally:
        # Cleanup: best-effort deletion of created user if we have an identifier
        # Attempt multiple likely paths for user deletion; ignore failures but surface unexpected errors
        if user_id:
            delete_paths = [
                f"{BASE}/users/{user_id}",
                f"{BASE}/auth/users/{user_id}",
                f"{BASE}/users/{user_id}/delete",
                f"{BASE}/me/{user_id}",
                f"{BASE}/me"  # in case DELETE /api/me deletes current authenticated user (we are landlord, may not delete target)
            ]
            deleted = False
            last_exception = None
            for path in delete_paths:
                try:
                    # Use landlord session and csrf header to attempt deletion
                    del_resp = session.delete(path, headers=headers, timeout=TIMEOUT)
                except requests.RequestException as e:
                    last_exception = e
                    continue

                if del_resp.status_code in (200, 204):
                    deleted = True
                    break
                # Some APIs might return 404/403/405; continue trying other paths
            if not deleted:
                # As an additional attempt, try to login as the created user and delete /me
                try:
                    new_session = requests.Session()
                    login_new = {"email": created_user_email, "password": created_user_password}
                    lr = new_session.post(f"{BASE}/auth/login", json=login_new, timeout=TIMEOUT)
                    if lr.status_code == 200:
                        try:
                            lr_json = lr.json()
                            new_csrf = lr_json.get("csrfToken")
                        except Exception:
                            new_csrf = None
                        new_headers = {"x-csrf-token": new_csrf, "Content-Type": "application/json"} if new_csrf else {"Content-Type": "application/json"}
                        try:
                            del_me = new_session.delete(f"{BASE}/me", headers=new_headers, timeout=TIMEOUT)
                            if del_me.status_code in (200, 204):
                                deleted = True
                        except requests.RequestException:
                            pass
                except requests.RequestException:
                    pass
            # If not deleted, log but do not fail the test for cleanup inability
            if not deleted:
                # best-effort failed; print to stderr so test logs contain info
                sys.stderr.write(f"Cleanup: unable to delete user id={user_id} email={created_user_email}\n")

if __name__ == "__main__":
    try:
        test_post_apiauthregister_creates_new_user_with_consent()
        print("TC002 passed")
    except AssertionError as e:
        print(f"TC002 failed: {e}")
        raise
    except Exception as e:
        print(f"TC002 encountered an error: {e}")
        raise