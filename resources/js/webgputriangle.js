import * as THREE from 'three';

export function init() {

    (function () {

        const canvas = document.getElementById("triangleCanvas");

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
            75,
            canvas.width / canvas.height,
            0.1,
            1000
        );

        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });

        renderer.setSize(canvas.width, canvas.height, false);

        camera.position.z = 2;

        // ─────────────────────────────
        // TRIANGLE (équivalent shader)
        // ─────────────────────────────
        const geometry = new THREE.BufferGeometry();

        const vertices = new Float32Array([
            0.0,  0.5, 0.0,
            -0.5, -0.5, 0.0,
            0.5, -0.5, 0.0
        ]);

        const colors = new Float32Array([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);

        geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        });

        const triangle = new THREE.Mesh(geometry, material);
        scene.add(triangle);

        // ─────────────────────────────
        // ÉTAT
        // ─────────────────────────────
        let isRunning = false;
        let speed = 1.0;
        let timeAccum = 0;
        let lastTimestamp = null;

        // ─────────────────────────────
        // EVENTS
        // ─────────────────────────────
        canvas.addEventListener("click", () => {
            isRunning = !isRunning;

            if (isRunning) {
                lastTimestamp = null;
                requestAnimationFrame(render);
            }

        });

        canvas.addEventListener("dblclick", () => {
            speed = speed === 1.0 ? 3.0 : 1.0;
        });

        // ─────────────────────────────
        // RENDER LOOP
        // ─────────────────────────────
        function render(timestamp) {
            if (!isRunning) return;

            if (lastTimestamp === null) lastTimestamp = timestamp;

            const delta = (timestamp - lastTimestamp) * 0.001;
            lastTimestamp = timestamp;
            timeAccum += delta;

            // Rotation (équivalent shader)
            triangle.rotation.z = timeAccum * speed;

            renderer.render(scene, camera);

            requestAnimationFrame(render);
        }

        // ─────────────────────────────
        // RENDER INITIAL
        // ─────────────────────────────
        renderer.setClearColor(0x1a1a4d); // équivalent fond bleu
        renderer.render(scene, camera);

    })();
}