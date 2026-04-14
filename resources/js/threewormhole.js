import * as THREE from 'three';

export function init() {

    const canvas = document.getElementById("wormholeCanvas");

    if (!canvas) {
        console.error("Canvas wormholeCanvas introuvable");
    } else {
        const W = canvas.width;
        const H = canvas.height;

        // ─────────────────────────────────────────
        // 1. SETUP
        // ─────────────────────────────────────────
        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(90, W / H, 0.1, 500);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000005, 1);

        camera.position.set(0, 0, 0);

        // ─────────────────────────────────────────
        // 2. COURBE DU TUNNEL — CatmullRomCurve3
        // Une courbe qui serpente dans l'espace 3D
        // La caméra va suivre ce chemin
        // ─────────────────────────────────────────
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(  0,   0,    0),
            new THREE.Vector3( 10,   5,  -40),
            new THREE.Vector3(-15,  -8,  -80),
            new THREE.Vector3(  5,  12, -120),
            new THREE.Vector3(-10,  -5, -160),
            new THREE.Vector3( 15,   8, -200),
            new THREE.Vector3(  0,   0, -240),
            new THREE.Vector3( 10,  -10,-280),
            new THREE.Vector3(-8,    6, -320),
            new THREE.Vector3(  0,   0, -360),
        ], true); // true = courbe fermée (loop)

        // ─────────────────────────────────────────
        // 3. TUNNEL — TubeGeometry
        // Génère un tube autour de la courbe
        // ─────────────────────────────────────────
        const tubeGeo = new THREE.TubeGeometry(
            curve,
            300,    // segments le long du tube
            4,      // rayon du tube
            12,     // segments radiaux (sections circulaires)
            true    // fermé
        );

        const tubeMaterial = new THREE.ShaderMaterial({
            side: THREE.BackSide,   // on est À L'INTÉRIEUR du tube
            uniforms: {
                uTime:  { value: 0 },
                uSpeed: { value: 1 },
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;

                void main() {
                    vUv      = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec2  vUv;
                varying vec3  vPosition;

                // Fonction de bruit simple
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(hash(i),             hash(i + vec2(1,0)), u.x),
                        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
                        u.y
                    );
                }

                void main() {
                    // UV animés — défilement le long du tube
                    vec2 animUv = vec2(vUv.x * 8.0, vUv.y - uTime * 0.3);

                    // Couches de bruit pour texture organique
                    float n1 = noise(animUv * 3.0);
                    float n2 = noise(animUv * 6.0 + vec2(1.7, 9.2));
                    float n3 = noise(animUv * 12.0 + vec2(8.3, 2.8));
                    float n  = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

                    // Lignes de vitesse — filaments lumineux
                    float lines = abs(sin(vUv.y * 80.0 - uTime * 4.0)) ;
                    lines = pow(lines, 8.0) * 0.6;

                    // Anneau de bord — halo sur les bords du tunnel
                    float edge = abs(vUv.x - 0.5) * 2.0;
                    float rim  = pow(edge, 3.0) * 0.5;

                    // Couleurs — dégradé bleu/violet/cyan selon bruit
                    vec3 col1 = vec3(0.05, 0.1,  0.6);   // bleu profond
                    vec3 col2 = vec3(0.4,  0.05, 0.8);   // violet
                    vec3 col3 = vec3(0.0,  0.8,  1.0);   // cyan

                    vec3 baseColor = mix(col1, col2, n);
                    baseColor      = mix(baseColor, col3, lines);
                    baseColor     += col3 * rim;

                    // Pulsation de luminosité
                    float pulse = 0.8 + sin(uTime * 2.0 + vUv.y * 20.0) * 0.2;
                    baseColor   *= pulse;

                    // Scintillement
                    float spark = step(0.998, hash(floor(animUv * 50.0)));
                    baseColor  += vec3(1.0) * spark;

                    gl_FragColor = vec4(baseColor, 1.0);
                }
            `,
        });

        const tube = new THREE.Mesh(tubeGeo, tubeMaterial);
        scene.add(tube);

        // ─────────────────────────────────────────
        // 4. ANNEAUX — effet de profondeur
        // ─────────────────────────────────────────
        const ringCount = 40;
        const rings     = [];

        for (let i = 0; i < ringCount; i++) {
            const t   = i / ringCount;
            const pos = curve.getPoint(t);
            const tan = curve.getTangent(t);

            const ringGeo = new THREE.TorusGeometry(4, 0.04, 8, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color:       new THREE.Color().setHSL(t, 0.8, 0.6),
                transparent: true,
                opacity:     0.4,
                blending:    THREE.AdditiveBlending,
                depthWrite:  false,
            });

            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(pos);
            ring.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                tan.normalize()
            );
            scene.add(ring);
            rings.push({ mesh: ring, t, hue: t });
        }

        // ─────────────────────────────────────────
        // 5. PARTICULES dans le tunnel
        // ─────────────────────────────────────────
        const partCount = 2000;
        const partGeo   = new THREE.BufferGeometry();
        const partPos   = new Float32Array(partCount * 3);
        const partT     = new Float32Array(partCount); // position sur la courbe

        for (let i = 0; i < partCount; i++) {
            partT[i] = Math.random();
            const p  = curve.getPoint(partT[i]);
            const r  = Math.random() * 3.5;
            const a  = Math.random() * Math.PI * 2;
            partPos[i * 3]     = p.x + Math.cos(a) * r;
            partPos[i * 3 + 1] = p.y + Math.sin(a) * r;
            partPos[i * 3 + 2] = p.z;
        }

        partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));

        const partMat = new THREE.PointsMaterial({
            color:       0x88aaff,
            size:        0.08,
            transparent: true,
            opacity:     0.6,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        scene.add(new THREE.Points(partGeo, partMat));

        // ─────────────────────────────────────────
        // 6. CONTRÔLES UI
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="wormholeControls" style="
                display:flex; gap:16px; align-items:center;
                margin-top:14px; background:rgba(0,0,20,0.9);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#88aaff;font-size:13px;">Vitesse</label>
                <input type="range" id="wormSpeed" min="0.1" max="5" value="1" step="0.1"
                    style="width:100px; accent-color:#7f77dd;">
                <span id="wormSpeedVal" style="color:#fff;font-size:13px;min-width:20px;">1</span>

                <label style="color:#88aaff;font-size:13px;">FOV</label>
                <input type="range" id="wormFov" min="60" max="140" value="90" step="5"
                    style="width:100px; accent-color:#7f77dd;">
                <span id="wormFovVal" style="color:#fff;font-size:13px;min-width:30px;">90°</span>

                <button id="wormPauseBtn" style="
                    color:#fff; background:rgba(127,119,221,0.3);
                    border:1px solid rgba(127,119,221,0.5);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⏸ Pause</button>

                <button id="wormBoostBtn" style="
                    color:#fff; background:rgba(0,200,255,0.2);
                    border:1px solid rgba(0,200,255,0.4);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;">⚡ Boost</button>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        let speed   = 1;
        let running = true;
        let boosting = false;

        document.getElementById('wormSpeed').addEventListener('input', e => {
            speed = +e.target.value;
            document.getElementById('wormSpeedVal').textContent = e.target.value;
        });

        document.getElementById('wormFov').addEventListener('input', e => {
            camera.fov = +e.target.value;
            camera.updateProjectionMatrix();
            document.getElementById('wormFovVal').textContent = e.target.value + '°';
        });

        document.getElementById('wormPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('wormPauseBtn').textContent =
                running ? '⏸ Pause' : '▶ Play';
        });

        // Boost — accélération temporaire
        document.getElementById('wormBoostBtn').addEventListener('click', () => {
            boosting = true;
            setTimeout(() => { boosting = false; }, 2000);
        });

        // ─────────────────────────────────────────
        // 7. ANIMATION — caméra suit la courbe
        // ─────────────────────────────────────────
        const timer   = new THREE.Timer();
        let   elapsed = 0;
        let   camT    = 0;   // position 0→1 sur la courbe

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta      = timer.getDelta();
            elapsed         += delta;
            const curSpeed   = boosting ? speed * 4 : speed;

            // Avance sur la courbe
            camT = (camT + delta * curSpeed * 0.015) % 1;

            // Position et orientation de la caméra
            const camPos  = curve.getPoint(camT);
            const lookAt  = curve.getPoint((camT + 0.01) % 1);

            camera.position.copy(camPos);
            camera.lookAt(lookAt);

            // Légère oscillation latérale — sensation d'ivresse
            camera.position.x += Math.sin(elapsed * 0.7) * 0.3;
            camera.position.y += Math.cos(elapsed * 0.5) * 0.2;

            // Update uniforms du tunnel
            tubeMaterial.uniforms.uTime.value  += delta * curSpeed;
            tubeMaterial.uniforms.uSpeed.value  = curSpeed;

            // Anneaux — pulsation et changement de couleur
            rings.forEach(({ mesh, t, hue }, i) => {
                const dist = Math.abs(t - camT);
                const proximity = 1 - Math.min(dist, 1 - dist) * 10;
                mesh.material.opacity = 0.1 + Math.max(0, proximity) * 0.6;
                mesh.material.color.setHSL(
                    (hue + elapsed * 0.05) % 1,
                    0.9,
                    0.5 + Math.sin(elapsed * 2 + i) * 0.2
                );
                mesh.scale.setScalar(1 + Math.sin(elapsed * 3 + i * 0.5) * 0.05);
            });

            // Particules — avancent avec la caméra
            const pArr = partGeo.attributes.position.array;
            for (let i = 0; i < partCount; i++) {
                partT[i] = (partT[i] + delta * curSpeed * 0.015) % 1;
                const p  = curve.getPoint(partT[i]);
                const r  = Math.random() < 0.01 ? Math.random() * 3.5 : null;
                if (r !== null) {
                    const a = Math.random() * Math.PI * 2;
                    pArr[i * 3]     = p.x + Math.cos(a) * r;
                    pArr[i * 3 + 1] = p.y + Math.sin(a) * r;
                    pArr[i * 3 + 2] = p.z;
                }
            }
            partGeo.attributes.position.needsUpdate = true;

            // FOV dynamique — s'élargit au boost
            const targetFov = boosting
                ? camera.fov + 15
                : +document.getElementById('wormFov').value;
            camera.fov += (targetFov - camera.fov) * 0.05;
            camera.updateProjectionMatrix();

            renderer.render(scene, camera);
        }

        animate();
    }
}