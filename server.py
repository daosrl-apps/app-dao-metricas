import http.server
import socketserver
import json
import os
import urllib.parse
import xlrd
import traceback

PORT = 8000

def parse_excel_data():
    excel_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Resumen_InterAnual_2026.XLS")
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"No se encontró el archivo Excel en: {excel_path}")
        
    workbook = xlrd.open_workbook(excel_path)
    
    def get_date_str(val):
        if isinstance(val, float):
            try:
                date_tuple = xlrd.xldate_as_tuple(val, workbook.datemode)
                return f"{date_tuple[0]}-{date_tuple[1]:02d}-{date_tuple[2]:02d}"
            except:
                pass
        val_str = str(val).strip()
        if val_str.endswith(".0"):
            val_str = val_str[:-2]
        return val_str
        
    def get_cell_num(val):
        if val == "" or val is None:
            return 0.0
        try:
            return float(val)
        except ValueError:
            return 0.0

    # 1. Parsear Hoja: Resumen
    sheet_res = workbook.sheet_by_name("Resumen")
    
    # Los meses están en la Fila 1, desde la Columna 3 a la 14
    # La Columna 2 es la 'Media'
    months = []
    month_cols = []
    for c in range(3, sheet_res.ncols):
        val = sheet_res.cell_value(1, c)
        if val != "" and val is not None:
            date_str = get_date_str(val)
            # Solo incluir si parece una fecha válida (YYYY-MM-DD)
            if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
                months.append(date_str)
                month_cols.append((c, date_str))
            
    resumen_data = {}
    for r in range(2, sheet_res.nrows):
        row_name = str(sheet_res.cell_value(r, 1)).strip()
        if not row_name:
            continue
            
        media_val = get_cell_num(sheet_res.cell_value(r, 2))
        month_vals = {}
        for c, date_str in month_cols:
            month_vals[date_str] = get_cell_num(sheet_res.cell_value(r, c))
            
        resumen_data[row_name] = {
            "media": media_val,
            "valores": month_vals
        }

    # 2. Parsear Hoja: Cliente $
    sheet_cli_usd = workbook.sheet_by_name("Cliente $")
    
    # Encabezados de meses en la Fila 2, desde Columna 4
    cli_usd_headers = {}
    for c in range(4, sheet_cli_usd.ncols):
        val = sheet_cli_usd.cell_value(2, c)
        if val != "":
            cli_usd_headers[c] = get_date_str(val)
            
    clientes_usd = []
    for r in range(3, sheet_cli_usd.nrows):
        name = str(sheet_cli_usd.cell_value(r, 1)).strip()
        if not name or name in ["Nombre", "TOTAL", "Media", "TOTALES"]:
            continue
            
        acumulado = get_cell_num(sheet_cli_usd.cell_value(r, 2))
        media = get_cell_num(sheet_cli_usd.cell_value(r, 3))
        
        month_vals = {}
        for c, date_str in cli_usd_headers.items():
            month_vals[date_str] = get_cell_num(sheet_cli_usd.cell_value(r, c))
            
        clientes_usd.append({
            "nombre": name,
            "acumulado": acumulado,
            "media": media,
            "valores": month_vals
        })

    # 3. Parsear Hoja: Cliente m2
    sheet_cli_m2 = workbook.sheet_by_name("Cliente m2")
    
    # Encabezados de meses en la Fila 2, desde Columna 3
    cli_m2_headers = {}
    for c in range(3, sheet_cli_m2.ncols):
        val = sheet_cli_m2.cell_value(2, c)
        if val != "":
            cli_m2_headers[c] = get_date_str(val)
            
    clientes_m2 = []
    for r in range(3, sheet_cli_m2.nrows):
        name = str(sheet_cli_m2.cell_value(r, 1)).strip()
        if not name or name in ["Nombre", "TOTAL", "Media", "TOTALES"]:
            continue
            
        media = get_cell_num(sheet_cli_m2.cell_value(r, 2))
        
        month_vals = {}
        for c, date_str in cli_m2_headers.items():
            month_vals[date_str] = get_cell_num(sheet_cli_m2.cell_value(r, c))
            
        clientes_m2.append({
            "nombre": name,
            "media": media,
            "valores": month_vals
        })
        
    sorted_months = sorted(months)
    ultimo_mes = sorted_months[-1] if sorted_months else ""

    return {
        "meses": sorted_months,
        "ultimo_mes": ultimo_mes,
        "resumen": resumen_data,
        "clientes_usd": clientes_usd,
        "clientes_m2": clientes_m2
    }

class DAOHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
        super().__init__(*args, directory=self.frontend_dir, **kwargs)
        
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/data':
            # Verificar token de autorización
            auth_header = self.headers.get('Authorization', '')
            if auth_header != 'Bearer dao-secure-token-2026':
                self.send_error_response(401, "No autorizado")
                return
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            try:
                data = parse_excel_data()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                print(f"Error parseando Excel: {e}")
                traceback.print_exc()
                error_info = {"error": str(e), "trace": traceback.format_exc()}
                self.wfile.write(json.dumps(error_info, ensure_ascii=False).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/login':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                credentials = json.loads(body.decode('utf-8'))
                
                username = credentials.get('username')
                password = credentials.get('password')
                
                # Credenciales de inicio de sesión
                if username == "dao" and password == "daosrl2026":
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"token": "dao-secure-token-2026"}).encode('utf-8'))
                else:
                    self.send_error_response(401, "Usuario o contraseña incorrectos")
            except Exception as e:
                self.send_error_response(500, f"Error al iniciar sesión: {e}")
                
        elif parsed_url.path == '/api/upload':
            # Verificar token de autorización
            auth_header = self.headers.get('Authorization', '')
            if auth_header != 'Bearer dao-secure-token-2026':
                self.send_error_response(401, "No autorizado")
                return
                
            try:
                content_type = self.headers.get('Content-Type', '')
                if 'multipart/form-data' not in content_type:
                    self.send_error_response(400, "Content-Type debe ser multipart/form-data")
                    return
                    
                content_length = int(self.headers.get('Content-Length', 0))
                boundary = None
                for part in content_type.split(';'):
                    part = part.strip()
                    if part.startswith('boundary='):
                        boundary = part.split('boundary=')[1].encode('utf-8')
                        
                if not boundary:
                    self.send_error_response(400, "No se encontró boundary en la petición")
                    return
                    
                body = self.rfile.read(content_length)
                parts = body.split(b'--' + boundary)
                file_data = None
                
                for part in parts:
                    if b'filename=' in part:
                        headers, content = part.split(b'\r\n\r\n', 1)
                        if content.endswith(b'\r\n'):
                            content = content[:-2]
                        if content.endswith(b'--\r\n'):
                            content = content[:-4]
                        file_data = content
                        break
                        
                if file_data:
                    excel_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Resumen_InterAnual_2026.XLS")
                    with open(excel_path, 'wb') as f:
                        f.write(file_data)
                        
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                else:
                    self.send_error_response(400, "No se encontró el archivo en la petición")
            except Exception as e:
                self.send_error_response(500, f"Error interno: {str(e)}")
        else:
            self.send_error_response(404, "Not Found")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))

def run(server_class=http.server.HTTPServer, handler_class=DAOHandler, port=PORT):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Servidor iniciado en http://localhost:{port}/")
    print("Para salir presione Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor apagado.")
        httpd.server_close()

if __name__ == '__main__':
    run()
