import os
import sys

# Asegurar codificación utf-8 para la consola de Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import struct
import argparse
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox

import numpy as np
import matplotlib
matplotlib.use('Agg')  # Modo sin ventana para renderizado rápido en segundo plano
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection


def parse_stl(filepath: str, max_triangles_thumb: int = 15000):
    """
    Lee un archivo STL (binario o ASCII) y devuelve:
    - triangles: array numpy de forma (N, 3, 3)
    - total_triangles: cantidad total de triángulos reales
    """
    file_size = os.path.getsize(filepath)
    if file_size < 84:
        return None, 0

    # Intento 1: Comprobar si es binario estándar
    with open(filepath, 'rb') as f:
        header = f.read(80)
        count_bytes = f.read(4)
        if len(count_bytes) == 4:
            num_triangles = struct.unpack('<I', count_bytes)[0]
            expected_size = 84 + num_triangles * 50
            if file_size == expected_size:
                # Archivo STL Binario
                stl_dtype = np.dtype([
                    ('normal', np.float32, (3,)),
                    ('v0', np.float32, (3,)),
                    ('v1', np.float32, (3,)),
                    ('v2', np.float32, (3,)),
                    ('attr', np.uint16)
                ])
                data = np.fromfile(f, dtype=stl_dtype)
                total = len(data)
                if total == 0:
                    return None, 0
                
                # Para la miniatura no necesitamos millones de polígonos:
                # Submuestreamos uniformemente si supera el límite
                if total > max_triangles_thumb:
                    step = int(np.ceil(total / max_triangles_thumb))
                    data = data[::step]

                triangles = np.stack([data['v0'], data['v1'], data['v2']], axis=1)
                return triangles, total

    # Intento 2: Si no coincidió el tamaño exacto, intentar ASCII
    try:
        triangles = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            current_tri = []
            for line in f:
                line_str = line.strip().lower()
                if line_str.startswith('vertex'):
                    parts = line_str.split()
                    if len(parts) >= 4:
                        current_tri.append([float(parts[1]), float(parts[2]), float(parts[3])])
                        if len(current_tri) == 3:
                            triangles.append(current_tri)
                            current_tri = []
        if triangles:
            arr = np.array(triangles, dtype=np.float32)
            total = len(arr)
            if total > max_triangles_thumb:
                step = int(np.ceil(total / max_triangles_thumb))
                arr = arr[::step]
            return arr, total
    except Exception:
        pass

    return None, 0


def render_thumbnail(triangles, output_path: str, size_px: int = 512):
    """
    Renderiza una miniatura 3D sombreada del modelo y la guarda como PNG.
    """
    dpi = 100
    figsize = (size_px / dpi, size_px / dpi)
    fig = plt.figure(figsize=figsize, dpi=dpi, facecolor='#1e1e24')
    ax = fig.add_subplot(111, projection='3d')
    ax.set_facecolor('#1e1e24')
    ax.set_axis_off()
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)

    # Color estilo filamento 3D / sombreado suave
    mesh_color = '#38bdf8'     # Azul cian moderno
    edge_color = '#0284c7'     # Bordes sutiles

    poly = Poly3DCollection(
        triangles,
        facecolors=mesh_color,
        edgecolors=edge_color,
        linewidths=0.2,
        alpha=1.0,
        shade=True
    )
    ax.add_collection3d(poly)

    # Centrado y escala proporcional
    pts = triangles.reshape(-1, 3)
    min_b = pts.min(axis=0)
    max_b = pts.max(axis=0)
    center = (min_b + max_b) / 2
    max_range = float((max_b - min_b).max()) / 2

    if max_range <= 0:
        max_range = 1.0

    margin = 1.15
    ax.set_xlim(center[0] - max_range * margin, center[0] + max_range * margin)
    ax.set_ylim(center[1] - max_range * margin, center[1] + max_range * margin)
    ax.set_zlim(center[2] - max_range * margin, center[2] + max_range * margin)

    # Ángulo isométrico atractivo
    ax.view_init(elev=28, azim=45)

    plt.savefig(
        output_path,
        dpi=dpi,
        facecolor=fig.get_facecolor(),
        transparent=False,
        bbox_inches='tight',
        pad_inches=0.02
    )
    plt.close(fig)


def format_size(bytes_size):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.1f} TB"


def generate_html_gallery(items, output_html_path):
    """
    Crea una galería web visual moderna para explorar todas las miniaturas generadas.
    """
    cards_html = []
    for it in items:
        # Ruta relativa de la imagen para que funcione sin problemas en el navegador
        rel_img = os.path.relpath(it['thumb_path'], os.path.dirname(output_html_path)).replace('\\', '/')
        cards_html.append(f"""
        <div class="card">
            <div class="thumb-container">
                <img src="{rel_img}" alt="{it['name']}" loading="lazy">
            </div>
            <div class="info">
                <div class="title" title="{it['name']}">{it['name']}</div>
                <div class="meta">
                    <span>📦 {it['size']}</span>
                    <span>🔺 {it['triangles']:,} caras</span>
                </div>
            </div>
        </div>
        """)

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Galería de Modelos STL</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background: #0f172a;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 2rem;
        }}
        header {{
            max-width: 1400px;
            margin: 0 auto 2rem auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #334155;
            padding-bottom: 1rem;
        }}
        h1 {{ font-size: 1.6rem; color: #38bdf8; }}
        .badge {{
            background: #1e293b;
            color: #94a3b8;
            padding: 0.35rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.9rem;
            border: 1px solid #334155;
        }}
        .grid {{
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 1.5rem;
        }}
        .card {{
            background: #1e293b;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #334155;
            transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }}
        .card:hover {{
            transform: translateY(-4px);
            border-color: #38bdf8;
            box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.5);
        }}
        .thumb-container {{
            width: 100%;
            aspect-ratio: 1;
            background: #18181b;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .thumb-container img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }}
        .info {{
            padding: 0.9rem 1rem;
        }}
        .title {{
            font-size: 0.95rem;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #f1f5f9;
            margin-bottom: 0.5rem;
        }}
        .meta {{
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
            color: #94a3b8;
        }}
    </style>
</head>
<body>
    <header>
        <h1>🧊 Vista Previa de Archivos STL</h1>
        <div class="badge">{len(items)} modelos renderizados</div>
    </header>
    <div class="grid">
        {''.join(cards_html)}
    </div>
</body>
</html>
"""
    with open(output_html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def process_folder(target_dir: str, subfolder_mode: bool = True, create_html: bool = True):
    target_path = Path(target_dir).resolve()
    if not target_path.exists():
        print(f"Error: La carpeta {target_path} no existe.")
        return

    # Buscar todos los archivos .stl sin duplicados por mayúsculas/minúsculas
    stl_files = sorted([p for p in target_path.iterdir() if p.is_file() and p.suffix.lower() == '.stl'])
    if not stl_files:
        print(f"No se encontraron archivos .stl en: {target_path}")
        return

    print(f"\n==========================================")
    print(f"Directorio: {target_path}")
    print(f"Se encontraron {len(stl_files)} archivos STL.")
    print(f"==========================================\n")

    # Carpeta donde guardar las miniaturas
    if subfolder_mode:
        thumbs_dir = target_path / "_miniaturas_stl"
        thumbs_dir.mkdir(exist_ok=True)
    else:
        thumbs_dir = target_path

    gallery_items = []

    for idx, stl_file in enumerate(stl_files, start=1):
        thumb_name = f"{stl_file.stem}_thumb.png" if not subfolder_mode else f"{stl_file.stem}.png"
        thumb_path = thumbs_dir / thumb_name

        print(f"[{idx}/{len(stl_files)}] Procesando: {stl_file.name}...", end=" ", flush=True)

        try:
            triangles, total_count = parse_stl(str(stl_file))
            if triangles is None or len(triangles) == 0:
                print("⚠️ No se pudo leer la geometría")
                continue

            render_thumbnail(triangles, str(thumb_path))
            print(f"✓ Minatura guardada ({total_count:,} caras)")

            gallery_items.append({
                'name': stl_file.name,
                'thumb_path': str(thumb_path),
                'size': format_size(stl_file.stat().st_size),
                'triangles': total_count
            })
        except Exception as e:
            print(f"❌ Error: {e}")

    # Generar galería HTML opcional
    if create_html and gallery_items:
        html_file = target_path / "galeria_miniaturas.html"
        generate_html_gallery(gallery_items, str(html_file))
        print(f"\n✨ ¡Listo! Se ha creado una galería interactiva en:")
        print(f"   {html_file}")
        print(f"   (Puedes abrir este archivo HTML con doble clic en tu navegador para ver todos tus modelos)")

    print(f"\nMiniaturas generadas en: {thumbs_dir}\n")


def main():
    parser = argparse.ArgumentParser(description="Generador de miniaturas visuales para archivos STL")
    parser.add_argument("directorio", nargs="?", default=None, help="Carpeta que contiene los archivos STL")
    parser.add_argument("--mismo-directorio", action="store_true", help="Guardar los PNG junto a cada STL en lugar de una subcarpeta")
    parser.add_argument("--no-html", action="store_true", help="No generar el archivo galeria_miniaturas.html")
    args = parser.parse_args()

    dir_path = args.directorio

    # Si no se pasó argumento por consola, abrir selector visual de carpetas
    if not dir_path:
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        print("Selecciona la carpeta donde tienes tus archivos STL en la ventana que ha aparecido...")
        dir_path = filedialog.askdirectory(title="Selecciona la carpeta con tus archivos STL")
        root.destroy()

    if not dir_path:
        print("Operación cancelada. No se seleccionó ninguna carpeta.")
        return

    process_folder(
        target_dir=dir_path,
        subfolder_mode=not args.mismo_directorio,
        create_html=not args.no_html
    )


if __name__ == "__main__":
    main()
