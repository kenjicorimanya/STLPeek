import sys
from pathlib import Path

# Agregar directorio actual al sys.path
BASE_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(BASE_DIR))

from stlpeek.app import start_app

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else None
    start_app(target)
