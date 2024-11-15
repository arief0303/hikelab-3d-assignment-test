import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fragment_basic from '../shaders/fragment_basic.glsl';
import vertex_basic from '../shaders/vertex_basic.glsl';
import * as dat from 'dat.gui';
import {
  CSS2DRenderer,
  CSS2DObject
} from 'three/addons/renderers/CSS2DRenderer.js';

const device = {
  width: window.innerWidth,
  height: window.innerHeight - 1, //-1 to avoid scrollbars
  pixelRatio: window.devicePixelRatio
};
const positions = [
  new THREE.Vector3(0.1544611227187961, 0.3664286103969783, -0.6357591595224292),
  new THREE.Vector3(0.15537351775953057, 0.17429947248569583, -0.7126326331841278),
];
const modelUrl = 'assets/gltf/bunny.gltf';
const albedoMap = new THREE.TextureLoader().load('assets/textures/Albedo.jpg');
const cloudTexture = new THREE.TextureLoader().load('assets/textures/2k_earth_clouds.jpg'); // Load the cloud texture
// Animation progress variable
let animationProgress = 0;
const delhi = positions[0];
const bengaluru = positions[1];
const midpoint = new THREE.Vector3().addVectors(delhi, bengaluru).multiplyScalar(0.5);

const controlPoints = [delhi, midpoint, bengaluru];
const scaleFactor = 1.1;
const scaledControlPoints = controlPoints.map((point, index) => {
  if (index === 0 || index === controlPoints.length - 1) return point;
  return point.clone().multiplyScalar(scaleFactor);
});

const curve = new THREE.CatmullRomCurve3(scaledControlPoints);
const points = curve.getPoints(100);
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
const spline = new THREE.Line(geometry, material);

const cities = ['Delhi', 'Bengaluru'];
const shadowQualityMultiplier = 4;
// const marker = new THREE.Mesh(markerGeometry, markerMaterial);
// Create a marker that will animate along the spline
let airplane;
const cityMarkers = [];
const cityTori = [];

export default class Three {
  constructor(canvas) {
    this.canvas = document.querySelector('#canvas');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, 0, 20);

    this.camera = new THREE.PerspectiveCamera(
      75,
      device.width / device.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 4);
    this.camera.rotation.x += 0.001;
    this.camera.rotation.y += 0.001;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.shadowMap.enabled = true; // enable shadows in the renderer
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; // default is false
    this.controls.dampingFactor = 0.025; // This value could be adjusted to your liking
    this.controls.minPolarAngle = 0; // radians
    this.controls.maxPolarAngle = Math.PI / 2; // radians
    this.controls.minDistance = 1; // Minimum distance the camera can zoom in
    this.controls.maxDistance = 1.5; // Maximum distance the camera can zoom out
    this.controls.enablePan = false; // Disable panning
    this.controls.autoRotate = false;
    this.controls.enableZoom = true;

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setLights();
    this.setGeometry();
    // this.devGUIParams();
    this.render();
    this.raycasterListener();
    this.setResize();
  }

  setLights() {

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1); // white color, full intensity
    this.sunLight.position.set(15, 50, 30);
    this.sunLight.castShadow = true;

    // Increase the shadow map size
    this.sunLight.shadow.mapSize.width = 1024 * shadowQualityMultiplier; // default is 512
    this.sunLight.shadow.mapSize.height = 1024 * shadowQualityMultiplier; // default is 512

    // Adjust the shadow bias and radius (optional)
    this.sunLight.shadow.radius = 30; // Adjust this value as needed

    // Adjust the shadow camera (optional)
    this.sunLight.shadow.camera.near = 0.5; // default
    this.sunLight.shadow.camera.far = 500; // default
    this.scene.add(this.sunLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white light
    this.scene.add(this.ambientLight);
  }

  setGeometry() {
    this.planeGeometry = new THREE.PlaneGeometry(1, 1, 128 / 8, 128 / 8);
    this.planeMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      wireframe: true,
      fragmentShader: fragment_basic,
      vertexShader: vertex_basic,
      uniforms: {
        progress: { type: 'f', value: 0 }
      }
    });
    this.planeMesh = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
    this.planeMesh.position.set(0, 0.5, 2);
    this.planeMesh.castShadow = true;
    // this.scene.add(this.planeMesh);

    this.earthGeometry = new THREE.SphereGeometry(0.75, 128, 128);
    this.earthMaterial = new THREE.MeshStandardMaterial({
      map: albedoMap
    });
    this.earthMesh = new THREE.Mesh(this.earthGeometry, this.earthMaterial);
    this.earthMesh.castShadow = true;
    this.earthMesh.position.set(0, 0, 0);
    this.earthMesh.rotation.y = Math.PI / 0.9;
    this.scene.add(this.earthMesh);

    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.boxMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff });
    this.boxMesh = new THREE.Mesh(this.boxGeometry, this.boxMaterial);
    this.boxMesh.castShadow = true; // enable shadow casting
    this.boxMesh.position.set(-1, 0, 0);
    // this.scene.add(this.boxMesh);

    this.floorGeometry = new THREE.PlaneGeometry(10000, 10000);
    this.floorMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff });
    this.floorMesh = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
    this.floorMesh.receiveShadow = true; // enable shadow receiving
    this.floorMesh.position.y = -1; // Set the plane at the bottom of the scene
    this.floorMesh.rotation.x = -Math.PI / 2; // Rotate the plane to be horizontal
    this.scene.add(this.floorMesh);

    for (let i = 0; i < cities.length; i++) {
      const markerGeometry = new THREE.SphereGeometry(0.004, 30, 30);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Create a new material instance for each marker
      const marker = new THREE.Mesh(markerGeometry, markerMaterial); // Create a new marker instance for each city
      marker.position.copy(positions[i]);
      cityMarkers.push(marker); // Store the marker in the array
      this.earthMesh.add(marker);

      // Create a torus surrounding each marker
      const torusGeometry = new THREE.TorusGeometry(0.009, 0.001, 16, 100); // Adjusted parameters for a smaller torus
      const torusMaterial = new THREE.MeshBasicMaterial({ color: cities[i] === 'Delhi' ? 0xff0000 : 0x0000ff }); // Red for Delhi, blue for others
      const torus = new THREE.Mesh(torusGeometry, torusMaterial);
      torus.position.copy(positions[i]);

      // Rotate the torus to be parallel with the earthMesh while accounting for curvature
      const normal = new THREE.Vector3().copy(positions[i]).normalize();
      torus.lookAt(normal);
      cityTori.push(torus);
      this.earthMesh.add(torus);
    }

    this.earthMesh.add(spline);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    // this.labelRenderer.domElement.style.zIndex = -1;
    document.body.appendChild(this.labelRenderer.domElement);

    window.addEventListener('click', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.raycaster.intersectObjects(
        this.earthMesh.children
      );

      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;

        // Hide all labels
        this.earthMesh.children.forEach((child) => {
          if (child.userData.labelElement && child !== intersectedObject) {
            child.userData.labelElement.style.visibility = 'hidden';
          }
        });

        // Toggle the visibility of the clicked marker's label
        if (intersectedObject.userData.labelElement) {
          intersectedObject.userData.labelElement.style.visibility =
            intersectedObject.userData.labelElement.style.visibility ===
              'visible'
              ? 'hidden'
              : 'visible';
        }
      }
    });

    // Create a white material
    const skyboxMaterial = new THREE.MeshPhysicalMaterial({
      emissive: 0xffffff, // white color
      side: THREE.BackSide, // backside to make it visible from inside the cube
      reflectivity: 0, // no reflectivity
      clearcoat: 0, // no clearcoat
      roughness: 1, // maximum roughness
      metalness: 0 // no metalness
    });
    const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    this.scene.add(skybox);

    // Load the airplane model
    const loader = new GLTFLoader();
    loader.load('/assets/gltf/airplane.glb', (gltf) => {
      airplane = gltf.scene;
      airplane.scale.set(0.0001, 0.0001, 0.0001); // Adjust the scale as needed
      airplane.rotation.y = Math.PI / 2;
      airplane.rotation.x = Math.PI / -2.8;

      this.earthMesh.add(airplane);
    });

    // Create the cloud sphere
    const cloudGeometry = new THREE.SphereGeometry(0.76, 128, 128); // Slightly larger than the earthMesh
    const cloudMaterial = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.5
    });
    this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.earthMesh.add(this.cloudMesh);
  }

  devGUIParams() {
    this.gui = new dat.GUI();
    const sunLightFolder = this.gui.addFolder('Sun Light');
    sunLightFolder
      .add(this.sunLight.shadow, 'radius', 0, 100)
      .step(0.1)
      .name('Radius');
    sunLightFolder.open();
    const fogFolder = this.gui.addFolder('Fog');
    fogFolder.add(this.scene.fog, 'far', 5, 250).step(1).name('Far');
    fogFolder.open();
  }

  raycasterListener() {
    /* this.canvas.addEventListener(
      'click',
      this.onMouseClickAddMarker.bind(this),
      false
    );
    this.canvas.addEventListener(
      'touchstart',
      this.onMouseClickAddMarker.bind(this),
      false
    ); */
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this), false);
  }

  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects(cityMarkers);

    // Reset all markers to their original color
    cityMarkers.forEach(marker => marker.material.color.set(0x00ff00));

    // Change color of intersected markers to blue
    for (let i = 0; i < intersects.length; i++) {
      intersects[i].object.material.color.set(0x0000ff);
    }
  }

  onMouseClickAddMarker(event) {
    event.preventDefault();
    // Check if event is a touch event
    if (event.changedTouches) {
      event.clientX = event.changedTouches[0].clientX;
      event.clientY = event.changedTouches[0].clientY;
    }
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([this.earthMesh]);
    if (intersects.length > 0) {
      const markerGeometry = new THREE.SphereGeometry(0.004, 30, 30);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      // Convert the intersection point to the earthMesh's local coordinate system
      marker.position.copy(
        this.earthMesh.worldToLocal(intersects[0].point.clone())
      );
      console.log(
        `Marker placed at coordinates: ${marker.position.x}, ${marker.position.y}, ${marker.position.z}`
      );
      // Add the marker as a child of the earthMesh
      this.earthMesh.add(marker);
    }
  }

  render() {
    const elapsedTime = this.clock.getElapsedTime();

    // Update the animation progress
    animationProgress += 0.001; // Adjust the speed as needed
    if (animationProgress > 1) animationProgress = 0;

    // Update the marker's position along the spline
    // const point = curve.getPointAt(animationProgress);
    // this.planeMesh.rotation.x = 0.2 * elapsedTime;
    // this.planeMesh.rotation.y = 0.1 * elapsedTime;
    // Update the airplane's position along the spline
    if (airplane) {
      const point = curve.getPointAt(animationProgress);
      airplane.position.copy(point);
    }

    // Rotate the cloud layer
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.0005; // Adjust the speed as needed
    }

    // Update the torus radius to create a pulsating effect
  cityTori.forEach(torus => {
    const scale = 1 + 0.5 * Math.sin(elapsedTime * 2); // Adjust the pulsating speed and amplitude
    torus.scale.set(scale, scale, scale);
  });

    // Render labels
    this.labelRenderer.render(this.scene, this.camera);

    // this.earthMesh.rotation.y = 0.1 * elapsedTime;
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = window.innerWidth;
    device.height = window.innerHeight - 1; //-1 to avoid scrollbars

    this.camera.aspect = device.width / device.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
  }
}