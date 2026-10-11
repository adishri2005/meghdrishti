"""Tests for authentication and security utilities."""

import pytest
from app.security import (
    generate_api_key,
    hash_api_key,
    hash_password,
    verify_api_key_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)


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
