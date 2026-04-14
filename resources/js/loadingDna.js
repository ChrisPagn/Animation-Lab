import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';



export function init() {

    (function initLoadingDna() {
        const canvas = document.getElementById("loadingDnaCanvas");
        if (!canvas) { console.error("Canvas loadingDnaCanvas introuvable"); return; }

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
        renderer.setClearColor(0x020208, 1);

        camera.position.set(0, 0, 30);
        camera.lookAt(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. POST-PROCESSING
        // ─────────────────────────────────────────
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(W, H), 1.2, 0.5, 0.6
        ));

        // ─────────────────────────────────────────
        // 3. ÉTAT DU CHARGEMENT
        // Simule un vrai chargement 0 → 100%
        // Dans un vrai projet : remplace simulateLoading
        // par tes vraies promesses fetch/import
        // ─────────────────────────────────────────

        let progress   = 0;
        let isComplete = false;
        let fadeOut    = 0;

        // ← garde une référence aux intervalles pour pouvoir les arrêter
        let loadInterval = null;
        let fadeInterval = null;

        function simulateLoading() {
            // ← arrête les intervalles précédents avant de relancer
            if (loadInterval) clearInterval(loadInterval);
            if (fadeInterval) clearInterval(fadeInterval);

            // ← reset complet de l'état
            progress   = 0;
            isComplete = false;
            fadeOut    = 0;
            renderer.domElement.style.opacity = 1;  // ← remet l'opacité à 1

            loadInterval = setInterval(() => {
                progress += Math.random() * 0.03;

                if (progress >= 1) {
                    progress   = 1;
                    isComplete = true;
                    clearInterval(loadInterval);
                    loadInterval = null;

                    setTimeout(() => {
                        fadeInterval = setInterval(() => {
                            fadeOut += 0.02;
                            if (fadeOut >= 1) {
                                fadeOut = 1;
                                clearInterval(fadeInterval);
                                fadeInterval = null;

                                // ← relance automatiquement après 1 seconde
                                setTimeout(() => simulateLoading(), 1000);
                            }
                            renderer.domElement.style.opacity = 1 - fadeOut;
                        }, 16);
                    }, 800);
                }
            }, 80);
        }

        simulateLoading();

        // ─────────────────────────────────────────
        // 4. ADN — deux hélices de sphères
        // ─────────────────────────────────────────
        const DNA_COUNT  = 30;    // paires de bases
        const DNA_RADIUS = 4;     // rayon de l'hélice
        const DNA_HEIGHT = 20;    // hauteur totale
        const DNA_TURNS  = 2.5;   // nombre de tours

        const spheres1 = [];  // hélice 1 — cyan
        const spheres2 = [];  // hélice 2 — violet
        const bridges  = [];  // ponts entre les deux hélices

        const mat1 = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const mat2 = new THREE.MeshBasicMaterial({ color: 0xaa44ff });
        const matB = new THREE.LineBasicMaterial({
            color:       0x334455,
            transparent: true,
            opacity:     0.5,
        });
        const matBActive = new THREE.LineBasicMaterial({
            color:       0x00ffcc,
            transparent: true,
            opacity:     0.8,
        });

        for (let i = 0; i < DNA_COUNT; i++) {
            const t      = i / DNA_COUNT;
            const angle  = t * Math.PI * 2 * DNA_TURNS;
            const y      = (t - 0.5) * DNA_HEIGHT;
            const size   = 0.25 + Math.random() * 0.15;

            // Hélice 1
            const s1 = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), mat1.clone());
            s1.position.set(Math.cos(angle) * DNA_RADIUS, y, Math.sin(angle) * DNA_RADIUS);
            s1.userData = { t, angle, baseY: y, size };
            scene.add(s1);
            spheres1.push(s1);

            // Hélice 2 — décalée de π
            const s2 = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), mat2.clone());
            s2.position.set(
                Math.cos(angle + Math.PI) * DNA_RADIUS,
                y,
                Math.sin(angle + Math.PI) * DNA_RADIUS
            );
            s2.userData = { t, angle: angle + Math.PI, baseY: y, size };
            scene.add(s2);
            spheres2.push(s2);

            // Pont entre les deux sphères
            const bridgeGeo = new THREE.BufferGeometry().setFromPoints([
                s1.position.clone(),
                s2.position.clone(),
            ]);
            const bridge = new THREE.Line(bridgeGeo, matB.clone());
            bridge.userData = { t, s1, s2 };
            scene.add(bridge);
            bridges.push(bridge);
        }

        // ─────────────────────────────────────────
        // 5. TEXTE — pourcentage + label
        // ─────────────────────────────────────────
        let percentMesh = null;
        let labelMesh   = null;

        const fontLoader = new FontLoader();
        fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
            (font) => {
                // Label "CHARGEMENT"
                const labelGeo = new TextGeometry('CHARGEMENT', {
                    font, size: 0.8, depth: 0.1, curveSegments: 6,
                });
                labelGeo.computeBoundingBox();
                const lw = labelGeo.boundingBox.max.x - labelGeo.boundingBox.min.x;
                labelGeo.translate(-lw / 2, -12, 0);

                labelMesh = new THREE.Mesh(labelGeo,
                    new THREE.MeshBasicMaterial({ color: 0x556677 })
                );
                scene.add(labelMesh);
            }
        );

        // ─────────────────────────────────────────
        // 6. BARRE DE PROGRESSION — géométrie custom
        // ─────────────────────────────────────────
        const barWidth  = 14;
        const barHeight = 0.4;

        // Fond de la barre
        const barBg = new THREE.Mesh(
            new THREE.PlaneGeometry(barWidth, barHeight),
            new THREE.MeshBasicMaterial({ color: 0x112233 })
        );
        barBg.position.set(0, -10, 0);
        scene.add(barBg);

        // Barre de progression — on la scale en X
        const barFill = new THREE.Mesh(
            new THREE.PlaneGeometry(barWidth, barHeight),
            new THREE.MeshBasicMaterial({ color: 0x00ffcc })
        );
        barFill.position.set(-barWidth / 2, -10, 0.1);
        barFill.geometry.translate(barWidth / 2, 0, 0);  // pivot à gauche
        scene.add(barFill);

        // Glow sur la barre
        const barGlow = new THREE.Mesh(
            new THREE.PlaneGeometry(barWidth, barHeight * 3),
            new THREE.MeshBasicMaterial({
                color:       0x00ffcc,
                transparent: true,
                opacity:     0.1,
                blending:    THREE.AdditiveBlending,
            })
        );
        barGlow.position.set(-barWidth / 2, -10, 0.05);
        barGlow.geometry.translate(barWidth / 2, 0, 0);
        scene.add(barGlow);

        // ─────────────────────────────────────────
        // 7. PARTICULES — poussière autour de l'ADN
        // ─────────────────────────────────────────
        const dustCount = 800;
        const dustGeo   = new THREE.BufferGeometry();
        const dustPos   = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount; i++) {
            const angle  = Math.random() * Math.PI * 2;
            const radius = 3 + Math.random() * 5;
            const y      = (Math.random() - 0.5) * DNA_HEIGHT * 1.2;
            dustPos[i * 3]     = Math.cos(angle) * radius;
            dustPos[i * 3 + 1] = y;
            dustPos[i * 3 + 2] = Math.sin(angle) * radius;
        }

        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
            color:       0x00aaff,
            size:        0.08,
            transparent: true,
            opacity:     0.4,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        })));

        // ─────────────────────────────────────────
        // 8. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="dnaControls" style="
                display:flex; gap:12px; align-items:center;
                margin-top:14px; background:rgba(2,2,15,0.95);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#00ffcc;font-size:13px;">Vitesse rotation</label>
                <input type="range" id="dnaRotSpeed" min="0.1" max="3" value="1" step="0.1"
                    style="width:90px; accent-color:#00ffcc;">

                <button id="dnaResetBtn" style="
                    color:#fff; background:rgba(0,200,150,0.2);
                    border:1px solid rgba(0,200,150,0.5);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⟳ Relancer</button>

                <button id="dnaPauseBtn" style="
                    color:#fff; background:rgba(100,100,200,0.3);
                    border:1px solid rgba(100,100,255,0.4);
                    padding:5px 14px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>
            </div>
        `;
        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let rotSpeed = 1;
let running  = true;
    let rafId = null;
    let moduleApi = null;

        document.getElementById('dnaRotSpeed').addEventListener('input', e => {
            rotSpeed = +e.target.value;
        });
        document.getElementById('dnaResetBtn').addEventListener('click', () => {
            simulateLoading();
        });
        document.getElementById('dnaPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('dnaPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 9. ANIMATION
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;

        function animate() {
            if (!running) return;
            rafId = requestAnimationFrame(animate);

            timer.update();
            const delta  = timer.getDelta();
            elapsed     += delta * rotSpeed;

            // ── Rotation de l'ADN
            spheres1.forEach((s, i) => {
                const d = s.userData;
                const newAngle = d.angle + elapsed * 0.5;
                s.position.x = Math.cos(newAngle) * DNA_RADIUS;
                s.position.z = Math.sin(newAngle) * DNA_RADIUS;

                // Allumage progressif selon le chargement
                const lit = d.t <= progress;
                s.material.color.setHex(lit ? 0x00ffcc : 0x112233);
                s.scale.setScalar(lit ? 1 + Math.sin(elapsed * 2 + i * 0.3) * 0.1 : 0.5);
            });

            spheres2.forEach((s, i) => {
                const d = s.userData;
                const newAngle = d.angle + elapsed * 0.5;
                s.position.x = Math.cos(newAngle) * DNA_RADIUS;
                s.position.z = Math.sin(newAngle) * DNA_RADIUS;

                const lit = d.t <= progress;
                s.material.color.setHex(lit ? 0xaa44ff : 0x112233);
                s.scale.setScalar(lit ? 1 + Math.sin(elapsed * 2 + i * 0.3 + 1) * 0.1 : 0.5);
            });

            // ── Ponts — s'allument avec le progrès
            bridges.forEach((bridge, i) => {
                const d   = bridge.userData;
                const s1  = spheres1[i];
                const s2  = spheres2[i];
                const lit = d.t <= progress;

                // Mise à jour des positions du pont
                const pts = bridge.geometry.attributes.position;
                pts.setXYZ(0, s1.position.x, s1.position.y, s1.position.z);
                pts.setXYZ(1, s2.position.x, s2.position.y, s2.position.z);
                pts.needsUpdate = true;

                bridge.material.color.setHex(lit ? 0x00ffcc : 0x223344);
                bridge.material.opacity = lit ? 0.8 : 0.2;
            });

            // ── Barre de progression
            barFill.scale.x  = progress;
            barGlow.scale.x  = progress;

            // ── Caméra — orbite lente
            camera.position.x = Math.sin(elapsed * 0.2) * 5;
            camera.position.y = Math.cos(elapsed * 0.15) * 2;
            camera.lookAt(0, 0, 0);

            // ── Fade out global
            if (fadeOut > 0) {
                renderer.domElement.style.opacity = 1 - fadeOut;
            }

            composer.render();
        }


        rafId = requestAnimationFrame(animate);

        // Module API
        const pause = () => { running = false; };
        const resume = () => { running = true; rafId = requestAnimationFrame(animate); };
        const dispose = () => {
            if (rafId) cancelAnimationFrame(rafId);
            if (loadInterval) clearInterval(loadInterval);
            if (fadeInterval) clearInterval(fadeInterval);
            renderer.dispose();
            composer.dispose();
            // Dispose meshes
            [...spheres1, ...spheres2, ...bridges, barBg, barFill, barGlow].forEach(obj => {
                obj.geometry.dispose();
                obj.material.dispose();
            });
        };

        return { pause, resume, dispose };
    })();

}
