import * as THREE from 'three';

export function init() {

    (function () {

        const canvas = document.getElementById("cubeCanvas");

        if (!canvas) {
            console.error("Canvas introuvable");
            return;
        }

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
        renderer.setClearColor(0x1a1a4d); // fond bleu

        camera.position.z = 5;

        // ─────────────────────────────
        // CUBE (équivalent vertex + index)
        // ─────────────────────────────
        const geometry = new THREE.BoxGeometry();

        // Couleurs par face (équivalent WebGPU)
        const colors = [
            0xff0000, // rouge
            0x00ff00, // vert
            0x0000ff, // bleu
            0xffff00, // jaune
            0xff00ff, // magenta
            0x00ffff  // cyan
        ];

        const materials = colors.map(color =>
            new THREE.MeshBasicMaterial({ color: color })
        );

        const cube = new THREE.Mesh(geometry, materials);
        scene.add(cube);

        // ─────────────────────────────
        // ANIMATION (équivalent matrices)
        // ─────────────────────────────
        function animate(time) {
            time *= 0.001;

            cube.rotation.y = time;
            cube.rotation.x = time * 0.5;

            renderer.render(scene, camera);

            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);

    })();
}