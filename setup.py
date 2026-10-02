from setuptools import setup, find_packages

setup(
    name="stlpeek",
    version="1.0.0",
    author="Kenji Corimanya",
    description="Visor 3D interactivo y generador de miniaturas para archivos STL (Windows, Linux, macOS)",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/kenjicorimanya/STLPeek",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "stlpeek": ["libs/*", "ui/*"],
    },
    install_requires=[
        "pywebview>=5.0.0",
        "numpy>=1.20.0",
        "matplotlib>=3.5.0",
        "Pillow>=9.0.0",
    ],
    entry_points={
        "console_scripts": [
            "stlpeek=stlpeek.app:start_app",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Multimedia :: Graphics :: 3D Modeling",
    ],
    python_requires=">=3.8",
)
