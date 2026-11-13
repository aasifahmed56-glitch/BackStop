"""
Redaction unit tests.

Planted items from the sample data must NEVER survive redact():
  - sk_test_FAKE_0000000000EXAMPLE  (fake Stripe key)
  - riya.example@example.org        (fake personal email)
  - +91 00000 00000                 (fake personal phone)
"""
from app.redact import redact, redact_with_counts


# ---------------------------------------------------------------------------
# Planted sample items (P5, P6)
# ---------------------------------------------------------------------------

class TestPlantedSecretRedacted:
    PLANTED_KEY = "sk_test_FAKE_0000000000EXAMPLE"
    TEXT = f"Use test key {PLANTED_KEY} in CI"

    def test_key_not_in_output(self):
        assert self.PLANTED_KEY not in redact(self.TEXT)

    def test_replacement_tag_present(self):
        assert "[REDACTED_SECRET]" in redact(self.TEXT)

    def test_surrounding_context_preserved(self):
        result = redact(self.TEXT)
        assert "Use test key" in result
        assert "in CI" in result


class TestPlantedEmailRedacted:
    PLANTED_EMAIL = "riya.example@example.org"
    TEXT = f"Contact Riya at {PLANTED_EMAIL} for auth questions."

    def test_email_not_in_output(self):
        assert self.PLANTED_EMAIL not in redact(self.TEXT)

    def test_replacement_tag_present(self):
        assert "[REDACTED_EMAIL]" in redact(self.TEXT)


class TestPlantedPhoneRedacted:
    PLANTED_PHONE = "+91 00000 00000"
    TEXT = f"Call Riya on {PLANTED_PHONE} if urgent."

    def test_phone_not_in_output(self):
        assert self.PLANTED_PHONE not in redact(self.TEXT)

    def test_replacement_tag_present(self):
        assert "[REDACTED_PHONE]" in redact(self.TEXT)


# ---------------------------------------------------------------------------
# Combined: all three in one block (simulates meeting-07.md)
# ---------------------------------------------------------------------------

class TestMeeting07Block:
    TEXT = (
        "Riya's personal email: riya.example@example.org\n"
        "Riya's phone: +91 00000 00000\n"
        "Test key: sk_test_FAKE_0000000000EXAMPLE"
    )

    def test_no_planted_values_survive(self):
        result = redact(self.TEXT)
        assert "riya.example@example.org" not in result
        assert "+91 00000 00000" not in result
        assert "sk_test_FAKE_0000000000EXAMPLE" not in result

    def test_all_three_tags_present(self):
        result = redact(self.TEXT)
        assert "[REDACTED_EMAIL]" in result
        assert "[REDACTED_PHONE]" in result
        assert "[REDACTED_SECRET]" in result


# ---------------------------------------------------------------------------
# redact_with_counts — count accuracy
# ---------------------------------------------------------------------------

class TestRedactWithCounts:
    def test_counts_planted_items(self):
        text = (
            "key sk_test_FAKE_0000000000EXAMPLE email riya.example@example.org "
            "phone +91 00000 00000"
        )
        _, counts = redact_with_counts(text)
        assert counts["secret"] >= 1
        assert counts["email"] >= 1
        assert counts["phone"] >= 1

    def test_counts_zero_on_clean_text(self):
        _, counts = redact_with_counts("No sensitive data here whatsoever.")
        assert counts == {"secret": 0, "email": 0, "phone": 0}

    def test_multiple_emails_counted(self):
        text = "a@example.com and b@example.com and c@example.org"
        _, counts = redact_with_counts(text)
        assert counts["email"] == 3

    def test_values_absent_from_output(self):
        text = "sk_test_FAKE_0000000000EXAMPLE"
        result, _ = redact_with_counts(text)
        assert "sk_test_FAKE_0000000000EXAMPLE" not in result


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_string(self):
        assert redact("") == ""

    def test_no_sensitive_data(self):
        text = "Normal commit message: add pagination to list view"
        assert redact(text) == text

    def test_idempotent(self):
        text = "Contact admin@example.com for help"
        once = redact(text)
        twice = redact(once)
        assert once == twice

    def test_other_secrets_caught(self):
        assert "[REDACTED_SECRET]" in redact("token: abcdef1234567890abcdef")
        assert "[REDACTED_SECRET]" in redact("password=supersecretpassword123")

