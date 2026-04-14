import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function init() {

    (function initLoadingHexGrid() {
        const canvas = document.getElementById("loadingHexCanvas");
        if (!canvas) { console.error("Canvas loadingHexCanvas introuvable"); return; }

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

        camera.position.set(0, 0, 40);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // ─────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H), 1.4, 0.6, 0.5
        ));

        // ─────────────────────────────────────────
        // 3. GRILLE HEXAGONALE
        // ─────────────────────────────────────────
        const HEX_SIZE   = 1.8;    // rayon de l'hexagone
        const HEX_GAP    = 0.15;   // espace entre hexagones
        const COLS_HEX   = 18;
        const ROWS_HEX   = 12;

        // Génère les sommets d'un hexagone régulier
        function hexVertices(size) {
            const pts = [];
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 180) * (60 * i - 30);
                pts.push(new THREE.Vector2(
                    size * Math.cos(angle),
                    size * Math.sin(angle)
                ));
            }
            return pts;
        }

        const hexes   = [];   // données de chaque hexagone
        const meshes  = [];   // meshes Three.js

        // Offset pour centrer la grille
        const totalW  = COLS_HEX * (HEX_SIZE * 2 + HEX_GAP) * 0.75;
        const totalH  = ROWS_HEX * (HEX_SIZE * Math.sqrt(3) + HEX_GAP);
        const offsetX = -totalW / 2;
        const offsetY = -totalH / 2;

        for (let row = 0; row < ROWS_HEX; row++) {
            for (let col = 0; col < COLS_HEX; col++) {

                // Coordonnées en grille hexagonale
                const x = offsetX + col * (HEX_SIZE * 1.5 + HEX_GAP);
                const y = offsetY + row * (HEX_SIZE * Math.sqrt(3) + HEX_GAP * 0.5)
                        + (col % 2 === 0 ? 0 : (HEX_SIZE * Math.sqrt(3) + HEX_GAP * 0.5) / 2);

                // Distance du centre — pour l'ordre d'allumage
                const distFromCenter = Math.sqrt(x * x + y * y);

                // Géométrie hexagonale via Shape
                const shape = new THREE.Shape(hexVertices(HEX_SIZE - HEX_GAP));
                const geo   = new THREE.ShapeGeometry(shape);

                const mat = new THREE.MeshBasicMaterial({
                    color:       0x010108,
                    transparent: true,
                    opacity:     1,
                });

                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, 0);
                scene.add(mesh);
                meshes.push(mesh);

                // Contour de l'hexagone
                const edgeGeo = new THREE.EdgesGeometry(geo);
                const edgeMat = new THREE.LineBasicMaterial({
                    color:       0x112233,
                    transparent: true,
                    opacity:     0.4,
                });
                const edge = new THREE.LineSegments(edgeGeo, edgeMat);
                mesh.add(edge);

                hexes.push({
                    mesh,
                    edge,
                    x, y,
                    distFromCenter,
                    row, col,
                    // État de l'hexagone
                    lit:       false,
                    litTime:   0,
                    pulse:     Math.random() * Math.PI * 2,
                    delay:     distFromCenter * 0.08 + Math.random() * 0.3,
                    baseColor: new THREE.Color(0x010108),
                    targetCol: new THREE.Color(),
                });
            }
        }

        // Tri par distance du centre — allumage en vague
        hexes.sort((a, b) => a.distFromCenter - b.distFromCenter);

        // ─────────────────────────────────────────
        // 4. PALETTE DE COULEURS — par progression
        // ─────────────────────────────────────────
        function progressColor(progress) {
            if (progress < 0.25) {
                return new THREE.Color(0x001144);  // bleu très sombre
            } else if (progress < 0.5) {
                return new THREE.Color(0x0044aa);  // bleu
            } else if (progress < 0.75) {
                return new THREE.Color(0x00aaff);  // cyan
            } else {
                return new THREE.Color(0x00ffcc);  // cyan brillant
            }
        }

        // ─────────────────────────────────────────
        // 5. ÉTAT DU CHARGEMENT
        // ─────────────────────────────────────────
        let progress     = 0;
        let isComplete   = false;
        let loadInterval = null;
        let resetTimer   = null;

        function startLoading() {
            if (loadInterval) clearInterval(loadInterval);
            if (resetTimer)   clearTimeout(resetTimer);

            progress   = 0;
            isComplete = false;

            // Reset visuel de tous les hexagones
            hexes.forEach(h => {
                h.lit     = false;
                h.litTime = 0;
                h.mesh.material.color.set(0x010108);
                h.edge.material.color.set(0x112233);
                h.edge.material.opacity = 0.4;
                h.mesh.scale.set(1, 1, 1);
            });

            loadInterval = setInterval(() => {
                progress += Math.random() * 0.025 + 0.005;
                if (progress >= 1) {
                    progress = 1;
                    isComplete = true;
                    clearInterval(loadInterval);
                    loadInterval = null;

                    // Relance automatique après 2s
                    resetTimer = setTimeout(() => startLoading(), 2000);
                }
            }, 80);
        }

        startLoading();

        // ─────────────────────────────────────────
        // 6. TEXTE DE PROGRESSION
        // ─────────────────────────────────────────
        // Affichage 2D par-dessus le canvas
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
            <div id="hexPercent" style="
                font-size: 48px;
                font-weight: bold;
                color: #00ffcc;
                text-shadow: 0 0 20px #00ffcc, 0 0 40px #00aaff;
                letter-spacing: 4px;
            ">0%</div>
            <div id="hexLabel" style="
                font-size: 14px;
                color: #336677;
                letter-spacing: 6px;
                margin-top: 8px;
            ">CHARGEMENT</div>
        `;

        // Wrapper relatif pour positionner l'overlay
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        canvas.parentNode.insertBefore(wrapper, canvas);
        wrapper.appendChild(canvas);
        wrapper.appendChild(overlay);

        // ─────────────────────────────────────────
        // 7. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="hexControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(1,1,15,0.95);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#00aaff;font-size:13px;">Vitesse</label>
                <input type="range" id="hexSpeed" min="0.5" max="5" value="1" step="0.1"
                    style="width:90px; accent-color:#00aaff;">

                <label style="color:#00aaff;font-size:13px;">Bloom</label>
                <input type="range" id="hexBloom" min="0" max="3" value="1.4" step="0.1"
                    style="width:90px; accent-color:#00aaff;">

                <button id="hexRestartBtn" style="
                    color:#fff; background:rgba(0,150,255,0.2);
                    border:1px solid rgba(0,150,255,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⟳ Relancer</button>

                <button id="hexPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let hexSpeed = 1;
        let running  = true;

        document.getElementById('hexSpeed').addEventListener('input', e => {
            hexSpeed = +e.target.value;
        });
        document.getElementById('hexBloom').addEventListener('input', e => {
            composer.passes[1].strength = +e.target.value;
        });
        document.getElementById('hexRestartBtn').addEventListener('click', () => {
            startLoading();
        });
        document.getElementById('hexPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('hexPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 8. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta * hexSpeed;

            // ── Allumage des hexagones selon le progrès
            const totalHex    = hexes.length;
            const litTarget   = Math.floor(progress * totalHex);

            hexes.forEach((h, i) => {
                if (i < litTarget && !h.lit) {
                    h.lit     = true;
                    h.litTime = elapsed;
                }

                if (h.lit) {
                    const age    = elapsed - h.litTime;
                    const fadeIn = Math.min(1, age * 3);

                    // Couleur selon la progression globale
                    const col = progressColor(progress);
                    h.mesh.material.color.copy(col).multiplyScalar(fadeIn * 0.3);

                    // Contour brillant
                    h.edge.material.color.copy(col);
                    h.edge.material.opacity = 0.4 + fadeIn * 0.6;

                    // Pulsation douce
                    const pulse = 1 + Math.sin(elapsed * 1.5 + h.pulse) * 0.03 * fadeIn;
                    h.mesh.scale.set(pulse, pulse, 1);

                    // Surbrillance sur les derniers allumés
                    if (i >= litTarget - 5 && i < litTarget) {
                        const bright = Math.max(0, 1 - (litTarget - 1 - i) * 0.2);
                        h.mesh.material.color.copy(col).multiplyScalar(bright);
                        h.edge.material.opacity = 1;
                    }

                } else {
                    // Hexagone éteint — légère lueur de fond
                    const glow = Math.sin(elapsed * 0.5 + h.pulse) * 0.02 + 0.02;
                    h.mesh.material.color.setRGB(glow * 0.1, glow * 0.2, glow * 0.5);
                }
            });

            // ── Update overlay %
            const pct = Math.round(progress * 100);
            document.getElementById('hexPercent').textContent = pct + '%';

            // Couleur du % selon progression
            const hue = Math.floor(180 + progress * 60);
            document.getElementById('hexPercent').style.color =
                `hsl(${hue}, 100%, 60%)`;

            // ── Légère rotation de la caméra
            camera.position.x = Math.sin(elapsed * 0.05) * 2;
            camera.position.y = Math.cos(elapsed * 0.04) * 1;
            camera.lookAt(0, 0, 0);

            composer.render();
        }

        animate();
    })();
}