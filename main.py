import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(BASE_DIR))

from stlpeek.app import start_app

if __name__ == '__main__':
    target = None
    if len(sys.argv) > 1:
        # Unir argumentos en caso de que Windows pase rutas con espacios sin comillas completas
        target = ' '.join(sys.argv[1:]).strip('\"\'')
    start_app(target)
