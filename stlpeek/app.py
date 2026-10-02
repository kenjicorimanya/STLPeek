import os
import sys
import base64
import json
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import filedialog
import webview

# Asegurar codificación utf-8
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


class StlApi:
    def __init__(self, initial_target=None):
        self.initial_target = initial_target
        self.current_folder = None
        self._window = None

    def set_window(self, window):
        self._window = window

    def get_initial_data(self):
        """Devuelve el archivo o carpeta inicial si se pasó por línea de comandos."""
        if not self.initial_target:
            return None
        clean_target = str(self.initial_target).strip('\"\'')
        target = Path(clean_target).resolve()
        if target.exists():
            if target.is_file() and target.suffix.lower() == '.stl':
                return {
                    'type': 'file',
                    'file_path': str(target),
                    'folder_path': str(target.parent)
                }
            elif target.is_dir():
                return {
                    'type': 'folder',
                    'folder_path': str(target)
                }
        return None

    def select_folder(self):
        """Abre un diálogo nativo para seleccionar carpeta y lista todos los STL."""
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder = filedialog.askdirectory(title="Seleccionar carpeta con archivos STL")
        root.destroy()

        if not folder:
            return None
        return self.scan_folder(folder)

    def scan_folder(self, folder_path):
        """Escanea una carpeta buscando archivos STL."""
        target = Path(folder_path).resolve()
        if not target.exists() or not target.is_dir():
            return {'error': 'La carpeta no existe'}

        self.current_folder = str(target)
        files = []
        for p in target.iterdir():
            if p.is_file() and p.suffix.lower() == '.stl':
                files.append({
                    'name': p.name,
                    'path': str(p),
                    'size_bytes': p.stat().st_size,
                    'size_formatted': self._format_size(p.stat().st_size),
                    'modified': p.stat().st_mtime
                })
        
        # Ordenar alfabéticamente
        files.sort(key=lambda x: x['name'].lower())

        return {
            'folder_path': str(target),
            'folder_name': target.name,
            'files': files
        }

    def select_single_file(self):
        """Abre diálogo para seleccionar un único archivo STL."""
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        filepath = filedialog.askopenfilename(
            title="Seleccionar archivo STL",
            filetypes=[("Archivos STL", "*.stl;*.STL"), ("Todos los archivos", "*.*")]
        )
        root.destroy()

        if not filepath:
            return None

        p = Path(filepath)
        return {
            'name': p.name,
            'path': str(p),
            'size_bytes': p.stat().st_size,
            'size_formatted': self._format_size(p.stat().st_size),
            'parent_folder': str(p.parent)
        }

    def read_stl_base64(self, file_path):
        """Lee el contenido binario del archivo STL y lo devuelve codificado en base64."""
        p = Path(file_path)
        if not p.exists() or not p.is_file():
            return {'error': 'El archivo no existe'}
        try:
            with open(p, 'rb') as f:
                data = f.read()
            b64_str = base64.b64encode(data).decode('ascii')
            return {
                'name': p.name,
                'path': str(p),
                'size': len(data),
                'base64': b64_str
            }
        except Exception as e:
            return {'error': str(e)}

    def save_thumbnail(self, stl_path, data_url):
        """Guarda la imagen miniatura PNG en la subcarpeta _miniaturas_stl o junto al archivo."""
        try:
            p = Path(stl_path)
            thumb_dir = p.parent / "_miniaturas_stl"
            thumb_dir.mkdir(exist_ok=True)
            thumb_path = thumb_dir / f"{p.stem}.png"

            # Remover prefijo data:image/png;base64,
            if ',' in data_url:
                header, b64_data = data_url.split(',', 1)
            else:
                b64_data = data_url

            img_bytes = base64.b64decode(b64_data)
            with open(thumb_path, 'wb') as f:
                f.write(img_bytes)

            return {'success': True, 'saved_path': str(thumb_path)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def export_hd_render(self, default_name, data_url):
        """Abre diálogo para guardar una captura HD personalizada."""
        try:
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            save_path = filedialog.asksaveasfilename(
                title="Guardar captura del modelo 3D",
                defaultextension=".png",
                initialfile=f"{Path(default_name).stem}_render.png",
                filetypes=[("Imagen PNG", "*.png"), ("Todos los archivos", "*.*")]
            )
            root.destroy()

            if not save_path:
                return {'cancelled': True}

            if ',' in data_url:
                header, b64_data = data_url.split(',', 1)
            else:
                b64_data = data_url

            img_bytes = base64.b64decode(b64_data)
            with open(save_path, 'wb') as f:
                f.write(img_bytes)

            return {'success': True, 'path': save_path}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def open_in_file_explorer(self, file_path):
        """Abre el explorador de Windows seleccionando el archivo."""
        try:
            p = Path(file_path).resolve()
            if p.exists():
                subprocess.Popen(f'explorer /select,"{p}"')
                return {'success': True}
        except Exception as e:
            return {'error': str(e)}
        return {'error': 'No se pudo abrir'}

    def _format_size(self, bytes_size):
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_size < 1024:
                return f"{bytes_size:.1f} {unit}"
            bytes_size /= 1024
        return f"{bytes_size:.1f} TB"


def get_base_dir():
    if getattr(sys, 'frozen', False):
        if hasattr(sys, '_MEIPASS'):
            candidate = Path(sys._MEIPASS) / "stlpeek"
            if (candidate / "ui" / "index.html").exists():
                return candidate
        exe_dir = Path(sys.executable).parent
        candidate = exe_dir / "_internal" / "stlpeek"
        if (candidate / "ui" / "index.html").exists():
            return candidate
        candidate = exe_dir / "stlpeek"
        if (candidate / "ui" / "index.html").exists():
            return candidate
    return Path(__file__).parent.resolve()


def start_app(target=None):
    api = StlApi(initial_target=target)
    base_dir = get_base_dir()
    ui_html = base_dir / "ui" / "index.html"

    window = webview.create_window(
        title="STLPeek - 3D Viewer",
        url=str(ui_html),
        js_api=api,
        width=1240,
        height=820,
        min_size=(900, 600),
        background_color='#0f172a'
    )
    api.set_window(window)
    webview.start(debug=False)


if __name__ == '__main__':
    arg_target = sys.argv[1] if len(sys.argv) > 1 else None
    start_app(arg_target)

