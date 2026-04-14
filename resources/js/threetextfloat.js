import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export function init() {

    const canvas = document.getElementById("textFloatCanvas");

    if (!canvas) {
        console.error("Canvas textFloatCanvas introuvable");
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

        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);

        scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);

        // ─────────────────────────────────────────
        // 2. LUMIÈRES
        // ─────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0x222244, 2));

        const mainLight = new THREE.DirectionalLight(0xffffff, 2);
        mainLight.position.set(30, 50, 30);
        mainLight.castShadow = true;
        scene.add(mainLight);

        // Lumières colorées qui donnent la vie
        const light1 = new THREE.PointLight(0x7f77dd, 3, 200);
        light1.position.set(-40, 20, 20);
        scene.add(light1);

        const light2 = new THREE.PointLight(0x00ccff, 3, 200);
        light2.position.set(40, -20, 20);
        scene.add(light2);

        const light3 = new THREE.PointLight(0xff44aa, 2, 150);
        light3.position.set(0, -30, 40);
        scene.add(light3);

        // ─────────────────────────────────────────
        // 3. PARTICULES DE FOND
        // ─────────────────────────────────────────
        const particleCount = 3000;
        const particleGeo   = new THREE.BufferGeometry();
        const particlePos   = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i++) {
            particlePos[i] = (Math.random() - 0.5) * 300;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

        const particleMat = new THREE.PointsMaterial({
            color: 0x7f77dd,
            size: 0.3,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        scene.add(new THREE.Points(particleGeo, particleMat));

        // ─────────────────────────────────────────
        // 4. CHARGEMENT DE LA POLICE + TEXTE 3D
        // ─────────────────────────────────────────
        const letters   = [];   // chaque lettre = mesh séparé
        let   textGroup = null; // groupe contenant toutes les lettres

        const loader = new FontLoader();

        // Police hébergée sur le CDN Three.js
        loader.load(
            'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
            (font) => {
                const lines = [
                    { text: 'SOLIDEO',  y: 12,  scale: 1.0 },
                    { text: 'DIGITAL', y: -8,  scale: 0.85 },
                ];

                textGroup = new THREE.Group();

                lines.forEach(({ text, y, scale }) => {

                    // Créer chaque lettre séparément pour les animer indépendamment
                    let offsetX = 0;
                    const letterSpacing = 0.3;

                    [...text].forEach((char, charIndex) => {

                        const geo = new TextGeometry(char, {
                            font,
                            size:           8 * scale,
                            depth:          2 * scale,       // épaisseur 3D
                            curveSegments:  12,
                            bevelEnabled:   true,
                            bevelThickness: 0.4 * scale,
                            bevelSize:      0.2 * scale,
                            bevelSegments:  5,
                        });

                        geo.computeBoundingBox();
                        const charWidth = geo.boundingBox.max.x - geo.boundingBox.min.x;

                        // Matériau avec reflets
                        const mat = new THREE.MeshPhongMaterial({
                            color:     0x7f77dd,
                            emissive:  0x2a2060,
                            specular:  0xffffff,
                            shininess: 120,
                            transparent: true,
                            opacity: 0,      // commence invisible → fade in
                        });

                        const mesh = new THREE.Mesh(geo, mat);
                        mesh.position.set(offsetX, y, 0);
                        mesh.castShadow = true;

                        // Données d'animation propres à chaque lettre
                        mesh.userData = {
                            baseY:        y,
                            baseX:        offsetX,
                            phase:        charIndex * 0.4,        // décalage de phase
                            floatSpeed:   0.8 + Math.random() * 0.4,
                            floatAmp:     0.8 + Math.random() * 0.6,
                            rotSpeed:     (Math.random() - 0.5) * 0.02,
                            fadeIn:       true,
                            fadeDelay:    charIndex * 0.15,       // entrée en cascade
                            born:         0,
                        };

                        letters.push(mesh);
                        textGroup.add(mesh);

                        offsetX += charWidth + letterSpacing * scale * 8;
                    });

                    // Centrer la ligne
                    textGroup.children.forEach(child => {
                        if (Math.abs(child.userData.baseY - y) < 1) {
                            child.position.x -= offsetX / 2;
                            child.userData.baseX -= offsetX / 2;
                        }
                    });
                });

                scene.add(textGroup);
            }
        );

        // ─────────────────────────────────────────
        // 5. PLAN DE SOL — pour les ombres
        // ─────────────────────────────────────────
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(300, 300),
            new THREE.MeshPhongMaterial({
                color:   0x0a0a1a,
                opacity: 0.5,
                transparent: true,
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -30;
        floor.receiveShadow = true;
        scene.add(floor);

        // ─────────────────────────────────────────
        // 6. CONTRÔLES SOURIS — rotation douce
        // ─────────────────────────────────────────
        let mouseX = 0;
        let mouseY = 0;
        let targetRotX = 0;
        let targetRotY = 0;

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / W - 0.5) * 2;
            mouseY = ((e.clientY - rect.top)  / H - 0.5) * 2;
        });

        // ─────────────────────────────────────────
        // 7. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="textControls" style="
                display:flex; gap:16px; align-items:center;
                margin-top:14px; background:rgba(10,10,30,0.8);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#9988dd;font-size:13px;">Flottement</label>
                <input type="range" id="floatAmp" min="0" max="3" value="1" step="0.1"
                    style="width:90px; accent-color:#7f77dd;">
                <span id="floatAmpVal" style="color:#fff;font-size:13px;min-width:20px;">1</span>

                <label style="color:#9988dd;font-size:13px;">Vitesse</label>
                <input type="range" id="floatSpeed" min="0.1" max="3" value="1" step="0.1"
                    style="width:90px; accent-color:#7f77dd;">
                <span id="floatSpeedVal" style="color:#fff;font-size:13px;min-width:20px;">1</span>

                <label style="color:#9988dd;font-size:13px;">Rotation</label>
                <input type="range" id="rotSpeed" min="0" max="3" value="1" step="0.1"
                    style="width:90px; accent-color:#7f77dd;">
                <span id="rotSpeedVal" style="color:#fff;font-size:13px;min-width:20px;">1</span>

                <button id="textPauseBtn" style="
                    color:#fff; background:rgba(127,119,221,0.3);
                    border:1px solid rgba(255,255,255,0.2);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;
                ">⏸ Pause</button>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let floatAmpMult  = 1;
        let floatSpeedMult = 1;
        let rotSpeedMult  = 1;
        let running       = true;

        document.getElementById('floatAmp').addEventListener('input', e => {
            floatAmpMult = +e.target.value;
            document.getElementById('floatAmpVal').textContent = e.target.value;
        });
        document.getElementById('floatSpeed').addEventListener('input', e => {
            floatSpeedMult = +e.target.value;
            document.getElementById('floatSpeedVal').textContent = e.target.value;
        });
        document.getElementById('rotSpeed').addEventListener('input', e => {
            rotSpeedMult = +e.target.value;
            document.getElementById('rotSpeedVal').textContent = e.target.value;
        });
        document.getElementById('textPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('textPauseBtn').textContent = running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 8. ANIMATION
        // ─────────────────────────────────────────
        const timer = new THREE.Timer();
        let elapsed = 0;

        // Lumières orbitales — changent de couleur et tournent
        const lightColors = [0x7f77dd, 0x00ccff, 0xff44aa, 0x44ffaa, 0xffaa00];
        let colorIndex = 0;

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta = timer.getDelta();
            elapsed += delta;

            // ── Rotation douce de la scène selon la souris
            targetRotY += (mouseX * 0.3 - targetRotY) * 0.05;
            targetRotX += (mouseY * 0.15 - targetRotX) * 0.05;

            if (textGroup) {
                textGroup.rotation.y = targetRotY;
                textGroup.rotation.x = targetRotX;
            }

            // ── Animation lettre par lettre
            letters.forEach((mesh) => {
                const d = mesh.userData;

                // Fade in en cascade
                if (d.fadeIn) {
                    const age = elapsed - d.fadeDelay;
                    if (age > 0) {
                        mesh.material.opacity = Math.min(1, age * 1.5);
                        if (mesh.material.opacity >= 1) d.fadeIn = false;
                    }
                }

                // Flottement — chaque lettre a sa propre phase
                mesh.position.y = d.baseY
                    + Math.sin(elapsed * d.floatSpeed * floatSpeedMult + d.phase)
                    * d.floatAmp * floatAmpMult;

                // Légère rotation individuelle
                mesh.rotation.y += d.rotSpeed * rotSpeedMult;
                mesh.rotation.z  = Math.sin(elapsed * 0.5 + d.phase) * 0.04;
            });

            // ── Lumières orbitales
            const angle = elapsed * 0.5;
            light1.position.x = Math.cos(angle) * 50;
            light1.position.z = Math.sin(angle) * 50;
            light2.position.x = Math.cos(angle + Math.PI) * 50;
            light2.position.z = Math.sin(angle + Math.PI) * 50;
            light3.position.y = Math.sin(elapsed * 0.3) * 30;

            // Changement de couleur des lumières toutes les 3s
            if (Math.floor(elapsed / 3) !== colorIndex) {
                colorIndex = Math.floor(elapsed / 3) % lightColors.length;
                light1.color.setHex(lightColors[colorIndex]);
                light2.color.setHex(lightColors[(colorIndex + 2) % lightColors.length]);
            }

            // ── Rotation lente des particules de fond
            particleGeo.attributes.position.array.forEach((_, i) => {
                if (i % 3 === 0) {
                    particleGeo.attributes.position.array[i] += Math.sin(elapsed + i) * 0.002;
                }
            });
            particleGeo.attributes.position.needsUpdate = true;

            renderer.render(scene, camera);
        }

        animate();
    }
}