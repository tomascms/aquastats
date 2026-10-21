"""#17: DNS rebinding. The live-results client connects to the address that was checked, never to a new answer."""
import socket
import unittest
from unittest import mock

import httpx

from app.core import ssrf
from app.domain import live_results

PUBLIC = "93.184.215.14"
PRIVATE = "127.0.0.1"


def resolver(*answers):
    """getaddrinfo that gives a different address on each call, as a rebinding DNS server does."""
    calls = iter(answers)

    def getaddrinfo(host, *_args, **_kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (next(calls), 0))]

    return mock.patch.object(ssrf.socket, "getaddrinfo", side_effect=getaddrinfo)


class RebindingTest(unittest.TestCase):
    def setUp(self):
        self.sent = []
        patcher = mock.patch.object(
            httpx.HTTPTransport, "handle_request", autospec=True,
            side_effect=lambda _self, request: self.sent.append(request) or httpx.Response(200, content=b"ok"),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def fetch(self, url="https://results.example.org/live/index.htm"):
        with httpx.Client(transport=ssrf.PinnedTransport(), follow_redirects=False) as client:
            return live_results._fetch(client, url)

    def test_second_answer_pointing_inside_is_refused_before_connecting(self):
        with resolver(PUBLIC, PRIVATE), self.assertRaises(ValueError):
            self.fetch()
        self.assertEqual(self.sent, [])

    def test_connection_goes_to_the_checked_ip_with_original_host_and_sni(self):
        # A third answer (private) would only matter if httpx resolved the name again: it must not be asked.
        with resolver(PUBLIC, PUBLIC, PRIVATE) as getaddrinfo:
            self.assertEqual(self.fetch(), b"ok")
        self.assertEqual(getaddrinfo.call_count, 2)
        (request,) = self.sent
        self.assertEqual(request.url.host, PUBLIC)
        self.assertEqual(request.headers["host"], "results.example.org")
        self.assertEqual(request.extensions["sni_hostname"], "results.example.org")

    def test_private_first_answer_is_refused(self):
        with resolver(PRIVATE), self.assertRaises(ValueError):
            self.fetch()
        self.assertEqual(self.sent, [])


if __name__ == "__main__":
    unittest.main()
