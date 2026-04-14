import * as THREE from 'three';

export function init() {

    const canvas = document.getElementById("oceanCanvas");

    if (!canvas) {
        console.error("Canvas oceanCanvas introuvable");
    } else {
        const W = canvas.width;
        const H = canvas.height;

        // ─────────────────────────────────────────
        // 1. SETUP
        // ─────────────────────────────────────────
        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

        // Position caméra — vue en plongée légère sur l'océan
        camera.position.set(0, 40, 80);
        camera.lookAt(0, 0, 0);

        // Brouillard — masque les bords du plan
        scene.fog = new THREE.FogExp2(0x0a1628, 0.012);

        // ─────────────────────────────────────────
        // 2. LUMIÈRES
        // ─────────────────────────────────────────

        // Lumière ambiante — éclairage de base
        const ambientLight = new THREE.AmbientLight(0x1a3a6e, 1.5);
        scene.add(ambientLight);

        // Lumière directionnelle — soleil
        const sunLight = new THREE.DirectionalLight(0xffeebb, 2.0);
        sunLight.position.set(50, 80, 30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width  = 2048;
        sunLight.shadow.mapSize.height = 2048;
        scene.add(sunLight);

        // Lumière de remplissage — reflets bleutés depuis le bas
        const fillLight = new THREE.PointLight(0x006994, 1.5, 300);
        fillLight.position.set(-30, 10, -30);
        scene.add(fillLight);

        // ─────────────────────────────────────────
        // 3. GÉOMÉTRIE — plan haute résolution
        // ─────────────────────────────────────────
        // 200x200 subdivisions = 40 000 vertices
        // chacun sera déplacé en Y par le vertex shader
        const geometry = new THREE.PlaneGeometry(200, 200, 200, 200);

        // Rotation pour que le plan soit horizontal
        geometry.rotateX(-Math.PI / 2);

        // ─────────────────────────────────────────
        // 4. SHADER MATERIAL — vagues en GLSL
        // ─────────────────────────────────────────
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:        { value: 0 },
                uWaveHeight:  { value: 3.0 },   // hauteur des vagues
                uWaveSpeed:   { value: 1.0 },   // vitesse
                uColorShallow:{ value: new THREE.Color(0x006994) }, // eau peu profonde
                uColorDeep:   { value: new THREE.Color(0x001428) }, // eau profonde
                uSunPosition: { value: new THREE.Vector3(50, 80, 30) },
            },

            vertexShader: `
                uniform float uTime;
                uniform float uWaveHeight;
                uniform float uWaveSpeed;

                varying vec3 vPosition;
                varying vec3 vNormal;
                varying float vElevation;

                void main() {
                    vec3 pos = position;

                    float t = uTime * uWaveSpeed;

                    // Superposition de plusieurs vagues sin/cos
                    // → résultat organique et non répétitif
                    float wave1 = sin(pos.x * 0.05 + t * 1.2) *
                                cos(pos.z * 0.04 + t * 0.8) * uWaveHeight;

                    float wave2 = sin(pos.x * 0.08 - t * 0.9) *
                                sin(pos.z * 0.07 + t * 1.1) * uWaveHeight * 0.6;

                    float wave3 = cos(pos.x * 0.12 + t * 0.7) *
                                cos(pos.z * 0.11 - t * 1.3) * uWaveHeight * 0.3;

                    // Petites vaguelettes de surface
                    float ripple = sin(pos.x * 0.3 + t * 2.5) *
                                cos(pos.z * 0.25 + t * 2.0) * 0.15;

                    // Élévation finale = somme de toutes les vagues
                    float elevation = wave1 + wave2 + wave3 + ripple;
                    pos.y += elevation;

                    vPosition  = pos;
                    vElevation = elevation;

                    // Calcul approximatif de la normale pour l'éclairage
                    // (différence entre points voisins)
                    float eps = 0.1;
                    float hL = sin((pos.x - eps) * 0.05 + t) * uWaveHeight;
                    float hR = sin((pos.x + eps) * 0.05 + t) * uWaveHeight;
                    float hD = sin((pos.z - eps) * 0.04 + t) * uWaveHeight;
                    float hU = sin((pos.z + eps) * 0.04 + t) * uWaveHeight;
                    vNormal = normalize(vec3(hL - hR, 2.0, hD - hU));

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,

            fragmentShader: `
                uniform vec3 uColorShallow;
                uniform vec3 uColorDeep;
                uniform vec3 uSunPosition;
                uniform float uTime;

                varying vec3 vPosition;
                varying vec3 vNormal;
                varying float vElevation;

                void main() {
                    // Couleur selon profondeur — crêtes plus claires
                    float depth = (vElevation + 3.0) / 6.0;
                    vec3 waterColor = mix(uColorDeep, uColorShallow, depth);

                    // Spéculaire — reflet du soleil sur l'eau
                    vec3 lightDir  = normalize(uSunPosition);
                    vec3 viewDir   = normalize(vec3(0.0, 40.0, 80.0) - vPosition);
                    vec3 halfDir   = normalize(lightDir + viewDir);
                    float specular = pow(max(dot(vNormal, halfDir), 0.0), 64.0);

                    // Écume sur les crêtes des vagues
                    float foam = smoothstep(2.0, 3.5, vElevation);

                    vec3 finalColor = waterColor
                        + vec3(1.0) * specular * 0.8   // reflet soleil
                        + vec3(1.0) * foam * 0.6;      // écume blanche

                    // Légère variation animée — scintillement de surface
                    float sparkle = sin(vPosition.x * 10.0 + uTime * 5.0) *
                                    cos(vPosition.z * 8.0  + uTime * 4.0) * 0.03;
                    finalColor += vec3(sparkle);

                    gl_FragColor = vec4(finalColor, 0.92);
                }
            `,

            transparent: true,
            side: THREE.DoubleSide,
        });

        const ocean = new THREE.Mesh(geometry, material);
        ocean.receiveShadow = true;
        scene.add(ocean);

        // ─────────────────────────────────────────
        // 5. OBJETS DANS LA SCÈNE
        // ─────────────────────────────────────────

        // Sphère brillante — simule le soleil reflété
        const sunSphere = new THREE.Mesh(
            new THREE.SphereGeometry(3, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffeebb })
        );
        sunSphere.position.set(50, 60, -60);
        scene.add(sunSphere);

        // Quelques bouées / rochers qui flottent
        const buoys = [];
        const buoyPositions = [
            [-20, 0, -10], [15, 0, 5], [-5, 0, 20], [30, 0, -20], [-35, 0, 15]
        ];

        buoyPositions.forEach(([x, , z]) => {
            const buoy = new THREE.Mesh(
                new THREE.SphereGeometry(1.2, 8, 8),
                new THREE.MeshPhongMaterial({
                    color: 0xff4444,
                    shininess: 80
                })
            );
            buoy.position.set(x, 0, z);
            buoy.castShadow = true;
            scene.add(buoy);
            buoys.push({ mesh: buoy, baseX: x, baseZ: z });
        });

        // ─────────────────────────────────────────
        // 6. CONTRÔLES — injectés après le canvas
        // ─────────────────────────────────────────
        const controlsHTML = `
            <div id="oceanControls" style="
                display:flex; gap:16px; align-items:center;
                margin-top:14px; background:rgba(0,20,50,0.7);
                padding:10px 20px; border-radius:30px;
                flex-wrap:wrap; justify-content:center;
                font-family:sans-serif;
            ">
                <label style="color:#7ab;font-size:13px;">Hauteur vagues</label>
                <input type="range" id="waveHeight" min="0.5" max="8" value="3" step="0.5"
                    style="width:100px; accent-color:#006994;">
                <span id="waveHeightVal" style="color:#fff;font-size:13px;min-width:20px;">3</span>

                <label style="color:#7ab;font-size:13px;">Vitesse</label>
                <input type="range" id="waveSpeed" min="0.1" max="3" value="1" step="0.1"
                    style="width:100px; accent-color:#006994;">
                <span id="waveSpeedVal" style="color:#fff;font-size:13px;min-width:20px;">1</span>

                <button id="oceanPauseBtn" style="
                    color:#fff; background:rgba(0,100,148,0.4);
                    border:1px solid rgba(255,255,255,0.2);
                    padding:5px 16px; border-radius:20px;
                    cursor:pointer; font-size:13px;
                ">⏸ Pause</button>
            </div>
        `;

        canvas.insertAdjacentHTML('afterend', controlsHTML);

        document.getElementById('waveHeight').addEventListener('input', e => {
            material.uniforms.uWaveHeight.value = +e.target.value;
            document.getElementById('waveHeightVal').textContent = e.target.value;
        });

        document.getElementById('waveSpeed').addEventListener('input', e => {
            material.uniforms.uWaveSpeed.value = +e.target.value;
            document.getElementById('waveSpeedVal').textContent = e.target.value;
        });

        let running = true;
        document.getElementById('oceanPauseBtn').addEventListener('click', () => {
            running = !running;
            document.getElementById('oceanPauseBtn').textContent = running ? '⏸ Pause' : '▶ Play';
        });

        // ─────────────────────────────────────────
        // 7. ANIMATION
        // ─────────────────────────────────────────
        const timer = new THREE.Timer();

        function animate() {
            requestAnimationFrame(animate);
            if (!running) return;

            timer.update();
            const delta = timer.getDelta();
            const t     = (material.uniforms.uTime.value += delta);

            // Faire flotter les bouées sur les vagues
            buoys.forEach(({ mesh, baseX, baseZ }) => {
                const speed = material.uniforms.uWaveSpeed.value;
                const h     = material.uniforms.uWaveHeight.value;

                mesh.position.y =
                    Math.sin(baseX * 0.05 + t * 1.2 * speed) *
                    Math.cos(baseZ * 0.04 + t * 0.8 * speed) * h
                    + Math.sin(baseX * 0.08 - t * 0.9 * speed) *
                    Math.sin(baseZ * 0.07 + t * 1.1 * speed) * h * 0.6;

                // Légère rotation des bouées
                mesh.rotation.z = Math.sin(t * 0.8 + baseX) * 0.2;
                mesh.rotation.x = Math.cos(t * 0.6 + baseZ) * 0.15;
            });

            renderer.render(scene, camera);
        }

        animate();
    }
}