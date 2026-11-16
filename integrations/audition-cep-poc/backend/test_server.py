import http.client
import json
import logging
import threading
import time
import unittest
from http.server import HTTPServer
from server import Handler


class BackendTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join()
        cls.server.server_close()

    def request(self, method, path, body=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        try:
            connection.request(method, path, body, {'Content-Type': 'application/json'})
            response = connection.getresponse()
            return response.status, json.loads(response.read())
        finally:
            connection.close()

    def test_health(self):
        status, data = self.request('GET', '/health')
        self.assertEqual(status, 200)
        self.assertTrue(data['ok'])

    def test_echo(self):
        status, data = self.request('POST', '/echo', json.dumps({'probe': 'aacp-cep-poc', 'requestId': 'synthetic-1'}))
        self.assertEqual(status, 200)
        self.assertEqual(data['requestId'], 'synthetic-1')
        self.assertEqual(data['reply'], 'round-trip-ok')

    def test_invalid_input(self):
        for body in ('[]', '{', json.dumps({'probe': 'bad'}), 'x' * 2049):
            with self.subTest(body=body[:20]):
                status, data = self.request('POST', '/echo', body)
                self.assertEqual(status, 400)
                self.assertFalse(data['ok'])

    def test_unknown_route(self):
        status, data = self.request('GET', '/unknown')
        self.assertEqual(status, 404)
        self.assertEqual(data['code'], 'ENDPOINT_NOT_FOUND')

    def test_log_clock_is_utc(self):
        self.assertIs(logging.Formatter.converter, time.gmtime)


if __name__ == '__main__':
    unittest.main()
