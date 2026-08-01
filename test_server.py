import unittest
from unittest.mock import Mock, patch
import json
import os
import server

class TestDAOServer(unittest.TestCase):
    def test_excel_missing(self):
        # Test that parse_excel_data raises FileNotFoundError if file is missing
        with patch('os.path.exists', return_value=False):
            with self.assertRaises(FileNotFoundError):
                server.parse_excel_data()

    def test_login_invalid_credentials(self):
        # Mock request data
        class MockRequest:
            def __init__(self):
                self.rfile = Mock()
                self.wfile = Mock()
                self.headers = {'Content-Length': '40'}
                
        # Mock body reading with wrong credentials
        mock_req = MockRequest()
        mock_req.rfile.read.return_value = b'{"username":"wrong","password":"wrong"}'
        
        handler = Mock()
        handler.rfile = mock_req.rfile
        handler.wfile = mock_req.wfile
        handler.headers = mock_req.headers
        handler.path = '/api/login'
        handler.send_error_response = Mock()
        
        # Run do_POST logic for login
        server.DAOHandler.do_POST(handler)
        
        # Verify it sent a 401 error
        handler.send_error_response.assert_called_with(401, "Usuario o contraseña incorrectos")

    def test_login_valid_credentials(self):
        # Mock request data
        class MockRequest:
            def __init__(self):
                self.rfile = Mock()
                self.wfile = Mock()
                self.headers = {'Content-Length': '40'}
                
        # Mock body reading with correct credentials
        mock_req = MockRequest()
        mock_req.rfile.read.return_value = b'{"username":"dao","password":"daosrl2026"}'
        
        handler = Mock()
        handler.rfile = mock_req.rfile
        handler.wfile = mock_req.wfile
        handler.headers = mock_req.headers
        handler.path = '/api/login'
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        
        # Run do_POST logic for login
        server.DAOHandler.do_POST(handler)
        
        # Verify response 200 was sent
        handler.send_response.assert_called_with(200)
        handler.send_header.assert_any_call('Content-Type', 'application/json; charset=utf-8')

if __name__ == '__main__':
    unittest.main()
