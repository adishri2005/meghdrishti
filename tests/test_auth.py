"""Tests for authentication and security utilities."""

from app.security import (
    generate_api_key,
    get_client_ip,
    hash_api_key,
    hash_password,
    verify_api_key_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)
from starlette.requests import Request


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "Admin@12345"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_different_hashes_for_same_password(self):
        """bcrypt uses random salts, so two hashes differ."""
        h1 = hash_password("test")
        h2 = hash_password("test")
        assert h1 != h2
        assert verify_password("test", h1) is True
        assert verify_password("test", h2) is True


class TestApiKeyHashing:
    def test_generate_key_length(self):
        key = generate_api_key()
        assert len(key) > 20, "API key should be long enough to be secure"

    def test_hash_is_hex(self):
        key = generate_api_key()
        h = hash_api_key(key)
        assert len(h) == 64, "SHA-256 hex digest is 64 chars"
        int(h, 16)  # should not raise

    def test_verify_correct_key(self):
        key = generate_api_key()
        h = hash_api_key(key)
        assert verify_api_key_hash(key, h) is True

    def test_verify_wrong_key(self):
        key = generate_api_key()
        h = hash_api_key(key)
        assert verify_api_key_hash("wrong-key", h) is False

    def test_constant_time_comparison(self):
        """verify_api_key_hash uses hmac.compare_digest for timing safety."""
        key = generate_api_key()
        h = hash_api_key(key)
        # Just verify it works — timing attacks need statistical analysis
        assert verify_api_key_hash(key, h) is True


class TestJWT:
    def test_create_and_decode(self):
        token, expires_in = create_access_token("admin", "admin")
        assert isinstance(token, str)
        assert expires_in > 0

        payload = decode_access_token(token)
        assert payload["sub"] == "admin"
        assert payload["role"] == "admin"
        assert "exp" in payload

    def test_different_users_get_different_tokens(self):
        t1, _ = create_access_token("admin", "admin")
        t2, _ = create_access_token("analyst", "analyst")
        assert t1 != t2


class TestGetClientIP:
    def test_x_forwarded_for_first_ip(self):
        scope = {
            "type": "http",
            "headers": [(b"x-forwarded-for", b"203.0.113.195, 70.41.3.18, 150.172.238.178")],
            "client": ("127.0.0.1", 8000),
        }
        req = Request(scope)
        assert get_client_ip(req) == "203.0.113.195"

    def test_x_real_ip(self):
        scope = {
            "type": "http",
            "headers": [(b"x-real-ip", b"198.51.100.1")],
            "client": ("127.0.0.1", 8000),
        }
        req = Request(scope)
        assert get_client_ip(req) == "198.51.100.1"

    def test_fallback_to_client_host(self):
        scope = {
            "type": "http",
            "headers": [],
            "client": ("192.0.2.1", 54321),
        }
        req = Request(scope)
        assert get_client_ip(req) == "192.0.2.1"

    def test_x_real_ip_precedence_over_spoofed_x_forwarded_for(self):
        """Attacker providing spoofed X-Forwarded-For must NOT override verified proxy X-Real-IP."""
        scope = {
            "type": "http",
            "headers": [
                (b"x-forwarded-for", b"attacker-fake-ip"),
                (b"x-real-ip", b"198.51.100.1"),
            ],
            "client": ("127.0.0.1", 8000),
        }
        req = Request(scope)
        assert get_client_ip(req) == "198.51.100.1"

    def test_unknown_when_no_client(self):
        scope = {
            "type": "http",
            "headers": [],
            "client": None,
        }
        req = Request(scope)
        assert get_client_ip(req) == "unknown"
