# 🧊 STLPeek

<p align="center">
  <strong>Visor 3D interactivo ligero y generador de miniaturas para archivos STL.</strong><br>
  <em>Inspirado en la ligereza de stl-thumb pero con visor orbital 3D en tiempo real, cálculo de dimensiones y exportación de imágenes.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Plataformas-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=flat-square" alt="Platforms">
  <img src="https://img.shields.io/badge/Python-3.8+-brightgreen?style=flat-square" alt="Python Version">
  <img src="https://img.shields.io/badge/Licencia-MIT-orange?style=flat-square" alt="License">
</p>

---

## 🌟 Características Principales

- 🚀 **Visor 3D Interactivo a 60 FPS:** Visualización en tiempo real acelerada por hardware con WebGL/Three.js.
- 📐 **Métricas Técnicas en Vivo:** Dimensiones exactas ($X \times Y \times Z$ mm), conteo de triángulos/caras, volumen en $\text{cm}^3$ y peso estimado en gramos para filamento PLA.
- 🎨 **Paleta de Colores de Filamento:** Previsualiza tus piezas en Azul Glaciar, Naranja Prusa, Oro Seda, Blanco, Gris Técnico y Negro Mate.
- 📸 **Generador de Miniaturas (Batch):** Genera miniaturas PNG en ángulo isométrico para toda una carpeta con un solo clic (estilo *stl-thumb*).
- 💾 **Exportación de Capturas HD:** Guarda renders en alta resolución de tus piezas en cualquier ángulo o posición.
- 🖱️ **Soporte Drag & Drop:** Arrastra cualquier archivo `.stl` directamente desde tu explorador de archivos hacia la ventana.
- 📴 **100% Offline:** Todas las librerías 3D están empaquetadas localmente, sin necesidad de conexión a internet.

---

## 🖥️ Descargas Multiplataforma

Puedes descargar la versión ejecutable nativa para tu sistema operativo desde la sección de [**Releases**](https://github.com/kenjicorimanya/STLPeek/releases):

| Sistema Operativo | Paquete | Descripción |
| :--- | :--- | :--- |
| **Windows** | `STLPeek-Windows.zip` | Descomprimir y ejecutar `STLPeek.exe` |
| **Linux** | `STLPeek-Linux.tar.gz` | Binario ejecutable para Ubuntu/Debian/Fedora/Arch |
| **macOS** | `STLPeek-macOS.zip` | Aplicación nativa para Mac (Intel y Apple Silicon) |

---

## 🛠️ Instalación desde Código Fuente (Cualquier SO)

Si prefieres ejecutarlo o desarrollarlo con Python:

```bash
# 1. Clonar el repositorio
git clone https://github.com/kenjicorimanya/STLPeek.git
cd STLPeek

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Iniciar la aplicación
python main.py
```

O instalarlo como comando de sistema:
```bash
pip install -e .
stlpeek
```

---

## 🎮 Controles del Visor 3D

| Acción | Control |
| :--- | :--- |
| **Rotar pieza** | Clic izquierdo y arrastrar |
| **Zoom** | Rueda del ratón |
| **Desplazar (Pan)** | Clic derecho y arrastrar |
| **Centrar cámara** | Botones de vistas rápidas (Isométrica, Superior, Frontal, Lateral) |
| **Modo alambre** | Botón `🕸️` en la barra superior |
| **Rejilla / Cama** | Botón `📏` en la barra superior |
| **Auto-rotación** | Botón `🔄` para giro de exhibición |

---

## 📜 Licencia

Distribuido bajo la licencia **MIT**. Puedes usarlo, modificarlo y compartirlo libremente.
