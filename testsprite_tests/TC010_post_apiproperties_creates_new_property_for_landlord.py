import requests
import time
import sys

BASE_URL = "http://localhost:5173/api"
LANDLORD_EMAIL = "landlord@makaan.test"
LANDLORD_PASSWORD = "makaan-demo-2026"
TIMEOUT = 30


def test_post_apiproperties_creates_new_property_for_landlord():
    session = requests.Session()
    created_property_id = None

    try:
        # Login to obtain session cookie and CSRF token
        login_url = f"{BASE_URL}/auth/login"
        login_payload = {"email": LANDLORD_EMAIL, "password": LANDLORD_PASSWORD}
        try:
            resp = session.post(login_url, json=login_payload, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Login request failed: {e}")

        assert resp.status_code == 200, f"Expected 200 from login, got {resp.status_code}, body: {resp.text}"
        try:
            login_json = resp.json()
        except ValueError:
            raise AssertionError(f"Login response is not valid JSON: {resp.text}")

        csrf_token = login_json.get("csrfToken")
        assert csrf_token, f"Login response missing csrfToken: {login_json}"

        # Prepare headers for mutations
        session.headers.update({"x-csrf-token": csrf_token, "Accept": "application/json"})

        # Create a unique property payload
        unique_suffix = str(int(time.time() * 1000))
        property_payload = {
            "title": f"Test Property {unique_suffix}",
            "addressLine": "123 Test Street",
            "city": "Testville",
            "stateCode": "TS",
            "propertyType": "apartment",
            "bedrooms": 2,
            "monthlyRentPaise": 500000,      # ₹5,000.00
            "defaultDepositPaise": 1000000   # ₹10,000.00
        }

        # POST /api/properties
        create_url = f"{BASE_URL}/properties"
        try:
            create_resp = session.post(create_url, json=property_payload, timeout=TIMEOUT)
        except requests.RequestException as e:
            raise AssertionError(f"Create property request failed: {e}")

        assert create_resp.status_code == 201, f"Expected 201 for property creation, got {create_resp.status_code}, body: {create_resp.text}"
        try:
            create_json = create_resp.json()
        except ValueError:
            raise AssertionError(f"Create property response is not valid JSON: {create_resp.text}")

        # Response should contain 'property' object, optional 'warning'
        assert "property" in create_json, f"Response missing 'property' key: {create_json}"
        prop = create_json["property"]
        assert isinstance(prop, dict), f"'property' is not an object: {prop}"

        # Basic field assertions: ensure returned object includes expected fields and values
        # Title and addressLine should match what we sent
        assert prop.get("title") == property_payload["title"], f"Returned title mismatch. Expected {property_payload['title']}, got {prop.get('title')}"
        assert prop.get("addressLine") == property_payload["addressLine"], f"Returned addressLine mismatch. Expected {property_payload['addressLine']}, got {prop.get('addressLine')}"
        # Check numeric fields exist (may be returned as ints)
        assert prop.get("bedrooms") == property_payload["bedrooms"], f"Returned bedrooms mismatch. Expected {property_payload['bedrooms']}, got {prop.get('bedrooms')}"
        # rent/deposit may be present under same names
        assert prop.get("monthlyRentPaise") == property_payload["monthlyRentPaise"], f"Returned monthlyRentPaise mismatch. Expected {property_payload['monthlyRentPaise']}, got {prop.get('monthlyRentPaise')}"
        assert prop.get("defaultDepositPaise") == property_payload["defaultDepositPaise"], f"Returned defaultDepositPaise mismatch. Expected {property_payload['defaultDepositPaise']}, got {prop.get('defaultDepositPaise')}"

        # Extract property id for cleanup. Try common id keys.
        created_property_id = prop.get("id") or prop.get("propertyId") or prop.get("_id") or create_json.get("id")
        assert created_property_id, f"Could not determine created property id from response: {create_json}"

        # If a warning is present, ensure it's a string
        if "warning" in create_json:
            assert isinstance(create_json["warning"], str), f"Expected 'warning' to be a string when present, got: {type(create_json['warning'])}"

        print(f"Property created successfully with id: {created_property_id}")

    finally:
        # Cleanup: delete the created property if we have an id
        if created_property_id:
            delete_url = f"{BASE_URL}/properties/{created_property_id}"
            try:
                del_resp = session.delete(delete_url, timeout=TIMEOUT)
            except requests.RequestException as e:
                raise AssertionError(f"Delete property request failed: {e}")

            assert del_resp.status_code == 200, f"Expected 200 from delete, got {del_resp.status_code}, body: {del_resp.text}"
            try:
                del_json = del_resp.json()
            except ValueError:
                raise AssertionError(f"Delete response is not valid JSON: {del_resp.text}")

            # Expect { "ok": true } per PRD
            ok = del_json.get("ok")
            assert ok is True, f"Expected delete response ok true, got: {del_json}"

            print(f"Property with id {created_property_id} deleted successfully.")


if __name__ == "__main__":
    try:
        test_post_apiproperties_creates_new_property_for_landlord()
        print("TC010 passed.")
    except AssertionError as e:
        print(f"TC010 failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"TC010 encountered an unexpected error: {e}")
        sys.exit(2)