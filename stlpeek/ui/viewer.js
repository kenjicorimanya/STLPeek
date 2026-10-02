// Estado global
let scene, camera, renderer, controls;
let currentMesh = null;
let gridHelper = null;
let currentStlPath = null;
let currentStlName = null;
let isAutoRotating = false;
let isWireframe = false;
let showGrid = true;
let fileList = [];
let currentColor = '#38bdf8';

// Inicialización de Three.js
function initThree() {
    const container = document.getElementById('viewport-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e131f);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(150, -150, 120);
    camera.up.set(0, 0, 1); // Eje Z hacia arriba (estándar impresión 3D)

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('webgl-canvas'),
        antialias: true,
        preserveDrawingBuffer: true // Requerido para capturar miniaturas limpias
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;

    // Iluminación estilo estudio 3D
    setupLighting();

    // Rejilla de cama de impresión
    setupGrid();

    // Eventos de ventana
    window.addEventListener('resize', onWindowResize);

    // Bucle de animación
    animate();
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(200, -250, 300);
    keyLight.castShadow = true;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.05;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    fillLight.position.set(-200, 200, 150);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffedd5, 0.3);
    backLight.position.set(0, 300, -50);
    scene.add(backLight);
}

function setupGrid(size = 300) {
    if (gridHelper) scene.remove(gridHelper);

    gridHelper = new THREE.GridHelper(size, 30, 0x38bdf8, 0x1e293b);
    gridHelper.rotation.x = Math.PI / 2; // Alinear con plano XY
    gridHelper.position.z = 0;
    scene.add(gridHelper);
}

function onWindowResize() {
    const container = document.getElementById('viewport-container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    if (isAutoRotating && currentMesh) {
        currentMesh.rotation.z += 0.008;
    }
    controls.update();
    renderer.render(scene, camera);
}

// Carga de archivo STL en Three.js desde buffer
function loadStlGeometry(arrayBuffer, filename, filepath) {
    showLoader(true);
    setTimeout(() => {
        try {
            const loader = new THREE.STLLoader();
            const geometry = loader.parse(arrayBuffer);
            geometry.computeVertexNormals();

            // Quitar modelo anterior si existe
            if (currentMesh) {
                scene.remove(currentMesh);
                currentMesh.geometry.dispose();
                if (currentMesh.material) currentMesh.material.dispose();
            }

            // Centrar modelo en X, Y y colocar base en Z = 0
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            const center = new THREE.Vector3();
            box.getCenter(center);
            geometry.translate(-center.x, -center.y, -box.min.z);

            // Dimensiones
            geometry.computeBoundingBox();
            const newBox = geometry.boundingBox;
            const size = new THREE.Vector3();
            newBox.getSize(size);

            // Ajustar tamaño de la cuadrícula si el modelo es grande
            const maxDim = Math.max(size.x, size.y, size.z, 100);
            setupGrid(Math.max(200, Math.ceil(maxDim * 1.5 / 50) * 50));

            // Material
            const material = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(currentColor),
                metalness: 0.15,
                roughness: 0.45,
                clearcoat: 0.25,
                wireframe: isWireframe,
                side: THREE.DoubleSide
            });

            currentMesh = new THREE.Mesh(geometry, material);
            currentMesh.castShadow = true;
            currentMesh.receiveShadow = true;
            scene.add(currentMesh);

            currentStlPath = filepath;
            currentStlName = filename;

            // Enfocar cámara
            fitCameraToObject(currentMesh);

            // Actualizar HUD
            updateHud(size, geometry);

            // Actualizar interfaz
            document.getElementById('hud-card').style.display = 'block';
            document.getElementById('floating-toolbar').style.display = 'flex';
            document.getElementById('empty-state').style.display = 'none';

            showToast(`Modelo cargado: ${filename}`);
        } catch (err) {
            console.error(err);
            alert(`Error al procesar el archivo STL: ${err.message}`);
        } finally {
            showLoader(false);
        }
    }, 30);
}

// Ajuste suave de cámara para encuadrar la pieza
function fitCameraToObject(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2.0; // Margen visual

    const dist = Math.max(cameraZ, 80);
    camera.position.set(dist * 0.7, -dist * 0.8, dist * 0.7);
    camera.lookAt(0, 0, size.z / 2);
    controls.target.set(0, 0, size.z / 2);
    controls.update();
}

// Cálculo del volumen de la malla cerrada (Divergence Theorem)
function computeVolume(geometry) {
    const pos = geometry.attributes.position;
    let volume = 0;
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();

    for (let i = 0; i < pos.count; i += 3) {
        p1.fromBufferAttribute(pos, i);
        p2.fromBufferAttribute(pos, i + 1);
        p3.fromBufferAttribute(pos, i + 2);
        volume += p1.dot(p2.cross(p3)) / 6.0;
    }
    return Math.abs(volume) / 1000.0; // Convertir de mm3 a cm3
}

// Actualizar HUD con métricas del modelo
function updateHud(size, geometry) {
    document.getElementById('hud-filename').textContent = currentStlName || 'Modelo STL';
    document.getElementById('hud-dims').textContent = `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`;

    const triangles = geometry.attributes.position.count / 3;
    document.getElementById('hud-triangles').textContent = Math.round(triangles).toLocaleString();

    const volCm3 = computeVolume(geometry);
    document.getElementById('hud-volume').textContent = `${volCm3.toFixed(2)} cm³`;

    // Peso estimado PLA (densidad ~1.24 g/cm3, ~20% infill efectivo ~0.4)
    const weightG = volCm3 * 1.24 * 0.45;
    document.getElementById('hud-weight').textContent = `~${weightG.toFixed(1)} g`;
}

// Vistas de cámara rápidas
function setCameraView(viewType) {
    if (!currentMesh) return;
    const box = new THREE.Box3().setFromObject(currentMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = Math.max(maxDim * 2.2, 100);
    const centerZ = size.z / 2;

    switch (viewType) {
        case 'iso':
            camera.position.set(dist * 0.7, -dist * 0.8, dist * 0.7);
            camera.up.set(0, 0, 1);
            break;
        case 'top':
            camera.position.set(0, 0, dist * 1.5);
            camera.up.set(0, 1, 0);
            break;
        case 'front':
            camera.position.set(0, -dist * 1.5, centerZ);
            camera.up.set(0, 0, 1);
            break;
        case 'side':
            camera.position.set(dist * 1.5, 0, centerZ);
            camera.up.set(0, 0, 1);
            break;
    }
    controls.target.set(0, 0, centerZ);
    controls.update();
}

// Capturar miniatura actual y guardarla
async function captureAndSaveThumbnail() {
    if (!currentMesh || !currentStlPath) {
        showToast('No hay ningún modelo cargado');
        return;
    }
    // Guardar posición actual
    const origCamPos = camera.position.clone();
    const origCamUp = camera.up.clone();
    const origTarget = controls.target.clone();

    // Renderizar vista isométrica limpia para miniatura
    setCameraView('iso');
    if (gridHelper) gridHelper.visible = false;
    renderer.render(scene, camera);

    const dataUrl = renderer.domElement.toDataURL('image/png', 0.95);

    // Restaurar estado
    if (gridHelper && showGrid) gridHelper.visible = true;
    camera.position.copy(origCamPos);
    camera.up.copy(origCamUp);
    controls.target.copy(origTarget);
    controls.update();

    if (window.pywebview) {
        const res = await window.pywebview.api.save_thumbnail(currentStlPath, dataUrl);
        if (res && res.success) {
            showToast('✓ Miniatura guardada en _miniaturas_stl');
            updateCardThumb(currentStlPath, dataUrl);
        } else {
            showToast('Error al guardar miniatura');
        }
    }
}

// Exportar render en alta resolución
async function exportHdCapture() {
    if (!currentMesh) return;
    const dataUrl = renderer.domElement.toDataURL('image/png', 1.0);
    if (window.pywebview) {
        const res = await window.pywebview.api.export_hd_render(currentStlName || 'modelo', dataUrl);
        if (res && res.success) {
            showToast('✓ Captura guardada');
        }
    }
}

// Cargar archivo individual llamando a la API Python
async function loadStlFromPath(filePath, fileName) {
    if (!window.pywebview) return;
    showLoader(true);
    const res = await window.pywebview.api.read_stl_base64(filePath);
    if (res.error) {
        showLoader(false);
        alert(`Error al leer archivo: ${res.error}`);
        return;
    }
    // Decodificar Base64 a ArrayBuffer
    const binaryString = atob(res.base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    loadStlGeometry(bytes.buffer, fileName || res.name, filePath);
    highlightActiveCard(filePath);
}

// Batch: Generar miniaturas de todos los STL de la carpeta
async function generateAllThumbnails() {
    if (!fileList || fileList.length === 0) {
        showToast('Primero abre una carpeta con archivos STL');
        return;
    }

    const btn = document.getElementById('btn-batch-thumbs');
    btn.disabled = true;
    btn.textContent = 'Generando...';

    for (let i = 0; i < fileList.length; i++) {
        const item = fileList[i];
        btn.textContent = `Generando (${i + 1}/${fileList.length})...`;
        try {
            const res = await window.pywebview.api.read_stl_base64(item.path);
            if (!res.error) {
                const bin = atob(res.base64);
                const bytes = new Uint8Array(bin.length);
                for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);

                // Cargar silenciosamente
                const loader = new THREE.STLLoader();
                const geom = loader.parse(bytes.buffer);
                geom.computeVertexNormals();
                geom.computeBoundingBox();
                const box = geom.boundingBox;
                const center = new THREE.Vector3();
                box.getCenter(center);
                geom.translate(-center.x, -center.y, -box.min.z);

                const mat = new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color(currentColor),
                    metalness: 0.15,
                    roughness: 0.45
                });
                const tempMesh = new THREE.Mesh(geom, mat);

                // Quitar temporalmente
                if (currentMesh) scene.remove(currentMesh);
                scene.add(tempMesh);
                if (gridHelper) gridHelper.visible = false;

                fitCameraToObject(tempMesh);
                setCameraView('iso');
                renderer.render(scene, camera);

                const dataUrl = renderer.domElement.toDataURL('image/png', 0.9);
                await window.pywebview.api.save_thumbnail(item.path, dataUrl);
                updateCardThumb(item.path, dataUrl);

                scene.remove(tempMesh);
                geom.dispose();
                mat.dispose();
            }
        } catch (e) {
            console.error('Error generando miniatura:', e);
        }
    }

    // Restaurar vista
    if (gridHelper && showGrid) gridHelper.visible = true;
    if (currentMesh) {
        scene.add(currentMesh);
        fitCameraToObject(currentMesh);
    }

    btn.disabled = false;
    btn.textContent = '⚡ Generar todas las miniaturas';
    showToast('✓ Todas las miniaturas generadas con éxito');
}

// Función hash segura para generar IDs sin fallar con caracteres Unicode/acentos
function safeKey(str) {
    if (!str) return 'k0';
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return 'k' + Math.abs(hash);
}

// Renderizado de la lista lateral de archivos
function renderFileList(files) {
    fileList = files;
    const container = document.getElementById('file-list');
    container.innerHTML = '';

    const badge = document.getElementById('file-count-badge');
    if (badge) badge.textContent = `${files.length} STL`;

    if (files.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem; font-size: 0.85rem;">No se encontraron archivos .stl en esta carpeta</div>`;
        return;
    }

    files.forEach(f => {
        try {
            const cardKey = safeKey(f.path);
            const card = document.createElement('div');
            card.className = 'file-card';
            card.id = `card-${cardKey}`;
            card.onclick = () => loadStlFromPath(f.path, f.name);

            card.innerHTML = `
                <div class="file-thumb" id="thumb-${cardKey}">
                    <span class="thumb-placeholder">🧊</span>
                </div>
                <div class="file-info">
                    <div class="file-name" title="${f.name}">${f.name}</div>
                    <div class="file-meta">
                        <span>${f.size_formatted}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        } catch (err) {
            console.error('Error renderizando tarjeta para:', f.name, err);
        }
    });
}

function updateCardThumb(filePath, dataUrl) {
    const el = document.getElementById(`thumb-${safeKey(filePath)}`);
    if (el) {
        el.innerHTML = `<img src="${dataUrl}" alt="thumb">`;
    }
}

function highlightActiveCard(filePath) {
    document.querySelectorAll('.file-card').forEach(c => c.classList.remove('active'));
    const active = document.getElementById(`card-${safeKey(filePath)}`);
    if (active) {
        active.classList.add('active');
        active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function filterFileList(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.file-card').forEach(card => {
        const name = card.querySelector('.file-name').textContent.toLowerCase();
        card.style.display = name.includes(q) ? 'flex' : 'none';
    });
}

// UI Helpers
function showLoader(visible) {
    const loader = document.getElementById('loader-overlay');
    if (visible) loader.classList.add('active');
    else loader.classList.remove('active');
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2600);
}

// Event Listeners y arranque
window.addEventListener('DOMContentLoaded', () => {
    initThree();

    // Botones de cabecera
    document.getElementById('btn-open-folder').onclick = async () => {
        if (!window.pywebview) return;
        const data = await window.pywebview.api.select_folder();
        if (data && data.files) {
            renderFileList(data.files);
            if (data.files.length > 0) {
                loadStlFromPath(data.files[0].path, data.files[0].name);
            }
        }
    };

    document.getElementById('btn-open-file').onclick = async () => {
        if (!window.pywebview) return;
        const file = await window.pywebview.api.select_single_file();
        if (file) {
            renderFileList([file]);
            loadStlFromPath(file.path, file.name);
        }
    };

    document.getElementById('btn-batch-thumbs').onclick = generateAllThumbnails;

    document.getElementById('search-input').oninput = (e) => {
        filterFileList(e.target.value);
    };

    // Barra de herramientas flotante
    document.getElementById('btn-auto-rotate').onclick = function() {
        isAutoRotating = !isAutoRotating;
        this.classList.toggle('active', isAutoRotating);
    };

    document.getElementById('btn-wireframe').onclick = function() {
        isWireframe = !isWireframe;
        this.classList.toggle('active', isWireframe);
        if (currentMesh && currentMesh.material) {
            currentMesh.material.wireframe = isWireframe;
        }
    };

    document.getElementById('btn-grid').onclick = function() {
        showGrid = !showGrid;
        this.classList.toggle('active', showGrid);
        if (gridHelper) gridHelper.visible = showGrid;
    };

    document.getElementById('btn-capture-thumb').onclick = captureAndSaveThumbnail;
    document.getElementById('btn-export-hd').onclick = exportHdCapture;

    // Selector de colores
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.onclick = function() {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            currentColor = this.getAttribute('data-color');
            if (currentMesh && currentMesh.material) {
                currentMesh.material.color.set(currentColor);
            }
        };
    });

    // Menú de vistas de cámara
    document.getElementById('btn-view-iso').onclick = () => setCameraView('iso');
    document.getElementById('btn-view-top').onclick = () => setCameraView('top');
    document.getElementById('btn-view-front').onclick = () => setCameraView('front');
    document.getElementById('btn-view-side').onclick = () => setCameraView('side');

    // Drag & Drop
    const dropzone = document.getElementById('viewport-container');
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.getElementById('dropzone-overlay').classList.add('visible');
    });
    window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) {
            document.getElementById('dropzone-overlay').classList.remove('visible');
        }
    });
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        document.getElementById('dropzone-overlay').classList.remove('visible');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.toLowerCase().endsWith('.stl')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    loadStlGeometry(event.target.result, file.name, file.path || file.name);
                };
                reader.readAsArrayBuffer(file);
            } else {
                showToast('Por favor, arrastra un archivo con extensión .stl');
            }
        }
    });

    // Iniciar chequeo de datos iniciales tras DOM ready
    checkAndLoadInitialData();
});

// Lógica de arranque robusta para pywebview
let initialDataLoaded = false;

async function checkAndLoadInitialData() {
    if (initialDataLoaded) return;
    if (!window.pywebview || !window.pywebview.api) {
        return;
    }
    initialDataLoaded = true;
    try {
        console.log('Consultando archivo o carpeta inicial...');
        const initial = await window.pywebview.api.get_initial_data();
        console.log('Datos iniciales recibidos:', initial);
        if (initial) {
            if (initial.type === 'file') {
                const folderRes = await window.pywebview.api.scan_folder(initial.folder_path);
                if (folderRes && folderRes.files) {
                    renderFileList(folderRes.files);
                }
                const filename = initial.file_path.replace(/\\/g, '/').split('/').pop();
                await loadStlFromPath(initial.file_path, filename);
            } else if (initial.type === 'folder') {
                const folderRes = await window.pywebview.api.scan_folder(initial.folder_path);
                if (folderRes && folderRes.files) {
                    renderFileList(folderRes.files);
                    if (folderRes.files.length > 0) {
                        await loadStlFromPath(folderRes.files[0].path, folderRes.files[0].name);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error al procesar datos iniciales:', e);
    }
}

// 1. Escuchar pywebviewready si aún no ha ocurrido
window.addEventListener('pywebviewready', checkAndLoadInitialData);

// 2. Comprobar periódicamente cada 50ms por si pywebview ya estaba inyectado antes
let pollCount = 0;
const pollTimer = setInterval(() => {
    pollCount++;
    if (initialDataLoaded || pollCount > 100) {
        clearInterval(pollTimer);
    } else if (window.pywebview && window.pywebview.api) {
        checkAndLoadInitialData();
        clearInterval(pollTimer);
    }
}, 50);

