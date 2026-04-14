import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function init() {

    (function initLoadingSphere() {
        const canvas = document.getElementById("loadingSphereCanvas");
        if (!canvas) { console.error("Canvas loadingSphereCanvas introuvable"); return; }

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
        renderer.setClearColor(0x010108, 1);

        camera.position.set(0, 0, 35);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // ─────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H), 1.5, 0.6, 0.4
        ));

        // ─────────────────────────────────────────
        // 3. SPHÈRE DE DONNÉES
        // Points connectés par des lignes sur une sphère
        // ─────────────────────────────────────────
        const POINT_COUNT = 200;
        const RADIUS      = 10;

        const pointPositions = [];

        // Distribution uniforme sur la sphère — algorithme de Fibonacci
        for (let i = 0; i < POINT_COUNT; i++) {
            const phi   = Math.acos(1 - 2 * (i + 0.5) / POINT_COUNT);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            pointPositions.push(new THREE.Vector3(
                RADIUS * Math.sin(phi) * Math.cos(theta),
                RADIUS * Math.sin(phi) * Math.sin(theta),
                RADIUS * Math.cos(phi)
            ));
        }

        // ─────────────────────────────────────────
        // 4. POINTS — InstancedMesh
        // ─────────────────────────────────────────
        const pointGeo  = new THREE.SphereGeometry(0.12, 6, 6);
        const pointMat  = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const pointMesh = new THREE.InstancedMesh(pointGeo, pointMat, POINT_COUNT);

        const dummy      = new THREE.Object3D();
        const initColor  = new THREE.Color(0x001122);

        for (let i = 0; i < POINT_COUNT; i++) {
            dummy.position.copy(pointPositions[i]);
            dummy.scale.setScalar(0.01);  // commence invisible
            dummy.updateMatrix();
            pointMesh.setMatrixAt(i, dummy.matrix);
            pointMesh.setColorAt(i, initColor);
        }

        pointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(pointMesh);

        // ─────────────────────────────────────────
        // 5. CONNEXIONS — lignes entre points proches
        // ─────────────────────────────────────────
        const MAX_DIST    = 5;     // distance max pour une connexion
        const connections = [];    // paires de points connectés

        // Calcule toutes les connexions possibles
        for (let i = 0; i < POINT_COUNT; i++) {
            for (let j = i + 1; j < POINT_COUNT; j++) {
                const dist = pointPositions[i].distanceTo(pointPositions[j]);
                if (dist < MAX_DIST) {
                    connections.push({ i, j, dist });
                }
            }
        }

        // Crée un LineSegments pour toutes les connexions
        const linePositions = new Float32Array(connections.length * 2 * 3);
        const lineColors    = new Float32Array(connections.length * 2 * 3);
        const lineGeo       = new THREE.BufferGeometry();

        lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        lineGeo.setAttribute('color',    new THREE.BufferAttribute(lineColors, 3));

        const lineMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent:  true,
            opacity:      0.6,
            blending:     THREE.AdditiveBlending,
            depthWrite:   false,
        });

        const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
        scene.add(lineSegments);

        // ─────────────────────────────────────────
        // 6. SPHÈRE CENTRALE — noyau pulsant
        // ─────────────────────────────────────────
        const coreMesh = new THREE.Mesh(
            new THREE.SphereGeometry(2, 32, 32),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTime:     { value: 0 },
                    uProgress: { value: 0 },
                },
                vertexShader: `
                    uniform float uTime;
                    uniform float uProgress;
                    varying vec3  vNormal;
                    varying float vNoise;

                    void main() {
                        vNormal = normal;

                        // Distorsion de surface — pulsation
                        float pulse = sin(uTime * 3.0 + position.y * 2.0) * 0.1 * uProgress;
                        vec3  pos   = position + normal * pulse;

                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform float uTime;
                    uniform float uProgress;
                    varying vec3  vNormal;

                    void main() {
                        // Fresnel
                        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 2.0);

                        // Couleur — bleu vers cyan avec le progrès
                        vec3 col1 = vec3(0.0, 0.2, 0.8);
                        vec3 col2 = vec3(0.0, 1.0, 0.8);
                        vec3 col  = mix(col1, col2, uProgress);

                        float glow = fresnel * 2.0 + 0.1;
                        gl_FragColor = vec4(col * glow, glow * 0.8);
                    }
                `,
                transparent: true,
                blending:    THREE.AdditiveBlending,
                depthWrite:  false,
            })
        );
        scene.add(coreMesh);

        // ─────────────────────────────────────────
        // 7. ANNEAU DE PROGRESSION
        // Tore qui se remplit selon le progrès
        // ─────────────────────────────────────────
        const RING_SEGMENTS = 128;
        const ringGeo = new THREE.BufferGeometry();
        const ringPos = new Float32Array(RING_SEGMENTS * 3);
        const ringCol = new Float32Array(RING_SEGMENTS * 3);

        for (let i = 0; i < RING_SEGMENTS; i++) {
            const angle  = (i / RING_SEGMENTS) * Math.PI * 2;
            ringPos[i * 3]     = Math.cos(angle) * 12;
            ringPos[i * 3 + 1] = Math.sin(angle) * 12;
            ringPos[i * 3 + 2] = 0;
            ringCol[i * 3]     = 0;
            ringCol[i * 3 + 1] = 0;
            ringCol[i * 3 + 2] = 0;
        }

        ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
        ringGeo.setAttribute('color',    new THREE.BufferAttribute(ringCol, 3));

        scene.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent:  true,
            blending:     THREE.AdditiveBlending,
            depthWrite:   false,
        })));

        // ─────────────────────────────────────────
        // 8. OVERLAY
        // ─────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            text-align: center;
            font-family: monospace;
        `;
        overlay.innerHTML = `
            <div id="spherePercent" style="
                font-size: 42px;
                font-weight: bold;
                color: #00ffcc;
                text-shadow: 0 0 20px #00ffcc;
                letter-spacing: 4px;
            ">0%</div>
            <div id="sphereLabel" style="
                font-size: 11px;
                color: #336677;
                letter-spacing: 8px;
                margin-top: 6px;
            ">INITIALISATION</div>
        `;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        canvas.parentNode.insertBefore(wrapper, canvas);
        wrapper.appendChild(canvas);
        wrapper.appendChild(overlay);

        // ─────────────────────────────────────────
        // 9. ÉTAT DU CHARGEMENT
        // ─────────────────────────────────────────
        let progress     = 0;
        let loadInterval = null;
        let resetTimer   = null;

        const LOAD_LABELS = [
            { threshold: 0.0,  label: 'INITIALISATION' },
            { threshold: 0.25, label: 'CHARGEMENT RESSOURCES' },
            { threshold: 0.5,  label: 'COMPILATION SHADERS' },
            { threshold: 0.75, label: 'FINALISATION' },
            { threshold: 1.0,  label: 'PRÊT ✓' },
        ];

        function getCurrentLabel() {
            let label = LOAD_LABELS[0].label;
            for (const l of LOAD_LABELS) {
                if (progress >= l.threshold) label = l.label;
            }
            return label;
        }

        function startLoading() {
            if (loadInterval) clearInterval(loadInterval);
            if (resetTimer)   clearTimeout(resetTimer);

            progress = 0;

            // Reset points
            for (let i = 0; i < POINT_COUNT; i++) {
                dummy.position.copy(pointPositions[i]);
                dummy.scale.setScalar(0.01);
                dummy.updateMatrix();
                pointMesh.setMatrixAt(i, dummy.matrix);
                pointMesh.setColorAt(i, initColor);
            }
            pointMesh.instanceMatrix.needsUpdate = true;
            pointMesh.instanceColor.needsUpdate  = true;

            loadInterval = setInterval(() => {
                progress += Math.random() * 0.02 + 0.005;
                if (progress >= 1) {
                    progress = 1;
                    clearInterval(loadInterval);
                    loadInterval = null;
                    resetTimer = setTimeout(() => startLoading(), 2000);
                }
            }, 80);
        }

        startLoading();

        // ─────────────────────────────────────────
        // 10. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="sphereControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(1,1,15,0.95);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#00ffcc;font-size:13px;">Vitesse rot.</label>
                <input type="range" id="sphereRotSpeed" min="0.1" max="3" value="1" step="0.1"
                    style="width:80px; accent-color:#00ffcc;">

                <label style="color:#00ffcc;font-size:13px;">Bloom</label>
                <input type="range" id="sphereBloom" min="0" max="3" value="1.5" step="0.1"
                    style="width:80px; accent-color:#00ffcc;">

                <button id="sphereRestartBtn" style="
                    color:#fff; background:rgba(0,200,150,0.2);
                    border:1px solid rgba(0,200,150,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⟳ Relancer</button>

                <button id="spherePauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let rotSpeed = 1;
        let running  = true;

        document.getElementById('sphereRotSpeed').addEventListener('input', e => {
            rotSpeed = +e.target.value;
        });
        document.getElementById('sphereBloom').addEventListener('input', e => {
            composer.passes[1].strength = +e.target.value;
        });
        document.getElementById('sphereRestartBtn').addEventListener('click', () => {
            startLoading();
        });
        document.getElementById('spherePauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('spherePauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 11. ANIMATION
        // ─────────────────────────────────────────
        const timer     = new THREE.Timer();
        let   elapsed   = 0;
        const pointColor = new THREE.Color();

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta * rotSpeed;

            // ── Points — apparaissent progressivement
            const litCount = Math.floor(progress * POINT_COUNT);

            for (let i = 0; i < POINT_COUNT; i++) {
                const isLit = i < litCount;
                const age   = isLit ? Math.min(1, (litCount - i) / 10) : 0;

                dummy.position.copy(pointPositions[i]);
                dummy.scale.setScalar(isLit ? 0.5 + Math.sin(elapsed * 2 + i * 0.3) * 0.15 : 0.01);
                dummy.updateMatrix();
                pointMesh.setMatrixAt(i, dummy.matrix);

                if (isLit) {
                    // Couleur — bleu → cyan → blanc selon progression
                    const t = i / POINT_COUNT;
                    pointColor.setHSL(
                        0.5 - progress * 0.1 + t * 0.05,
                        1.0,
                        0.4 + age * 0.4
                    );
                } else {
                    pointColor.set(0x001122);
                }
                pointMesh.setColorAt(i, pointColor);
            }

            pointMesh.instanceMatrix.needsUpdate = true;
            pointMesh.instanceColor.needsUpdate  = true;

            // ── Connexions — s'allument selon les points actifs
            const lp = lineGeo.attributes.position.array;
            const lc = lineGeo.attributes.color.array;

            connections.forEach(({ i, j, dist }, idx) => {
                const iLit = i < litCount;
                const jLit = j < litCount;
                const bothLit = iLit && jLit;

                // Positions
                lp[idx * 6]     = pointPositions[i].x;
                lp[idx * 6 + 1] = pointPositions[i].y;
                lp[idx * 6 + 2] = pointPositions[i].z;
                lp[idx * 6 + 3] = pointPositions[j].x;
                lp[idx * 6 + 4] = pointPositions[j].y;
                lp[idx * 6 + 5] = pointPositions[j].z;

                // Couleur — brillant si les deux points sont actifs
                const bright = bothLit ? (1 - dist / MAX_DIST) * 0.8 : 0;
                const hue    = 0.5 - progress * 0.1;
                const col    = new THREE.Color().setHSL(hue, 1.0, bright);

                lc[idx * 6]     = col.r;
                lc[idx * 6 + 1] = col.g;
                lc[idx * 6 + 2] = col.b;
                lc[idx * 6 + 3] = col.r;
                lc[idx * 6 + 4] = col.g;
                lc[idx * 6 + 5] = col.b;
            });

            lineGeo.attributes.position.needsUpdate = true;
            lineGeo.attributes.color.needsUpdate    = true;

            // ── Anneau de progression
            const rc = ringGeo.attributes.color.array;
            for (let i = 0; i < RING_SEGMENTS; i++) {
                const segProgress = i / RING_SEGMENTS;
                const isActive    = segProgress <= progress;
                const brightness  = isActive
                    ? 0.5 + Math.sin(elapsed * 3 + i * 0.2) * 0.3
                    : 0.03;
                const col = new THREE.Color().setHSL(
                    0.5 - progress * 0.1,
                    1.0,
                    isActive ? brightness : 0.03
                );
                rc[i * 3]     = col.r;
                rc[i * 3 + 1] = col.g;
                rc[i * 3 + 2] = col.b;
            }
            ringGeo.attributes.color.needsUpdate = true;

            // ── Noyau central
            coreMesh.material.uniforms.uTime.value     = elapsed;
            coreMesh.material.uniforms.uProgress.value = progress;
            coreMesh.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.05 * progress);

            // ── Rotation de la sphère
            lineSegments.rotation.y  = elapsed * 0.2;
            lineSegments.rotation.x  = elapsed * 0.1;
            pointMesh.rotation.y     = elapsed * 0.2;
            pointMesh.rotation.x     = elapsed * 0.1;

            // ── Caméra
            camera.position.x = Math.sin(elapsed * 0.15) * 5;
            camera.position.y = Math.cos(elapsed * 0.1) * 3;
            camera.lookAt(0, 0, 0);

            // ── Overlay
            const pct = Math.round(progress * 100);
            document.getElementById('spherePercent').textContent = pct + '%';
            document.getElementById('sphereLabel').textContent   = getCurrentLabel();

            if (progress >= 1) {
                document.getElementById('spherePercent').style.color =
                    '#ffffff';
                document.getElementById('spherePercent').style.textShadow =
                    '0 0 30px #00ffcc, 0 0 60px #0088ff';
                document.getElementById('sphereLabel').style.color = '#00ffcc';
            }

            composer.render();
        }

        animate();
    })();
}