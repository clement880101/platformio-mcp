/** Animated concept workbench with a reused device model and two procedural prototypes. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const projects = {
  contact: {
    title: "The lid is the switch.",
    category: "TACTILE INTERFACES",
    description:
      "A copper contact. A ring of light. Turn a simple gesture into an interface.",
    board: "ESP32-S3",
    boardNote: "Arduino · copper-pad input",
    library: "Adafruit NeoPixel",
    url: "https://github.com/adafruit/Adafruit_NeoPixel",
    note: "Addressable light, with GPIO contact sensing.",
    alt: "Animated 3D concept: an ESP32-S3 device with a hinged lid and copper switch contacts",
    color: "#75bfff",
  },
  climate: {
    title: "Give the room a voice.",
    category: "ENVIRONMENTAL SENSING",
    description:
      "Give temperature, humidity, and pressure a place on your desk.",
    board: "ESP32-C3",
    boardNote: "Arduino · BME280 + OLED over I²C",
    library: "Adafruit BME280",
    url: "https://github.com/adafruit/Adafruit_BME280_Library",
    note: "Sensor readings; SSD1306 + GFX for the display.",
    alt: "Animated 3D concept: an environmental sensor with a vented enclosure, floating OLED, BME280 sensor, and ESP32-C3 board",
    color: "#79e4c3",
  },
  rover: {
    title: "Put curiosity on wheels.",
    category: "ROBOTICS + MOTION",
    description:
      "Sense the distance. Steer around it. Give curiosity a pair of wheels.",
    board: "ESP32 DevKit",
    boardNote: "Arduino · TB6612FNG motor driver",
    library: "Pololu VL53L0X",
    url: "https://github.com/pololu/vl53l0x-arduino",
    note: "Time-of-flight ranging, with ESP32 PWM for motion.",
    alt: "Animated 3D concept: a two-wheel explorer robot with an ESP32 board, motor driver and front distance sensor",
    color: "#ffba7a",
  },
};

const stage = document.querySelector("#model-stage");
const canvas = document.querySelector("#idea-canvas");
const fallback = document.querySelector("#model-fallback");
const motionButton = document.querySelector("#motion-toggle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let activeKey = "contact";
let paused = reducedMotion.matches;
let renderer, scene, camera, contactModel, contactPivot, contactLight;
let elapsed = 2,
  reelTime = 0,
  reelIndex = 0,
  readingDetails = false,
  previousTime = 0,
  animationFrame = 0,
  visible = true;
const models = new Map();
const wheels = [];
const floatingParts = [];

/** Create a shared physically lit material for the concept models. */
function material(color, metalness = 0.5, roughness = 0.35, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    ...extra,
  });
}

/** Add one mesh to a model with its local position. */
function shape(parent, geometry, surface, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function box(parent, dimensions, surface, position) {
  const [width, height, depth] = dimensions;
  const bevel = Math.min(width, height, depth) * 0.16;
  const outline = new THREE.Shape();
  outline.moveTo(-width / 2 + bevel, -depth / 2 + bevel);
  outline.lineTo(width / 2 - bevel, -depth / 2 + bevel);
  outline.lineTo(width / 2 - bevel, depth / 2 - bevel);
  outline.lineTo(-width / 2 + bevel, depth / 2 - bevel);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: height - bevel * 2,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geometry.translate(0, 0, -height / 2 + bevel);
  geometry.rotateX(-Math.PI / 2);
  return shape(parent, geometry, surface, position);
}

function cylinder(parent, radius, height, surface, position, segments = 48) {
  return shape(
    parent,
    new THREE.CylinderGeometry(radius, radius, height, segments),
    surface,
    position,
  );
}

/** Build a populated concept PCB with shield, USB socket, pin headers and traces. */
function board(parent, scale = 1) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  parent.add(group);
  const pcb = material("#146255", 0.3, 0.45);
  const metal = material("#bac7d5", 0.85, 0.27);
  const chip = material("#101925", 0.35, 0.5);
  const gold = material("#d5a563", 0.8, 0.28);
  box(group, [1.05, 0.065, 1.7], pcb, [0, 0, 0]);
  box(group, [0.69, 0.17, 0.75], metal, [0, 0.12, -0.25]);
  box(group, [0.3, 0.16, 0.29], metal, [0, 0.1, 0.88]);
  box(group, [0.23, 0.09, 0.02], chip, [0, 0.11, 1.032]);
  box(group, [0.33, 0.1, 0.28], chip, [0, 0.09, 0.39]);
  for (const side of [-1, 1])
    for (let i = 0; i < 9; i++) {
      box(group, [0.08, 0.16, 0.075], gold, [
        side * 0.46,
        0.1,
        -0.68 + i * 0.17,
      ]);
      box(group, [0.16, 0.007, 0.013], gold, [
        side * 0.32,
        0.04,
        -0.68 + i * 0.17,
      ]);
    }
  for (let i = 0; i < 5; i++)
    box(group, [0.07, 0.06, 0.12], chip, [-0.25 + i * 0.13, 0.07, 0.65]);
  return group;
}

/** Draw the device's illustrative OLED screen; these values are explicitly demo data. */
function oledTexture() {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 256;
  const ctx = surface.getContext("2d");
  ctx.fillStyle = "#071923";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#79e4c3";
  ctx.font = "22px monospace";
  ctx.fillText("ATMOSPHERE / DEMO", 30, 44);
  ctx.font = "64px monospace";
  ctx.fillText("22.4°C", 28, 128);
  ctx.font = "25px monospace";
  ctx.fillText("RH 48%   1013 hPa", 30, 181);
  ctx.strokeStyle = "#468d87";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 450; i++) {
    const y = 222 + Math.sin(i * 0.035) * 8;
    if (i === 0) ctx.moveTo(30 + i, y);
    else ctx.lineTo(30 + i, y);
  }
  ctx.stroke();
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Layer a vented sensor enclosure, electronics and floating screen into an exploded view. */
function createClimate() {
  const model = new THREE.Group();
  const shell = material("#243b48", 0.7, 0.3);
  const dark = material("#0e1822", 0.35, 0.5);
  const steel = material("#b7d0d3", 0.85, 0.25);
  box(model, [2.1, 0.18, 2.3], shell, [0, 0.2, 0]);
  for (const x of [-0.97, 0.97])
    box(model, [0.16, 0.65, 2.3], shell, [x, 0.56, 0]);
  for (const z of [-1.07, 1.07])
    box(model, [1.82, 0.65, 0.16], shell, [0, 0.56, z]);
  for (const x of [-1.06, 1.06])
    for (let i = 0; i < 8; i++)
      box(model, [0.01, 0.07, 0.12], dark, [x, 0.61, -0.77 + i * 0.22]);
  const electronics = board(model, 0.92);
  electronics.position.set(-0.16, 0.65, 0);
  floatingParts.push({ part: electronics, height: 0.65, phase: 0 });
  const sensor = new THREE.Group();
  model.add(sensor);
  sensor.position.set(0.63, 1.16, -0.17);
  box(sensor, [0.5, 0.045, 0.66], material("#5a3b87"), [0, 0, 0]);
  box(sensor, [0.2, 0.1, 0.21], steel, [0, 0.08, 0]);
  cylinder(sensor, 0.023, 0.012, dark, [0.025, 0.14, 0]);
  for (let i = 0; i < 4; i++)
    cylinder(sensor, 0.027, 0.08, steel, [-0.17 + i * 0.11, 0.02, 0.25], 12);
  floatingParts.push({ part: sensor, height: 1.16, phase: 1 });
  const screen = new THREE.Group();
  model.add(screen);
  screen.position.set(0, 1.69, 0.11);
  screen.rotation.x = 0.2;
  box(screen, [1.88, 0.12, 1.12], dark, [0, 0, 0]);
  const display = shape(
    screen,
    new THREE.PlaneGeometry(1.65, 0.84),
    new THREE.MeshBasicMaterial({ map: oledTexture() }),
    [0, 0.065, 0],
  );
  display.rotation.x = -Math.PI / 2;
  floatingParts.push({ part: screen, height: 1.69, phase: 2 });
  for (const x of [-0.85, 0.85])
    for (const z of [-0.89, 0.89]) {
      cylinder(model, 0.047, 0.55, steel, [x, 0.51, z]);
    }
  return model;
}

/** Assemble a differential-drive concept with visible motor control and ranging hardware. */
function createRover() {
  const model = new THREE.Group();
  const shell = material("#33414f", 0.8, 0.3);
  const black = material("#101821", 0.15, 0.8);
  const gold = material("#bc813e", 0.75, 0.32);
  const steel = material("#a3b1c1", 0.9, 0.25);
  box(model, [1.8, 0.19, 2.55], shell, [0, 0.53, 0]);
  box(model, [1.35, 0.25, 1.45], black, [0, 0.3, 0.1]);
  for (const side of [-1, 1]) {
    const wheel = new THREE.Group();
    model.add(wheel);
    wheel.position.set(side * 1.13, 0.55, 0.25);
    const tire = cylinder(wheel, 0.56, 0.35, black, [0, 0, 0]);
    tire.rotation.z = Math.PI / 2;
    const hub = cylinder(wheel, 0.36, 0.38, gold, [0, 0, 0]);
    hub.rotation.z = Math.PI / 2;
    const axle = cylinder(wheel, 0.13, 0.41, steel, [0, 0, 0]);
    axle.rotation.z = Math.PI / 2;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const tread = box(wheel, [0.38, 0.085, 0.1], black, [
        0,
        Math.cos(angle) * 0.55,
        Math.sin(angle) * 0.55,
      ]);
      tread.rotation.x = angle;
    }
    wheels.push(wheel);
    const motor = cylinder(model, 0.19, 0.48, steel, [side * 0.66, 0.44, 0.25]);
    motor.rotation.z = Math.PI / 2;
  }
  const pcb = board(model, 0.88);
  pcb.position.set(0, 0.83, 0.25);
  for (const x of [-0.63, 0.63])
    for (const z of [-0.78, 0.85])
      cylinder(model, 0.045, 0.3, gold, [x, 0.75, z]);
  box(model, [0.55, 0.06, 0.45], material("#784043"), [0.5, 0.78, -0.66]);
  box(model, [0.23, 0.12, 0.25], black, [0.5, 0.85, -0.66]);
  box(model, [0.74, 0.45, 0.15], material("#224c65"), [0, 0.94, -1.16]);
  box(model, [0.31, 0.2, 0.09], steel, [0, 0.99, -1.27]);
  for (const x of [-0.073, 0.073]) {
    const lens = cylinder(
      model,
      0.044,
      0.025,
      material("#091524", 0.5, 0.1),
      [x, 1, -1.33],
      24,
    );
    lens.rotation.x = Math.PI / 2;
  }
  shape(model, new THREE.SphereGeometry(0.22, 24, 16), steel, [0, 0.24, -0.92]);
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.5, 0.75, -0.1),
      new THREE.Vector3(side * 0.78, 1.02, 0.1),
      new THREE.Vector3(side * 0.83, 0.45, 0.3),
    ]);
    shape(
      model,
      new THREE.TubeGeometry(curve, 16, 0.022, 6, false),
      material(side > 0 ? "#bb6f36" : "#326b88"),
    );
  }
  return model;
}

/** Update the model and its concise editorial caption together at a reel transition. */
function selectProject(key) {
  activeKey = key;
  const project = projects[key];
  document.querySelector("#project-title").textContent = project.title;
  document.querySelector("#project-description").textContent =
    project.description;
  document.querySelector("#model-category").textContent = project.category;
  const boardNote = document.createElement("span");
  boardNote.textContent = project.boardNote;
  document
    .querySelector("#project-board")
    .replaceChildren(document.createTextNode(project.board), boardNote);
  document.querySelector("#project-index").textContent =
    `0${Object.keys(projects).indexOf(key) + 1} / 03`;
  const link = document.querySelector("#project-library");
  link.href = project.url;
  link.textContent = project.library + " ↗";
  document.querySelector("#project-library-note").textContent = project.note;
  canvas.setAttribute("aria-label", project.alt);
  document
    .querySelector("#idea-lab")
    .style.setProperty("--concept-accent", project.color);
  document
    .querySelectorAll("[data-reel]")
    .forEach((marker) =>
      marker.classList.toggle("active", marker.dataset.reel === key),
    );
  models.forEach((model, id) => {
    model.visible = id === key;
  });
  updateFallback();
  resize();
}

/** Crossfade only between concepts; pause timing while a visitor reads a library link. */
function advanceReel(delta) {
  if (readingDetails || !models.has(activeKey)) {
    canvas.style.opacity = 1;
    details.style.opacity = 1;
    return;
  }
  reelTime += delta;
  const sequence = ["contact", "climate", "rover"].filter((key) =>
    models.has(key),
  );
  const phase = reelTime % 14;
  const nextIndex = Math.floor(reelTime / 14) % sequence.length;
  if (nextIndex !== reelIndex || !models.has(activeKey)) {
    reelIndex = nextIndex;
    selectProject(sequence[nextIndex]);
  }
  const opacity = phase > 13.2 ? (14 - phase) / 0.8 : Math.min(1, phase / 0.8);
  canvas.style.opacity = opacity;
  document.querySelector(".project-details").style.opacity = opacity;
}

function updateFallback() {
  const available = renderer && models.has(activeKey);
  fallback.hidden = Boolean(available);
  canvas.style.visibility = available ? "visible" : "hidden";
}

/** Resize to the panel, keeping GPU work bounded on high-density mobile screens. */
function resize() {
  if (!renderer) return;
  const width = stage.clientWidth,
    height = stage.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.set(3.9, 3.4, 5.4);
  if (camera.aspect < 1.1) camera.position.multiplyScalar(1.14);
  camera.lookAt(
    0,
    activeKey === "contact" ? 1.25 : activeKey === "climate" ? 1 : 0.65,
    0,
  );
  camera.zoom = activeKey === "contact" ? 1 : 1.12;
  camera.updateProjectionMatrix();
  render();
}

/** Apply mechanical and presentation motion without changing the informational content. */
function render() {
  if (!renderer || !scene) return;
  const current = models.get(activeKey);
  if (current)
    current.rotation.y =
      (activeKey === "rover" ? 2.5 : -0.5) + Math.sin(elapsed * 0.16) * 0.28;
  if (contactPivot) {
    const openness = (1 - Math.cos(elapsed * 0.42)) / 2;
    contactPivot.rotation.x = -openness * 1.72;
    if (contactLight)
      contactLight.emissiveIntensity = openness < 0.08 ? 2.8 : 0.1;
  }
  floatingParts.forEach(({ part, height, phase }) => {
    part.position.y = height + Math.sin(elapsed * 0.6 + phase) * 0.045;
  });
  wheels.forEach((wheel) => {
    wheel.rotation.x = elapsed * 0.22;
  });
  renderer.render(scene, camera);
}

function animate(now) {
  animationFrame = 0;
  if (paused || !visible || document.hidden || !renderer) {
    previousTime = 0;
    return;
  }
  if (previousTime) {
    const delta = Math.min((now - previousTime) / 1000, 0.05);
    elapsed += delta;
    advanceReel(delta);
  }
  previousTime = now;
  render();
  animationFrame = requestAnimationFrame(animate);
}

function resumeIfNeeded() {
  if (!animationFrame && !paused && visible && !document.hidden && renderer)
    animationFrame = requestAnimationFrame(animate);
}

const details = document.querySelector(".project-details");
details.addEventListener("pointerenter", () => {
  readingDetails = true;
});
details.addEventListener("pointerleave", () => {
  readingDetails = details.contains(document.activeElement);
});
details.addEventListener("focusin", () => {
  readingDetails = true;
});
details.addEventListener("focusout", () => {
  readingDetails = details.matches(":hover");
});
function syncMotionButton() {
  motionButton.textContent = paused ? "▶" : "Ⅱ";
  motionButton.setAttribute(
    "aria-label",
    paused ? "Play concept reel" : "Pause concept reel",
  );
  motionButton.title = paused ? "Play concept reel" : "Pause concept reel";
  if (paused) {
    canvas.style.opacity = 1;
    details.style.opacity = 1;
  }
  motionButton.setAttribute("aria-pressed", String(paused));
}
motionButton.addEventListener("click", () => {
  paused = !paused;
  syncMotionButton();
  resumeIfNeeded();
});
reducedMotion.addEventListener("change", (event) => {
  paused = event.matches;
  syncMotionButton();
  resumeIfNeeded();
});
document.addEventListener("visibilitychange", resumeIfNeeded);
syncMotionButton();

async function initialize() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    scene.environment = pmrem.fromScene(environment, 0.04).texture;
    scene.environmentIntensity = 0.9;
    environment.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight("#c5e5ff", "#16243c", 1.4));
    const key = new THREE.DirectionalLight("#d4e9ff", 3);
    key.position.set(3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4,
      near: 0.5,
      far: 18,
    });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.035;
    key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#448eff", 3);
    rim.position.set(-4, 3, -3);
    scene.add(rim);
    const warm = new THREE.DirectionalLight("#ffd1a8", 1.5);
    warm.position.set(3, 2, -4);
    scene.add(warm);
    const floor = shape(
      scene,
      new THREE.CircleGeometry(4.8, 96),
      new THREE.ShadowMaterial({ color: "#00040b", opacity: 0.36 }),
      [0, -0.13, 0],
    );
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    const climate = createClimate();
    climate.visible = false;
    models.set("climate", climate);
    scene.add(climate);
    const rover = createRover();
    rover.visible = false;
    models.set("rover", rover);
    scene.add(rover);
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        resumeIfNeeded();
      },
      { threshold: 0.01 },
    ).observe(stage);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      renderer = null;
      document.querySelector("#model-status").textContent =
        "3D view paused by your browser. Reload to restore it.";
      updateFallback();
    });
    resize();
    resumeIfNeeded();
    try {
      const gltf = await new GLTFLoader().loadAsync(
        "assets/models/copper-contact.glb",
      );
      contactModel = gltf.scene;
      const remove = [];
      contactModel.traverse((object) => {
        if (object.name === "StudioFloor" || object.isCamera || object.isLight)
          remove.push(object);
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
        if (object.material?.name === "AmberDiffuser")
          contactLight = object.material;
      });
      remove.forEach((object) => object.removeFromParent());
      contactPivot = contactModel.getObjectByName("LidPivot");
      contactModel.visible = activeKey === "contact";
      models.set("contact", contactModel);
      scene.add(contactModel);
      updateFallback();
      render();
    } catch {
      document.querySelector("#model-status").textContent =
        "Explore the next hardware concept.";
      selectProject("climate");
      render();
    }
  } catch {
    renderer = null;
    document.querySelector("#model-status").textContent =
      "3D preview needs WebGL. Explore the project notes below.";
    updateFallback();
    motionButton.hidden = true;
  }
}
initialize();
