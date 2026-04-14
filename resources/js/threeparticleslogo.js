// threeparticleslogo.js

import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const canvas = document.getElementById("particlesLogoCanvas");

if (!canvas) {
    console.error("Canvas particlesLogoCanvas introuvable");
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
    camera.position.set(0, 0, 40);
    camera.lookAt(0, 0, 0);

    // ─────────────────────────────────────────
    // 2. LUMIÈRES
    // ─────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x111122, 3));

    const light1 = new THREE.PointLight(0x7f77dd, 4, 100);
    light1.position.set(-20, 20, 20);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x00ccff, 4, 100);
    light2.position.set(20, -20, 20);
    scene.add(light2);

    // ─────────────────────────────────────────
    // 3. SYSTÈME DE PARTICULES
    // ─────────────────────────────────────────
    const PARTICLE_COUNT = 18000;

    const geometry  = new THREE.BufferGeometry();

    // Position actuelle (ce qu'on voit)
    const positions  = new Float32Array(PARTICLE_COUNT * 3);
    // Position de départ (explosion depuis le centre)
    const origins    = new Float32Array(PARTICLE_COUNT * 3);
    // Position cible (le logo)
    const targets    = new Float32Array(PARTICLE_COUNT * 3);
    // Couleurs
    const colors     = new Float32Array(PARTICLE_COUNT * 3);
    // Vitesse individuelle de chaque particule
    const speeds     = new Float32Array(PARTICLE_COUNT);
    // Délai de départ (pas toutes en même temps)
    const delays     = new Float32Array(PARTICLE_COUNT);

    // Init — positions aléatoires dans une sphère
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const r  = 20 + Math.random() * 15;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);

        origins[i3]     = r * Math.sin(phi) * Math.cos(theta);
        origins[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        origins[i3 + 2] = r * Math.cos(phi);

        positions[i3]     = origins[i3];
        positions[i3 + 1] = origins[i3 + 1];
        positions[i3 + 2] = origins[i3 + 2];

        // Couleurs — dégradé violet → cyan
        const t = Math.random();
        colors[i3]     = 0.5 + t * 0.3;   // R
        colors[i3 + 1] = 0.5 - t * 0.3;   // G
        colors[i3 + 2] = 1.0;             // B

        speeds[i] = 0.5 + Math.random() * 1.5;
        delays[i] = Math.random() * 1.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('vColorData',    new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
        vertexShader: `
            attribute vec3 vColorData;
            varying vec3 vColor;
            varying float vDepth;

            void main() {
                vColor = vColorData;
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vDepth = -mvPos.z;

                gl_PointSize = max(3.5, 3.5 * (30.0 / -mvPos.z));

                gl_Position   = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vDepth;

            void main() {
                vec2  uv   = gl_PointCoord - 0.5;
                float dist = length(uv);
                if (dist > 0.5) discard;
                float glow  = pow(1.0 - smoothstep(0.0, 0.5, dist), 2.0);
                gl_FragColor = vec4(vColor * glow, glow * 0.9);
            }
        `,
        transparent:  true,
        vertexColors: true,
        depthWrite:   false,
        blending:     THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ─────────────────────────────────────────
    // 4. GÉNÉRER LES POSITIONS CIBLES (le logo)
    // via TextGeometry échantillonnée
    // ─────────────────────────────────────────
    let logoLoaded = false;

    function samplePointsFromGeometry(geo, count) {
        const pos = geo.attributes.position;
        const result = [];

        // Calculer les aires des triangles pour pondérer l'échantillonnage
        const triangleCount = Math.floor(pos.count / 3);
        
        for (let i = 0; i < count; i++) {
            // Choisir un triangle aléatoire
            const tri = Math.floor(Math.random() * triangleCount) * 3;
            
            // Coordonnées barycentiques aléatoires (distribution uniforme)
            let r1 = Math.random();
            let r2 = Math.random();
            if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
            const r3 = 1 - r1 - r2;

            result.push(
                pos.getX(tri) * r1 + pos.getX(tri+1) * r2 + pos.getX(tri+2) * r3,
                pos.getY(tri) * r1 + pos.getY(tri+1) * r2 + pos.getY(tri+2) * r3,
                pos.getZ(tri) * r1 + pos.getZ(tri+1) * r2 + pos.getZ(tri+2) * r3,
            );
        }
        return result;
    }

    const loader = new FontLoader();
    loader.load(
        'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
        (font) => {
            // Créer le texte juste pour échantillonner ses points
            // (on ne l'ajoute pas à la scène)
            const lines = [
                { text: 'SOLIDEO', offsetY: 4,  size: 5 },
                { text: 'DIGITAL', offsetY: -4, size: 4.2 },
            ];

            let allPoints = [];

            lines.forEach(({ text, offsetY, size }) => {
                const geo = new TextGeometry(text, {
                    font,
                    size,
                    depth: 1,
                    curveSegments: 18,
                });
                geo.computeBoundingBox();
                const centerX = (geo.boundingBox.max.x - geo.boundingBox.min.x) / 2;

                // Décaler pour centrer
                geo.translate(-centerX, offsetY, 0);

                const sampled = samplePointsFromGeometry(
                    geo,
                    Math.floor(PARTICLE_COUNT * (text.length / 13))
                );
                allPoints = allPoints.concat(sampled);
                geo.dispose();
            });

            // Remplir jusqu'à PARTICLE_COUNT
            while (allPoints.length < PARTICLE_COUNT * 3) {
                const idx = Math.floor(Math.random() * allPoints.length / 3) * 3;
                allPoints.push(
                    allPoints[idx]     + (Math.random() - 0.5) * 0.5,
                    allPoints[idx + 1] + (Math.random() - 0.5) * 0.5,
                    allPoints[idx + 2] + (Math.random() - 0.5) * 0.5,
                );
            }

            // Assigner les positions cibles
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                targets[i * 3]     = allPoints[i * 3]     ?? 0;
                targets[i * 3 + 1] = allPoints[i * 3 + 1] ?? 0;
                targets[i * 3 + 2] = allPoints[i * 3 + 2] ?? 0;
            }

            logoLoaded = true;
        }
    );

    // ─────────────────────────────────────────
    // 5. ÉTATS
    // ─────────────────────────────────────────
    // assembled  — particules forment le logo
    // exploded   — particules explosent dans tous les sens
    // floating   — particules flottent librement
    const STATES = ['assembled', 'exploded', 'floating'];
    let state       = 'exploded';
    let progress    = 0;
    let autoState   = true;
    let autoTimer   = 0;
    const AUTO_DUR  = 4;

    // Positions "explosées" — recalculées à chaque explosion
    const explodedPos = new Float32Array(PARTICLE_COUNT * 3);
    function generateExploded() {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3  = i * 3;
            const r   = 15 + Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            explodedPos[i3]     = r * Math.sin(phi) * Math.cos(theta);
            explodedPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            explodedPos[i3 + 2] = r * Math.cos(phi) * 0.3; // aplati en Z
        }
    }
    generateExploded();

    // Positions flottantes — dérive lente
    const floatOffsets = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        floatOffsets[i] = (Math.random() - 0.5) * 0.02;
    }

    // ─────────────────────────────────────────
    // 6. CONTRÔLES UI
    // ─────────────────────────────────────────
    const controlsHTML = `
        <div id="logoControls" style="
            display:flex; gap:12px; align-items:center;
            margin-top:14px; background:rgba(5,5,20,0.9);
            padding:10px 20px; border-radius:30px;
            flex-wrap:wrap; justify-content:center;
            font-family:sans-serif;
        ">
            <button id="btnAssemble" style="
                color:#fff; background:rgba(127,119,221,0.3);
                border:1px solid rgba(127,119,221,0.6);
                padding:6px 16px; border-radius:20px;
                cursor:pointer; font-size:13px;">
                ◎ Assembler
            </button>
            <button id="btnExplode" style="
                color:#fff; background:rgba(255,68,100,0.3);
                border:1px solid rgba(255,68,100,0.6);
                padding:6px 16px; border-radius:20px;
                cursor:pointer; font-size:13px;">
                ✦ Exploser
            </button>
            <button id="btnFloat" style="
                color:#fff; background:rgba(0,204,255,0.2);
                border:1px solid rgba(0,204,255,0.5);
                padding:6px 16px; border-radius:20px;
                cursor:pointer; font-size:13px;">
                ~ Flotter
            </button>

            <label style="color:#9988dd;font-size:13px;">Vitesse</label>
            <input type="range" id="logoSpeed" min="0.2" max="4" value="1.2" step="0.1"
                style="width:80px; accent-color:#7f77dd;">

            <button id="autoLogoBtn" style="
                color:#fff; background:rgba(255,170,0,0.2);
                border:1px solid rgba(255,170,0,0.4);
                padding:6px 14px; border-radius:20px;
                cursor:pointer; font-size:13px;">
                ⟳ Auto ON
            </button>
        </div>
    `;

    canvas.insertAdjacentHTML('afterend', controlsHTML);

    let transitionSpeed = 1.2;
    let fromPositions   = new Float32Array(positions);
    let toPositions     = new Float32Array(PARTICLE_COUNT * 3);

    function startTransition(newState) {
        if (!logoLoaded && newState === 'assembled') return;
        fromPositions.set(positions);
        state    = newState;
        progress = 0;

        if (newState === 'assembled') {
            toPositions.set(targets);
        } else if (newState === 'exploded') {
            generateExploded();
            toPositions.set(explodedPos);
        } else {
            // floating — positions actuelles + offsets aléatoires
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3;
                toPositions[i3]     = (Math.random() - 0.5) * 30;
                toPositions[i3 + 1] = (Math.random() - 0.5) * 20;
                toPositions[i3 + 2] = (Math.random() - 0.5) * 10;
            }
        }
    }

    document.getElementById('btnAssemble').addEventListener('click', () => {
        autoState = false;
        document.getElementById('autoLogoBtn').textContent = '⟳ Auto OFF';
        startTransition('assembled');
    });
    document.getElementById('btnExplode').addEventListener('click', () => {
        autoState = false;
        document.getElementById('autoLogoBtn').textContent = '⟳ Auto OFF';
        startTransition('exploded');
    });
    document.getElementById('btnFloat').addEventListener('click', () => {
        autoState = false;
        document.getElementById('autoLogoBtn').textContent = '⟳ Auto OFF';
        startTransition('floating');
    });
    document.getElementById('logoSpeed').addEventListener('input', e => {
        transitionSpeed = +e.target.value;
    });
    document.getElementById('autoLogoBtn').addEventListener('click', () => {
        autoState = !autoState;
        document.getElementById('autoLogoBtn').textContent =
            autoState ? '⟳ Auto ON' : '⟳ Auto OFF';
    });

    // ─────────────────────────────────────────
    // 7. INTERACTION SOURIS
    // ─────────────────────────────────────────
    let mouseX = 0, mouseY = 0;
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / W - 0.5) * 2;
        mouseY = ((e.clientY - rect.top)  / H - 0.5) * 2;
    });

    // ─────────────────────────────────────────
    // 8. ANIMATION
    // ─────────────────────────────────────────
    const timer   = new THREE.Timer();
    let   elapsed = 0;
    let   stateIndex = 0;

    function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // Démarre avec une explosion depuis le centre
    startTransition('exploded');
    setTimeout(() => {
        if (logoLoaded) startTransition('assembled');
    }, 2000);

    function animate() {
        requestAnimationFrame(animate);

        timer.update();
        const delta = timer.getDelta();
        elapsed += delta;

        // ── Auto état
        if (autoState && logoLoaded) {
            autoTimer += delta;
            if (autoTimer >= AUTO_DUR && progress >= 1) {
                autoTimer  = 0;
                stateIndex = (stateIndex + 1) % STATES.length;
                startTransition(STATES[stateIndex]);
            }
        }

        // ── Interpolation des positions
        if (progress < 1) {
            progress = Math.min(1, progress + delta * transitionSpeed);
        }
        const t = easeInOut(Math.min(progress, 1));

        const posArr = geometry.attributes.position.array;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3    = i * 3;
            const delay = delays[i] * (1 - transitionSpeed * 0.1);
            const tp    = Math.max(0, Math.min(1,
                (progress - delay * 0.1) / (1 - delay * 0.1 * 0.5)
            ));
            const te = easeInOut(tp);

            // Lerp position
            posArr[i3]     = fromPositions[i3]     + (toPositions[i3]     - fromPositions[i3])     * te;
            posArr[i3 + 1] = fromPositions[i3 + 1] + (toPositions[i3 + 1] - fromPositions[i3 + 1]) * te;
            posArr[i3 + 2] = fromPositions[i3 + 2] + (toPositions[i3 + 2] - fromPositions[i3 + 2]) * te;

            // Micro-flottement en état assembled
            if (state === 'assembled' && progress >= 1) {
                posArr[i3]     += Math.sin(elapsed * 0.8 + i * 0.01) * 0.015;
                posArr[i3 + 1] += Math.cos(elapsed * 0.6 + i * 0.01) * 0.015;
            }

            // Dérive en état floating
            if (state === 'floating' && progress >= 1) {
                posArr[i3]     += floatOffsets[i3]     * Math.sin(elapsed + i);
                posArr[i3 + 1] += floatOffsets[i3 + 1] * Math.cos(elapsed + i);
            }
        }

        geometry.attributes.position.needsUpdate = true;

        // ── Rotation de la scène selon souris
        points.rotation.y += (mouseX * 0.4 - points.rotation.y) * 0.04;
        points.rotation.x += (-mouseY * 0.2 - points.rotation.x) * 0.04;

        // ── Lumières orbitales
        light1.position.x = Math.cos(elapsed * 0.5) * 25;
        light1.position.z = Math.sin(elapsed * 0.5) * 25;
        light2.position.x = Math.cos(elapsed * 0.5 + Math.PI) * 25;
        light2.position.z = Math.sin(elapsed * 0.5 + Math.PI) * 25;

        renderer.render(scene, camera);
    }

    animate();
}