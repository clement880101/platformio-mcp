/** Animated hardware concepts with detailed procedural models and a reused device asset. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const REEL_SECONDS = 6;
const FADE_SECONDS = 0.35;
const mobileRenderer = window.matchMedia("(max-width: 700px)").matches;

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
  arm: {
    title: "Give an idea a hand.",
    category: "PRECISION MOTION",
    description:
      "Reach, grip, repeat. Turn a motion sequence into something tangible.",
    board: "ESP32-S3",
    boardNote: "Arduino · PCA9685 + servo joints",
    library: "Adafruit PWM Servo Driver",
    url: "https://github.com/adafruit/Adafruit-PWM-Servo-Driver-Library",
    note: "I²C servo control; a separate supply powers the motors.",
    alt: "Animated 3D concept: an articulated servo arm with machined links, rotating joints, a two-finger gripper, and an ESP32 controller",
    color: "#c4a5ff",
  },
  garden: {
    title: "Listen to what grows.",
    category: "CONNECTED GROWING",
    description:
      "Read the soil. Follow the trend. Give your plants a voice before they wilt.",
    board: "ESP32-C3",
    boardNote: "Arduino · capacitive soil sensor",
    library: "Adafruit seesaw",
    url: "https://github.com/adafruit/Adafruit_Seesaw",
    note: "Soil moisture and temperature readings over I²C.",
    alt: "Animated 3D concept: a ceramic planter with curved leaves, a capacitive soil probe, and a connected ESP32 monitor",
    color: "#b5e99b",
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
let armShoulder, armElbow, armWrist, armTurret, gardenPlant, gardenIndicator;
const gripperFingers = [];

/** Create a shared physically lit material for the concept models. */
function material(color, metalness = 0.5, roughness = 0.35, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    clearcoat: metalness > 0.6 ? 0.22 : 0.08,
    clearcoatRoughness: 0.28,
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
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geometry.translate(0, 0, -height / 2 + bevel);
  geometry.rotateX(-Math.PI / 2);
  return shape(parent, geometry, surface, position);
}

function cylinder(parent, radius, height, surface, position, segments = 64) {
  return shape(
    parent,
    new THREE.CylinderGeometry(radius, radius, height, segments),
    surface,
    position,
  );
}

/** Shared silkscreen and routing keep small electronics legible at presentation scale. */
function boardTexture() {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 832;
  const ctx = surface.getContext("2d");
  ctx.fillStyle = "#0d443c";
  ctx.fillRect(0, 0, 512, 832);
  ctx.strokeStyle = "#2b7160";
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const y = 75 + i * 53;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(256 + side * 205, y);
      ctx.lineTo(256 + side * 150, y);
      ctx.lineTo(256 + side * 105, y + 24);
      ctx.lineTo(256 + side * 105, y + 60);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#c9d9c5";
  ctx.lineWidth = 2;
  ctx.strokeRect(69, 105, 374, 410);
  ctx.font = "18px monospace";
  ctx.fillStyle = "#c9d9c5";
  ctx.fillText("ESP32", 175, 580);
  ctx.font = "13px monospace";
  ctx.fillText("3V3  GND  TX  RX", 150, 700);
  for (let i = 0; i < 9; i++) {
    ctx.fillText(String(i + 1).padStart(2, "0"), 12, 83 + i * 82);
    ctx.fillText(String(i + 10), 478, 83 + i * 82);
  }
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}
let pcbTexture;

/** Machined fasteners catch the key light without adding interface clutter. */
function screw(parent, position, radius = 0.055) {
  const head = cylinder(
    parent,
    radius,
    0.035,
    material("#a4b2c0", 0.94, 0.24),
    position,
    24,
  );
  box(
    head,
    [radius * 1.3, 0.004, radius * 0.22],
    material("#14202c", 0.4, 0.5),
    [0, 0.019, 0],
  );
  return head;
}

/** Build a populated concept PCB with shield, USB socket, pin headers and traces. */
function board(parent, scale = 1) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  parent.add(group);
  const pcb = material("#0d443c", 0.12, 0.45);
  const metal = material("#bac7d5", 0.85, 0.27);
  const chip = material("#101925", 0.35, 0.5);
  const gold = material("#d5a563", 0.8, 0.28);
  box(group, [1.05, 0.065, 1.7], pcb, [0, 0, 0]);
  pcbTexture ??= boardTexture();
  const silkscreen = shape(
    group,
    new THREE.PlaneGeometry(1.04, 1.69),
    material("#ffffff", 0.12, 0.48, { map: pcbTexture }),
    [0, 0.034, 0],
  );
  silkscreen.rotation.x = -Math.PI / 2;
  silkscreen.castShadow = false;
  box(group, [0.69, 0.17, 0.75], metal, [0, 0.12, -0.25]);
  box(
    group,
    [0.57, 0.003, 0.62],
    material("#7e8d99", 0.95, 0.38),
    [0, 0.207, -0.25],
  );
  for (let i = 0; i < 6; i++) {
    box(group, [0.055, 0.04, 0.13], metal, [-0.22 + i * 0.088, 0.07, 0.55]);
    box(group, [0.06, 0.045, 0.065], material("#9d865e", 0.45, 0.5), [
      -0.22 + i * 0.088,
      0.072,
      0.56,
    ]);
  }
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
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

/** Layer a vented sensor enclosure, electronics and floating screen into an exploded view. */
function createClimate() {
  const model = new THREE.Group();
  const shell = material("#253e4b", 0.82, 0.26);
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
  const screenTexture = oledTexture();
  const display = shape(
    screen,
    new THREE.PlaneGeometry(1.65, 0.84),
    new THREE.MeshPhysicalMaterial({
      map: screenTexture,
      emissiveMap: screenTexture,
      emissive: "#ffffff",
      emissiveIntensity: 0.3,
      roughness: 0.19,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    }),
    [0, 0.065, 0],
  );
  display.rotation.x = -Math.PI / 2;
  for (const x of [-0.86, 0.86])
    for (const z of [-0.47, 0.47]) screw(screen, [x, 0.073, z], 0.032);
  floatingParts.push({ part: screen, height: 1.69, phase: 2 });
  for (const x of [-0.85, 0.85])
    for (const z of [-0.89, 0.89]) {
      cylinder(model, 0.047, 0.55, steel, [x, 0.51, z]);
      screw(model, [x, 0.805, z]);
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
    for (const face of [-1, 1]) {
      const sidewall = shape(
        wheel,
        new THREE.TorusGeometry(0.46, 0.045, 12, 64),
        black,
        [face * 0.168, 0, 0],
      );
      sidewall.rotation.y = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const bolt = screw(
          wheel,
          [face * 0.204, Math.cos(angle) * 0.255, Math.sin(angle) * 0.255],
          0.027,
        );
        bolt.rotation.z = (-face * Math.PI) / 2;
      }
    }
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
    for (const z of [-0.78, 0.85]) {
      cylinder(model, 0.045, 0.3, gold, [x, 0.75, z]);
      screw(model, [x, 0.91, z], 0.05);
    }
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
      new THREE.TubeGeometry(curve, 32, 0.022, 10, false),
      material(side > 0 ? "#bb6f36" : "#326b88"),
    );
  }
  return model;
}

/** A cable follows a deliberate curve between physical components. */
function cable(parent, points, color, radius = 0.024) {
  return shape(
    parent,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point)),
      ),
      32,
      radius,
      10,
      false,
    ),
    material(color, 0.15, 0.55),
  );
}

/** Articulated desktop arm with concentric bearings, paired links, and a working gripper. */
function createArm() {
  const model = new THREE.Group();
  const alloy = material("#72798e", 0.9, 0.25);
  const violet = material("#51456f", 0.78, 0.3);
  const rubber = material("#141924", 0.05, 0.78);
  const brass = material("#d5b17b", 0.9, 0.26);
  box(model, [2.5, 0.15, 2.05], violet, [0, 0.12, 0]);
  for (const x of [-1.03, 1.03])
    for (const z of [-0.8, 0.8]) {
      cylinder(model, 0.13, 0.12, rubber, [x, -0.01, z]);
      screw(model, [x, 0.215, z], 0.065);
    }
  const controller = board(model, 0.57);
  controller.position.set(0.73, 0.27, 0.24);
  box(model, [0.43, 0.05, 0.63], material("#215b6a"), [-0.81, 0.24, 0.48]);
  for (let i = 0; i < 6; i++)
    box(model, [0.045, 0.1, 0.2], brass, [-0.96 + i * 0.06, 0.3, 0.53]);
  cylinder(model, 0.64, 0.15, alloy, [0, 0.29, -0.24]);
  cylinder(model, 0.54, 0.22, rubber, [0, 0.44, -0.24]);
  armTurret = new THREE.Group();
  armTurret.position.set(0, 0.56, -0.24);
  model.add(armTurret);
  cylinder(armTurret, 0.57, 0.1, violet, [0, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    screw(
      armTurret,
      [Math.cos(angle) * 0.45, 0.065, Math.sin(angle) * 0.45],
      0.035,
    );
  }
  function joint(parent, radius) {
    const axle = cylinder(parent, radius, 0.55, rubber, [0, 0, 0]);
    axle.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const bearing = cylinder(parent, radius * 0.83, 0.07, alloy, [
        0,
        0,
        side * 0.29,
      ]);
      bearing.rotation.x = Math.PI / 2;
      const cap = cylinder(parent, radius * 0.49, 0.08, brass, [
        0,
        0,
        side * 0.33,
      ]);
      cap.rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const bolt = screw(
          parent,
          [
            Math.cos(angle) * radius * 0.65,
            Math.sin(angle) * radius * 0.65,
            side * 0.34,
          ],
          0.025,
        );
        bolt.rotation.x = (side * Math.PI) / 2;
      }
    }
  }
  function link(parent, length) {
    for (const z of [-0.2, 0.2]) {
      box(parent, [0.27, length, 0.1], violet, [0, length / 2, z]);
      box(parent, [0.095, length * 0.62, 0.025], alloy, [
        0,
        length / 2,
        z + Math.sign(z) * 0.06,
      ]);
    }
    cable(
      parent,
      [
        [0.16, 0.05, 0],
        [0.26, length * 0.4, 0],
        [0.19, length * 0.85, 0],
        [0.02, length, 0],
      ],
      "#bf8b46",
      0.022,
    );
  }
  armShoulder = new THREE.Group();
  armShoulder.position.y = 0.28;
  armTurret.add(armShoulder);
  joint(armShoulder, 0.28);
  link(armShoulder, 1.02);
  armElbow = new THREE.Group();
  armElbow.position.y = 1.02;
  armShoulder.add(armElbow);
  joint(armElbow, 0.235);
  link(armElbow, 0.87);
  armWrist = new THREE.Group();
  armWrist.position.y = 0.87;
  armElbow.add(armWrist);
  joint(armWrist, 0.18);
  box(armWrist, [0.52, 0.22, 0.35], alloy, [0, 0.22, 0]);
  for (const side of [-1, 1]) {
    const finger = new THREE.Group();
    finger.position.set(side * 0.19, 0.3, 0);
    armWrist.add(finger);
    box(finger, [0.1, 0.36, 0.17], violet, [0, 0.16, 0]);
    box(finger, [0.19, 0.08, 0.17], rubber, [-side * 0.06, 0.34, 0]);
    gripperFingers.push({ finger, side });
  }
  cable(
    model,
    [
      [-0.8, 0.3, 0.3],
      [-0.65, 0.5, 0],
      [-0.3, 0.38, -0.1],
    ],
    "#a480d7",
    0.027,
  );
  return model;
}

/** Build a curved leaf with a center ridge and a tapered organic silhouette. */
function leafGeometry(length, width) {
  const vertices = [],
    indices = [];
  const segments = 20;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const halfWidth = (Math.pow(Math.sin(Math.PI * t), 0.8) * width) / 2;
    const lift = Math.sin(Math.PI * t) * length * 0.24 - t * t * length * 0.16;
    for (const side of [-1, 0, 1])
      vertices.push(
        side * halfWidth,
        lift + (side === 0 ? Math.sin(Math.PI * t) * 0.045 : 0),
        t * length,
      );
    if (i < segments)
      for (let strip = 0; strip < 2; strip++) {
        const a = i * 3 + strip,
          b = a + 3;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Ceramic planter, living canopy, capacitive probe, and a separate connected monitor. */
function createGarden() {
  const model = new THREE.Group();
  const ceramic = material("#a8b7ab", 0.08, 0.3, { clearcoat: 0.5 });
  const graphite = material("#1a2830", 0.65, 0.35);
  const soil = material("#302920", 0, 0.96);
  const profile = [
    [0.55, 0.03],
    [0.6, 0.04],
    [0.64, 0.12],
    [0.8, 1.03],
    [0.81, 1.14],
    [0.78, 1.19],
    [0.73, 1.17],
    [0.71, 1.06],
    [0.56, 0.16],
    [0.55, 0.03],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Group();
  pot.position.set(-0.38, 0, 0.1);
  model.add(pot);
  shape(pot, new THREE.LatheGeometry(profile, 96), ceramic);
  cylinder(pot, 0.7, 0.075, soil, [0, 1.06, 0]);
  const foot = shape(
    pot,
    new THREE.TorusGeometry(0.6, 0.033, 12, 96),
    graphite,
    [0, 0.06, 0],
  );
  foot.rotation.x = Math.PI / 2;
  for (let i = 0; i < 44; i++) {
    const angle = i * 2.399963;
    const radius = Math.sqrt((i + 1) / 44) * 0.64;
    const grain = shape(
      pot,
      new THREE.IcosahedronGeometry(0.025 + (i % 4) * 0.008),
      material(i % 3 ? "#514537" : "#8a8070", 0, 0.95),
      [Math.cos(angle) * radius, 1.105, Math.sin(angle) * radius],
    );
    grain.scale.y = 0.5;
  }
  gardenPlant = new THREE.Group();
  gardenPlant.position.y = 1.1;
  pot.add(gardenPlant);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399963;
    const height = 0.45 + (i % 3) * 0.2;
    const crown = new THREE.Group();
    crown.position.set(Math.sin(angle) * 0.1, height, Math.cos(angle) * 0.1);
    crown.rotation.y = angle;
    crown.rotation.x = -0.45 - (i % 2) * 0.25;
    gardenPlant.add(crown);
    cable(
      gardenPlant,
      [
        [0, 0, 0],
        [0, height * 0.6, 0],
        [crown.position.x, height, crown.position.z],
      ],
      "#527447",
      0.015,
    );
    const length = 0.65 + (i % 3) * 0.15;
    shape(
      crown,
      leafGeometry(length, 0.42 + (i % 2) * 0.13),
      material(i % 2 ? "#275b35" : "#3d713c", 0.02, 0.65, {
        clearcoat: 0,
        specularIntensity: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    cable(
      crown,
      [
        [0, 0.01, 0],
        [0, length * 0.23, length * 0.45],
        [0, -length * 0.15, length],
      ],
      "#9aae69",
      0.007,
    );
  }
  const probe = new THREE.Group();
  probe.position.set(0.47, 1.15, 0.32);
  probe.rotation.z = -0.12;
  pot.add(probe);
  box(probe, [0.19, 0.71, 0.04], material("#195d51", 0.2, 0.45), [0, -0.1, 0]);
  box(probe, [0.095, 0.09, 0.025], graphite, [0, 0.17, 0.032]);
  for (const side of [-1, 1])
    box(probe, [0.025, 0.35, 0.007], material("#bbab6c", 0.8, 0.3), [
      side * 0.06,
      -0.14,
      0.025,
    ]);
  const monitor = new THREE.Group();
  monitor.position.set(0.9, 0.16, 0.3);
  model.add(monitor);
  box(monitor, [0.78, 0.21, 1.15], graphite, [0, 0, 0]);
  const controller = board(monitor, 0.55);
  controller.position.y = 0.16;
  for (const x of [-0.3, 0.3])
    for (const z of [-0.46, 0.46]) screw(monitor, [x, 0.12, z], 0.035);
  gardenIndicator = material("#b5e99b", 0.05, 0.26, {
    emissive: "#75c966",
    emissiveIntensity: 0.6,
  });
  shape(
    monitor,
    new THREE.SphereGeometry(0.035, 20, 12),
    gardenIndicator,
    [0.29, 0.13, 0.38],
  );
  cable(
    model,
    [
      [0.11, 1.36, 0.45],
      [0.6, 1.26, 0.64],
      [0.78, 0.35, 0.76],
      [0.9, 0.24, 0.72],
    ],
    "#6f9b87",
    0.023,
  );
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
    `${String(Object.keys(projects).indexOf(key) + 1).padStart(2, "0")} / ${String(Object.keys(projects).length).padStart(2, "0")}`;
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
  const sequence = Object.keys(projects).filter((key) => models.has(key));
  const phase = reelTime % REEL_SECONDS;
  const nextIndex = Math.floor(reelTime / REEL_SECONDS) % sequence.length;
  if (nextIndex !== reelIndex || !models.has(activeKey)) {
    reelIndex = nextIndex;
    selectProject(sequence[nextIndex]);
  }
  const linearOpacity =
    phase > REEL_SECONDS - FADE_SECONDS
      ? (REEL_SECONDS - phase) / FADE_SECONDS
      : Math.min(1, phase / FADE_SECONDS);
  const opacity = linearOpacity * linearOpacity * (3 - 2 * linearOpacity);
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
    { contact: 1.4, climate: 1, rover: 0.65, arm: 1.35, garden: 1.15 }[
      activeKey
    ],
    0,
  );
  camera.zoom = {
    contact: 0.91,
    climate: 1.12,
    rover: 1.12,
    arm: 0.98,
    garden: 1.07,
  }[activeKey];
  camera.updateProjectionMatrix();
  render();
}

/** Apply mechanical and presentation motion without changing the informational content. */
function render() {
  if (!renderer || !scene) return;
  const current = models.get(activeKey);
  if (current)
    current.rotation.y =
      (activeKey === "rover"
        ? 2.5
        : ["arm", "garden"].includes(activeKey)
          ? 0.6
          : -0.5) +
      Math.sin(elapsed * 0.16) * 0.28;
  if (contactPivot) {
    const openness = (1 - Math.cos(elapsed * 0.8)) / 2;
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
  if (armShoulder) {
    armTurret.rotation.y = Math.sin(elapsed * 0.45) * 0.25;
    armShoulder.rotation.z = -0.38 + Math.sin(elapsed * 0.65) * 0.16;
    armElbow.rotation.z = 1.25 + Math.sin(elapsed * 0.65 + 0.8) * 0.24;
    armWrist.rotation.z = 0.6 + Math.sin(elapsed * 0.65 + 1.6) * 0.18;
    gripperFingers.forEach(({ finger, side }) => {
      finger.rotation.z = side * (0.12 + (1 + Math.sin(elapsed * 1.15)) * 0.12);
    });
  }
  if (gardenPlant) {
    gardenPlant.rotation.z = Math.sin(elapsed * 0.75) * 0.025;
    gardenPlant.rotation.x = Math.sin(elapsed * 0.6) * 0.018;
    gardenIndicator.emissiveIntensity =
      0.45 + (1 + Math.sin(elapsed * 1.2)) * 0.15;
  }
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
      powerPreference: "default",
    });
    renderer.setPixelRatio(
      mobileRenderer
        ? Math.min(window.devicePixelRatio, 1.75)
        : Math.min(Math.max(window.devicePixelRatio, 1.75), 2.5),
    );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    scene.environment = pmrem.fromScene(environment, 0.04).texture;
    scene.environmentIntensity = 1.15;
    environment.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight("#e2efff", "#172338", 0.75));
    const key = new THREE.DirectionalLight("#f0f5ff", 4);
    key.position.set(3, 7, 5);
    key.castShadow = true;
    const shadowSize = mobileRenderer ? 1024 : 2048;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(key.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4,
      near: 0.5,
      far: 18,
    });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#76acff", 2.5);
    rim.position.set(-4, 3, -3);
    scene.add(rim);
    const warm = new THREE.DirectionalLight("#ffe0bd", 2);
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
    for (const [key, build] of [
      ["arm", createArm],
      ["garden", createGarden],
    ]) {
      const model = build();
      model.visible = false;
      models.set(key, model);
      scene.add(model);
    }
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
      const upgradedMaterials = new Map();
      contactModel.traverse((object) => {
        if (object.name === "StudioFloor" || object.isCamera || object.isLight)
          remove.push(object);
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          if (object.material && !Array.isArray(object.material)) {
            const source = object.material;
            if (!upgradedMaterials.has(source)) {
              const finish = new THREE.MeshPhysicalMaterial();
              THREE.MeshStandardMaterial.prototype.copy.call(finish, source);
              finish.defines = { STANDARD: "", PHYSICAL: "" };
              finish.clearcoat = source.metalness > 0.5 ? 0.25 : 0.1;
              finish.clearcoatRoughness = 0.22;
              if (source.name === "Graphite") finish.roughness = 0.32;
              if (source.name === "Copper") finish.roughness = 0.23;
              upgradedMaterials.set(source, finish);
            }
            object.material = upgradedMaterials.get(source);
          }
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
