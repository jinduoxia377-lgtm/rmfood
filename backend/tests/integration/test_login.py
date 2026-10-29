#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试登录API"""
import requests
import sys

def test_login():
    url = "http://localhost:8000/api/v1/auth/login"
    data = {"username": "admin", "password": "admin123"}

    print("Testing login with username: " + data['username'])

    try:
        response = requests.post(url, json=data, timeout=10)
        print("Status: " + str(response.status_code))
        print("Response: " + response.text)

        if response.status_code == 200:
            result = response.json()
            if 'access_token' in result:
                print("\n[OK] Login successful!")
                print("Access token: " + result['access_token'][:50] + "...")
                return True
            else:
                print("\n[FAIL] Login failed - no access_token in response")
                return False
        else:
            print("\n[FAIL] Login failed with status " + str(response.status_code))
            return False
    except requests.exceptions.ConnectionError:
        print("[FAIL] Cannot connect to server - is it running?")
        return False
    except Exception as e:
        print("[FAIL] Error: " + str(e))
        return False

def test_health():
    url = "http://localhost:8000/health"
    try:
        response = requests.get(url, timeout=5)
        print("\nHealth check status: " + str(response.status_code))
        if response.status_code == 200:
            print("Health check response: " + str(response.json()))
    except Exception as e:
        print("Health check error: " + str(e))

if __name__ == "__main__":
    print("=" * 50)
    print("RMFOOD Backend Login Test")
    print("=" * 50)

    print("\n--- Backend Health Check ---")
    test_health()

    print("\n--- Login Test ---")
    success = test_login()

    sys.exit(0 if success else 1)
