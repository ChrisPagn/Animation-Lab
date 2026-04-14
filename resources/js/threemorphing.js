import * as THREE from 'three';

export function init() {

    const canvas = document.getElementById("morphingCanvas");

    if (!canvas) {
        console.error("Canvas morphingCanvas introuvable");
    } else {
        const W = canvas.width;
        const H = canvas.height;

        // ─────────────────────────────────────────
        // 1. SETUP
        // ─────────────────────────────────────────
        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;

        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);

        scene.fog = new THREE.FogExp2(0x0a0a1a, 0.05);

        // ─────────────────────────────────────────
        // 2. LUMIÈRES
        // ─────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0x222244, 3));

        const light1 = new THREE.PointLight(0x7f77dd, 5, 50);
        light1.position.set(-4, 4, 4);
        scene.add(light1);

        const light2 = new THREE.PointLight(0x00ccff, 5, 50);
        light2.position.set(4, -4, 4);
        scene.add(light2);

        const light3 = new THREE.PointLight(0xff44aa, 4, 50);
        light3.position.set(0, 4, -4);
        scene.add(light3);

        // ─────────────────────────────────────────
        // 3. GÉOMÉTRIES — les 3 formes cibles
        // ─────────────────────────────────────────
        // Toutes doivent avoir le MÊME nombre de vertices
        // On utilise SphereGeometry comme base commune
        const SEGMENTS = 64;

        // Forme 1 — Sphère (base)
        const sphereGeo = new THREE.SphereGeometry(1.5, SEGMENTS, SEGMENTS);

        // Forme 2 — Cube arrondi (simulé via BoxGeometry subdivisé)
        const boxGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2, SEGMENTS, SEGMENTS, SEGMENTS);

        // Forme 3 — Tore
        const torusGeo = new THREE.TorusGeometry(1.2, 0.5, SEGMENTS, SEGMENTS);

        // ─────────────────────────────────────────
        // 4. MORPH TARGETS
        // Principe : la géométrie de base = sphère
        // Les morph targets = positions alternatives
        // Three.js interpole entre elles selon morphTargetInfluences
        // ─────────────────────────────────────────

        // Fonction pour rééchantillonner une géométrie
        // vers le même nombre de points que la base
        function resamplePositions(geo, targetCount) {
            const src    = geo.attributes.position;
            const result = new Float32Array(targetCount * 3);
            for (let i = 0; i < targetCount; i++) {
                const t   = i / targetCount;
                const idx = Math.floor(t * src.count);
                result[i * 3]     = src.getX(idx);
                result[i * 3 + 1] = src.getY(idx);
                result[i * 3 + 2] = src.getZ(idx);
            }
            return result;
        }

        const baseCount = sphereGeo.attributes.position.count;

        // Positions rééchantillonnées pour box et torus
        const boxPositions   = resamplePositions(boxGeo,   baseCount);
        const torusPositions = resamplePositions(torusGeo, baseCount);

        // Ajout des morph targets à la sphère
        sphereGeo.morphAttributes.position = [
            new THREE.BufferAttribute(boxPositions,   3),
            new THREE.BufferAttribute(torusPositions, 3),
        ];
        sphereGeo.morphTargetsRelative = false;

        // ─────────────────────────────────────────
        // 5. MATÉRIAU — wireframe + solid toggle
        // ─────────────────────────────────────────
        const material = new THREE.MeshPhongMaterial({
            color:       0x7f77dd,
            emissive:    0x1a1040,
            specular:    0xffffff,
            shininess:   100,
            transparent: true,
            opacity:     0.92,
            wireframe:   false,
        });

        const mesh = new THREE.Mesh(sphereGeo, material);
        mesh.morphTargetInfluences = [0, 0]; // [box, torus]
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        // Wireframe overlay — grille par-dessus le mesh solide
        const wireMaterial = new THREE.MeshBasicMaterial({
            color:     0x9988ff,
            wireframe: true,
            transparent: true,
            opacity:   0.15,
        });
        const wireMesh = new THREE.Mesh(sphereGeo, wireMaterial);
        wireMesh.morphTargetInfluences = mesh.morphTargetInfluences; // partagés !
        scene.add(wireMesh);

        // ─────────────────────────────────────────
        // 6. PARTICULES orbitales
        // ─────────────────────────────────────────
        const orbCount  = 200;
        const orbGeo    = new THREE.BufferGeometry();
        const orbPos    = new Float32Array(orbCount * 3);
        const orbPhases = new Float32Array(orbCount);

        for (let i = 0; i < orbCount; i++) {
            orbPhases[i]     = Math.random() * Math.PI * 2;
            const radius     = 2.5 + Math.random() * 1.5;
            const theta      = Math.random() * Math.PI * 2;
            const phi        = Math.acos(2 * Math.random() - 1);
            orbPos[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
            orbPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            orbPos[i * 3 + 2] = radius * Math.cos(phi);
        }

        orbGeo.setAttribute('position', new THREE.BufferAttribute(orbPos, 3));

        const orbMat = new THREE.PointsMaterial({
            color:       0x00ccff,
            size:        0.06,
            transparent: true,
            opacity:     0.8,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        scene.add(new THREE.Points(orbGeo, orbMat));

        // ─────────────────────────────────────────
        // 7. ÉTAT — machine à états pour le morphing
        // ─────────────────────────────────────────
        const SHAPES = ['Sphère', 'Cube', 'Tore'];
        let currentShape = 0;   // 0 = sphère, 1 = cube, 2 = tore
        let targetShape  = 0;
        let morphProgress = 1;  // 0→1 pendant la transition
        let autoMorph    = true;
        let autoTimer    = 0;
        const AUTO_INTERVAL = 3; // secondes entre chaque morphing auto

        // Influences cibles selon la forme
        // [boxInfluence, torusInfluence]
        const shapeInfluences = [
            [0, 0],   // sphère — influences nulles
            [1, 0],   // cube   — influence box = 1
            [0, 1],   // tore   — influence torus = 1
        ];

        function morphTo(shapeIndex) {
            if (shapeIndex === currentShape) return;
            targetShape   = shapeIndex;
            morphProgress = 0;
            updateShapeLabel();
        }

        function updateShapeLabel() {
            const el = document.getElementById('currentShape');
            if (el) el.textContent = SHAPES[targetShape];
        }

        // ─────────────────────────────────────────
        // 8. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="morphControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(10,10,30,0.85);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <span style="color:#9988dd;font-size:13px;">Forme :</span>
                <span id="currentShape" style="color:#fff;font-size:13px;font-weight:500;min-width:50px;">Sphère</span>

                <button class="morphBtn" data-shape="0" style="
                    color:#fff; background:rgba(127,119,221,0.3);
                    border:1px solid rgba(127,119,221,0.5);
                    padding:5px 14px; border-radius:20px; cursor:pointer; font-size:13px;">
                    ● Sphère
                </button>
                <button class="morphBtn" data-shape="1" style="
                    color:#fff; background:rgba(0,204,255,0.2);
                    border:1px solid rgba(0,204,255,0.4);
                    padding:5px 14px; border-radius:20px; cursor:pointer; font-size:13px;">
                    ■ Cube
                </button>
                <button class="morphBtn" data-shape="2" style="
                    color:#fff; background:rgba(255,68,170,0.2);
                    border:1px solid rgba(255,68,170,0.4);
                    padding:5px 14px; border-radius:20px; cursor:pointer; font-size:13px;">
                    ◎ Tore
                </button>

                <label style="color:#9988dd;font-size:13px;">Vitesse morph</label>
                <input type="range" id="morphSpeed" min="0.3" max="5" value="1.5" step="0.1"
                    style="width:80px; accent-color:#7f77dd;">

                <button id="autoMorphBtn" style="
                    color:#fff; background:rgba(255,170,0,0.2);
                    border:1px solid rgba(255,170,0,0.4);
                    padding:5px 14px; border-radius:20px; cursor:pointer; font-size:13px;">
                    ⟳ Auto ON
                </button>

                <button id="wireBtn" style="
                    color:#fff; background:rgba(100,100,200,0.2);
                    border:1px solid rgba(100,100,200,0.4);
                    padding:5px 14px; border-radius:20px; cursor:pointer; font-size:13px;">
                    ⌗ Wireframe
                </button>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        // Boutons de forme
        document.querySelectorAll('.morphBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                autoMorph = false;
                document.getElementById('autoMorphBtn').textContent = '⟳ Auto OFF';
                morphTo(+btn.dataset.shape);
            });
        });

        let morphSpeed = 1.5;
        document.getElementById('morphSpeed').addEventListener('input', e => {
            morphSpeed = +e.target.value;
        });

        document.getElementById('autoMorphBtn').addEventListener('click', () => {
            autoMorph = !autoMorph;
            document.getElementById('autoMorphBtn').textContent =
                autoMorph ? '⟳ Auto ON' : '⟳ Auto OFF';
        });

        let wireVisible = true;
        document.getElementById('wireBtn').addEventListener('click', () => {
            wireVisible = !wireVisible;
            wireMesh.material.opacity = wireVisible ? 0.15 : 0;
            document.getElementById('wireBtn').textContent =
                wireVisible ? '⌗ Wireframe' : '⌗ Solid';
        });

        // ─────────────────────────────────────────
        // 9. INTERACTION SOURIS
        // ─────────────────────────────────────────
        let mouseX = 0, mouseY = 0;
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / W - 0.5) * 2;
            mouseY = ((e.clientY - rect.top)  / H - 0.5) * 2;
        });

        // ─────────────────────────────────────────
        // 10. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;
        let   running = true;

        // Easing — transition douce accélération/décélération
        function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta = timer.getDelta();
            elapsed += delta;

            // ── Auto morphing
            if (autoMorph) {
                autoTimer += delta;
                if (autoTimer >= AUTO_INTERVAL && morphProgress >= 1) {
                    autoTimer = 0;
                    const next = (currentShape + 1) % SHAPES.length;
                    morphTo(next);
                }
            }

            // ── Interpolation des morph targets
            if (morphProgress < 1) {
                morphProgress = Math.min(1, morphProgress + delta * morphSpeed);
                const t = easeInOut(morphProgress);

                const fromInf = shapeInfluences[currentShape];
                const toInf   = shapeInfluences[targetShape];

                // Interpolation linéaire entre les influences source et cible
                mesh.morphTargetInfluences[0] = fromInf[0] + (toInf[0] - fromInf[0]) * t;
                mesh.morphTargetInfluences[1] = fromInf[1] + (toInf[1] - fromInf[1]) * t;

                if (morphProgress >= 1) {
                    currentShape = targetShape;
                }
            }

            // ── Rotation du mesh — suit la souris + rotation auto
            mesh.rotation.y += (mouseX * 0.5 - mesh.rotation.y) * 0.03 + 0.003;
            mesh.rotation.x += (mouseY * 0.3 - mesh.rotation.x) * 0.03;
            wireMesh.rotation.copy(mesh.rotation);

            // ── Pulse — légère pulsation de scale pendant le morphing
            const pulse = 1 + Math.sin(elapsed * 3) * 0.01 * (1 - morphProgress);
            mesh.scale.setScalar(pulse);
            wireMesh.scale.setScalar(pulse);

            // ── Lumières orbitales
            light1.position.x = Math.cos(elapsed * 0.7) * 4;
            light1.position.z = Math.sin(elapsed * 0.7) * 4;
            light2.position.x = Math.cos(elapsed * 0.7 + Math.PI) * 4;
            light2.position.z = Math.sin(elapsed * 0.7 + Math.PI) * 4;
            light3.position.y = Math.sin(elapsed * 0.5) * 3;

            // ── Particules orbitales — rotation lente
            const orbPositions = orbGeo.attributes.position.array;
            for (let i = 0; i < orbCount; i++) {
                orbPhases[i] += delta * 0.3;
                const radius  = 2.5 + Math.sin(orbPhases[i] * 0.7) * 0.5;
                const theta   = orbPhases[i];
                const phi     = (i / orbCount) * Math.PI;
                orbPositions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
                orbPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                orbPositions[i * 3 + 2] = radius * Math.cos(phi);
            }
            orbGeo.attributes.position.needsUpdate = true;

            renderer.render(scene, camera);
        }

        animate();
    }
}