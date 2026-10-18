import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.core.client import client_ip, stored_ip


def request(headers: dict, peer: str | None = "203.0.113.9"):
    return SimpleNamespace(headers={k.lower(): v for k, v in headers.items()}, client=SimpleNamespace(host=peer) if peer else None)


class ClientIpTest(unittest.TestCase):
    @patch("app.core.client.get_settings", return_value=SimpleNamespace(trust_proxy=True))
    def test_proxy_headers_must_hold_an_address(self, _):
        self.assertEqual(client_ip(request({"CF-Connecting-IP": "198.51.100.7"})), "198.51.100.7")
        # A forged, non-address header falls through to the next source instead of reaching an inet column.
        self.assertEqual(client_ip(request({"CF-Connecting-IP": "garbage", "X-Forwarded-For": "198.51.100.8, 10.0.0.1"})), "198.51.100.8")
        self.assertEqual(client_ip(request({"CF-Connecting-IP": "garbage"})), "203.0.113.9")

    @patch("app.core.client.get_settings", return_value=SimpleNamespace(trust_proxy=False))
    def test_without_proxy_trust_headers_are_ignored(self, _):
        self.assertEqual(client_ip(request({"CF-Connecting-IP": "198.51.100.7"})), "203.0.113.9")

    @patch("app.core.client.get_settings", return_value=SimpleNamespace(trust_proxy=False))
    def test_stored_ip_is_an_address_or_nothing(self, _):
        self.assertEqual(stored_ip(request({}, peer="testclient")), None)
        self.assertEqual(stored_ip(request({}, peer=None)), None)
        self.assertEqual(stored_ip(request({}, peer="2001:db8::1")), "2001:db8::1")

    @patch("app.core.client.get_settings", return_value=SimpleNamespace(trust_proxy=True, edge_auth_token="t" * 32))
    def test_worker_forwarded_ip_needs_the_edge_token(self, _):
        fwd = {"X-Aquastats-Client-IP": "198.51.100.20", "CF-Connecting-IP": "2a06:98c0:3600::103"}
        self.assertEqual(client_ip(request({**fwd, "X-Edge-Auth": "t" * 32})), "198.51.100.20")
        # Without (or with a wrong) edge token the header is the caller's word only.
        self.assertEqual(client_ip(request({**fwd, "X-Edge-Auth": "wrong"})), "2a06:98c0:3600::103")


if __name__ == "__main__":
    unittest.main()
