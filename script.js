const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const strokeCanvas = document.createElement("canvas");
const strokeCtx = strokeCanvas.getContext("2d");

const widthSlider = document.getElementById("widthSlider");
const widthValue = document.getElementById("widthValue");

const opacitySlider = document.getElementById("opacitySlider");
const opacityValue = document.getElementById("opacityValue");

const zoomOut = document.getElementById("zoomOut");
const zoomIn = document.getElementById("zoomIn");
const zoomValue = document.getElementById("zoomValue");

const minimapCanvas = document.getElementById("minican");
const minimapCtx = minimapCanvas.getContext("2d");

let minimapDragging = false;

const undoButton = document.getElementById("undoBtn");
const redoButton = document.getElementById("redoBtn");

const pressureButton = document.getElementById("pressTgl");
const menuButton = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");

menuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  menuPanel.classList.toggle("active");
});

menuPanel.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  menuPanel.classList.remove("active");
});

let brush = {
  width: 10,
  opacity: 1,
  color: "#111111",
  pressure: true,
};

const savedSettings = JSON.parse(localStorage.getItem("doodleSettings")) || {};

brush.color = savedSettings.color || brush.color;
brush.width = savedSettings.width || brush.width;
brush.opacity = savedSettings.opacity ?? brush.opacity;
brush.pressure = savedSettings.pressure ?? brush.pressure;

let camera = {
  x: 0,
  y: 0,
  zoom: 1,
};

let currentTool = "draw";

let objects = [];
let redoObjects = [];

let drawing = false;
let points = [];

let startPoint = null;
let lastPoint = null;

let isPanning = false;
let panStart = {
  x: 0,
  y: 0,
};

let activePointer = null;

function saveSettings() {
  localStorage.setItem(
    "doodleSettings",
    JSON.stringify({
      color: brush.color,
      width: brush.width,
      opacity: brush.opacity,
      pressure: brush.pressure,
    }),
  );
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  strokeCanvas.width = canvas.width;
  strokeCanvas.height = canvas.height;

  updateZoom();
  redrawCanvas();
}

function screenToCanvas(x, y) {
  return {
    x: (x - camera.x) / camera.zoom,
    y: (y - camera.y) / camera.zoom,
  };
}

function updateMinimap() {
  const w = minimapCanvas.clientWidth;
  const h = minimapCanvas.clientHeight;

  minimapCanvas.width = w;
  minimapCanvas.height = h;

  minimapCtx.clearRect(0, 0, w, h);

  if (!objects.length) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach((obj) => {
    if (!obj.points) return;

    obj.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
  });

  const scale = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1));

  minimapCtx.save();
  minimapCtx.translate(
    (w - (maxX - minX) * scale) / 2 - minX * scale,
    (h - (maxY - minY) * scale) / 2 - minY * scale,
  );

  objects.forEach((obj) => {
    if (!obj.points || obj.points.length < 2) return;

    minimapCtx.beginPath();
    minimapCtx.moveTo(obj.points[0].x * scale, obj.points[0].y * scale);

    obj.points.slice(1).forEach((p) => {
      minimapCtx.lineTo(p.x * scale, p.y * scale);
    });

    minimapCtx.strokeStyle = obj.color || "#111";
    minimapCtx.lineWidth = 1;
    minimapCtx.stroke();
  });

  minimapCtx.restore();
}
function redrawCanvas() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ececec";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);

  objects.forEach(drawObject);

  if (drawing) {
    drawPreview();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  updateMinimap();
}

function drawObject(object) {
  ctx.save();

  ctx.globalAlpha = object.opacity ?? 1;
  ctx.strokeStyle = object.color || "#111";
  ctx.fillStyle = object.color || "#111";
  ctx.lineWidth = object.width || 2;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (object.type === "draw" || object.type === "eraser") {
    draw(object);
  }

  if (object.type === "line") {
    drawLine(object.start, object.end);
  }

  if (object.type === "rectangle") {
    drawRectangle(object.start, object.end);
  }

  if (object.type === "circle") {
    drawCircle(object.start, object.end);
  }

  if (object.type === "arrow") {
    drawArrow(object.start, object.end);
  }

  ctx.restore();
}

function draw(object) {
  if (!object.points || object.points.length < 2) {
    return;
  }

  strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
  strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
  strokeCtx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);

  strokeCtx.lineCap = "round";
  strokeCtx.lineJoin = "round";
  strokeCtx.globalAlpha = 1;

  strokeCtx.strokeStyle = object.type === "eraser" ? "#000000" : object.color;

  for (let i = 1; i < object.points.length; i++) {
    const previous = object.points[i - 1];
    const point = object.points[i];

    let width = object.width;

    if (object.pressure) {
      const pressure = point.pressure || 0.5;
      width = object.width * (0.4 + pressure * 1.6);
    }

    strokeCtx.lineWidth = width;
    strokeCtx.beginPath();
    strokeCtx.moveTo(previous.x, previous.y);
    strokeCtx.lineTo(point.x, point.y);
    strokeCtx.stroke();
  }

  ctx.globalAlpha = object.opacity;

  if (object.type === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(strokeCanvas, 0, 0);

  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawLine(start, end) {
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function drawRectangle(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  ctx.strokeRect(x, y, width, height);
}

function drawCircle(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const radius = Math.sqrt(dx * dx + dy * dy);

  ctx.beginPath();
  ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawArrow(start, end) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const arrowSize = 12;

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(
    end.x - arrowSize * Math.cos(angle - Math.PI / 6),
    end.y - arrowSize * Math.sin(angle - Math.PI / 6),
  );

  ctx.lineTo(end.x, end.y);
  ctx.lineTo(
    end.x - arrowSize * Math.cos(angle + Math.PI / 6),
    end.y - arrowSize * Math.sin(angle + Math.PI / 6),
  );

  ctx.stroke();
}

function drawPreview() {
  if (!startPoint) {
    return;
  }

  const endPoint = lastPoint || startPoint;
  const preview = {
    type: currentTool,
    start: startPoint,
    end: endPoint,
    color: brush.color,
    width: brush.width,
    opacity: brush.opacity,
  };

  if (currentTool === "draw" || currentTool === "eraser") {
    preview.points = points;
    preview.pressure = brush.pressure;
  }
  drawObject(preview);
}

function startDrawing(event) {
  if (event.button !== 0) {
    return;
  }

  const point = screenToCanvas(event.clientX, event.clientY);

  activePointer = event.pointerId;

  drawing = true;
  startPoint = point;
  lastPoint = point;

  if (currentTool === "draw" || currentTool === "eraser") {
    points = [
      {
        x: point.x,
        y: point.y,
        pressure: event.pressure,
      },
    ];
  }
  canvas.setPointerCapture(event.pointerId);
  redrawCanvas();
}

function moveDrawing(event) {
  if (!drawing) {
    return;
  }

  if (event.pointerId !== activePointer) {
    return;
  }

  const point = screenToCanvas(event.clientX, event.clientY);

  lastPoint = point;
  if (currentTool === "draw" || currentTool === "eraser") {
    points.push({
      x: point.x,
      y: point.y,
      pressure: event.pressure,
    });
  }
  redrawCanvas();
}

function stopDrawing(event) {
  if (!drawing) {
    return;
  }

  if (event.pointerId !== activePointer) {
    return;
  }

  if (currentTool === "draw" || currentTool === "eraser") {
    if (points.length > 1) {
      saveObject({
        type: currentTool,
        points: [...points],
        color: brush.color,
        width: brush.width,
        opacity: brush.opacity,
        pressure: brush.pressure,
      });
    }
  }

  if (
    currentTool === "line" ||
    currentTool === "rectangle" ||
    currentTool === "circle" ||
    currentTool === "arrow"
  ) {
    saveObject({
      type: currentTool,
      start: startPoint,
      end: lastPoint,
      color: brush.color,
      width: brush.width,
      opacity: brush.opacity,
    });
  }
  drawing = false;
  points = [];
  startPoint = null;
  lastPoint = null;
  activePointer = null;
  redrawCanvas();
}

function saveCanvasState() {
  localStorage.setItem("doodleCanvas", JSON.stringify(objects));
}

function loadCanvasState() {
  const saved = localStorage.getItem("doodleCanvas");
  if (!saved) {
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      objects = parsed;
    }
  } catch {
    localStorage.removeItem("doodleCanvas");
  }
  redrawCanvas();
}

function saveObject(object) {
  objects.push(object);
  redoObjects = [];
  saveCanvasState();
}

function undo() {
  if (objects.length === 0) {
    return;
  }
  const object = objects.pop();

  redoObjects.push(object);
  saveCanvasState();
  redrawCanvas();
}

function redo() {
  if (redoObjects.length === 0) {
    return;
  }
  const object = redoObjects.pop();

  objects.push(object);
  saveCanvasState();
  redrawCanvas();
}

function closeMenu() {
  menuPanel.classList.remove("active");
}

document.getElementById("newCanvas").addEventListener("click", () => {
  objects = [];
  redoObjects = [];
  camera = { x: 0, y: 0, zoom: 1 };
  saveCanvasState();
  redrawCanvas();
  closeMenu();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "doodle.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  closeMenu();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  objects = [];
  redoObjects = [];
  saveCanvasState();
  redrawCanvas();
  closeMenu();
});

document.getElementById("shortcutsBtn").addEventListener("click", () => {
  alert("Keyboard shortcuts:\nCtrl+Z: Undo\nCtrl+Shift+Z or Ctrl+Y: Redo");
  closeMenu();
});

document.getElementById("abtBtn").addEventListener("click", () => {
  alert("Doodle\nA simple canvas for quick sketches.");
  closeMenu();
});

function startPan(event) {
  if (event.button !== 1) {
    return;
  }
  isPanning = true;
  panStart.x = event.clientX - camera.x;
  panStart.y = event.clientY - camera.y;
  canvas.style.cursor = "grabbing";
}

function movePan(event) {
  if (!isPanning) {
    return;
  }
  camera.x = event.clientX - panStart.x;
  camera.y = event.clientY - panStart.y;

  redrawCanvas();
}

function stopPan() {
  isPanning = false;
  canvas.style.cursor = "default";
}

function updateZoom() {
  zoomValue.textContent = Math.round(camera.zoom * 100) + "%";
}

function changeZoom(amount) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const beforeZoom = screenToCanvas(centerX, centerY);

  camera.zoom *= 1 + amount;
  camera.zoom = Math.max(0.1, Math.min(camera.zoom, 5));
  camera.x = centerX - beforeZoom.x * camera.zoom;
  camera.y = centerY - beforeZoom.y * camera.zoom;

  updateZoom();
  redrawCanvas();
}

function zoomCanvas(event) {
  event.preventDefault();

  const mouseX = event.clientX;
  const mouseY = event.clientY;

  const beforeZoom = screenToCanvas(mouseX, mouseY);
  const amount = event.deltaY < 0 ? 1.1 : 0.9;

  camera.zoom *= amount;
  camera.zoom = Math.max(0.1, Math.min(camera.zoom, 5));
  camera.x = mouseX - beforeZoom.x * camera.zoom;
  camera.y = mouseY - beforeZoom.y * camera.zoom;

  updateZoom();
  redrawCanvas();
}

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.id === "undoBtn" || button.id === "redoBtn") {
      return;
    }

    document.querySelectorAll(".tool").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    currentTool = button.id.replace("Tool", "");
  });
});

const colorBtn = document.getElementById("ClrButton");
const colorPanel = document.getElementById("ClrPanel");
const colorGrid = document.getElementById("ClrGrid");
const shadeRow = document.getElementById("shadeRow");
const hexInput = document.getElementById("hexInput");
const eyedropBtn = document.getElementById("eyedropButton");

const colors = [
  "#111111",
  "#ffffff",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#00c7be",
  "#30b0ff",
  "#5856d6",
  "#af52de",
  "#ff2d55",
  "#8e8e93",
];

function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;

  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;

  return [h, s * 100, l * 100];
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r, g, b;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function updateShades(color) {
  const [h, s] = hexToHsl(color);
  shadeRow.innerHTML = "";

  [12, 22, 34, 48, 62, 76, 90].forEach((lightness) => {
    const shade = hslToHex(h, s, lightness);
    const button = document.createElement("button");

    button.style.background = shade;
    button.onclick = () => setColor(shade);
    shadeRow.appendChild(button);
  });
}

function setColor(color) {
  brush.color = color;
  colorBtn.style.background = color;
  hexInput.value = color.replace("#", "").toUpperCase();
  updateShades(color);
  saveSettings();
}

colors.forEach((color) => {
  const button = document.createElement("button");

  button.style.background = color;
  button.onclick = () => setColor(color);

  colorGrid.appendChild(button);
});

colorBtn.onclick = (e) => {
  e.stopPropagation();
  colorPanel.classList.toggle("active");
};

colorPanel.onclick = (e) => e.stopPropagation();
hexInput.oninput = () => {
  const value = hexInput.value.replace("#", "");

  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    setColor("#" + value);
  }
};

eyedropBtn.onclick = async () => {
  if (!window.EyeDropper) return;
  try {
    const result = await new EyeDropper().open();
    setColor(result.sRGBHex);
  } catch {}
};
document.onclick = () => {
  colorPanel.classList.remove("active");
};

setColor(brush.color);

widthSlider.addEventListener("input", () => {
  brush.width = Number(widthSlider.value);
  widthValue.textContent = brush.width + " px";

  saveSettings();
});

widthSlider.value = brush.width;
widthValue.textContent = brush.width + " px";

opacitySlider.addEventListener("input", () => {
  brush.opacity = Number(opacitySlider.value) / 100;
  opacityValue.textContent = opacitySlider.value + "%";
  saveSettings();
});

if (pressureButton) {
  pressureButton.classList.toggle("active", brush.pressure);
  pressureButton.addEventListener("click", () => {
    brush.pressure = !brush.pressure;
    pressureButton.classList.toggle("active", brush.pressure);

    saveSettings();
  });
}

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
zoomOut.addEventListener("click", () => changeZoom(-0.1));
zoomIn.addEventListener("click", () => changeZoom(0.1));

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey) {
    return;
  }

  if (event.key.toLowerCase() === "z") {
    event.preventDefault();

    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
  }

  if (event.key.toLowerCase() === "y") {
    event.preventDefault();

    redo();
  }
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();

  if (event.button === 1) {
    startPan(event);
    return;
  }
  startDrawing(event);
});

canvas.addEventListener("pointermove", (event) => {
  event.preventDefault();

  if (isPanning) {
    movePan(event);
    return;
  }
  moveDrawing(event);
});

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();

  if (event.button === 1) {
    stopPan();
    return;
  }
  stopDrawing(event);
});

canvas.addEventListener("pointercancel", (event) => {
  stopDrawing(event);
  stopPan();
});

canvas.addEventListener("wheel", zoomCanvas, {
  passive: false,
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
