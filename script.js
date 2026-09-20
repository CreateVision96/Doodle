const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const strokeCanvas = document.createElement("canvas");
const strokeCtx = strokeCanvas.getContext("2d");

let redraw = true;

const camera = {
  x: 0,
  y: 0,
  zoom: 1,
};

const pan = {
  active: false,
  startX: 0,
  startY: 0,
};

const drawing = {
  active: false,
  points: [],
};

const pointer = {
  id: null,
};

const brush = {
  width: 1,
  opacity: 1,
  color: "#111111",
  pressure: true,
};

const widthSlider = document.getElementById("widthSlider");
const widthValue = document.getElementById("widthValue");
const opacitySlider = document.getElementById("opacitySlider");
const opacityValue = document.getElementById("opacityValue");

const zoomOutt = document.getElementById("zoomOut");
const zoomIn = document.getElementById("zoomIn");
const zoomValue = document.getElementById("zoomValue");

const ClrBtn = document.getElementById("ClrBtn");
const colorPicker = document.getElementById("colorPicker");

ClrBtn.addEventListener("click", () => {
  colorPicker.click();
});

colorPicker.addEventListener("input", () => {
  brush.color = colorPicker.value;
  ClrBtn.style.background = brush.color;
});

ClrBtn.style.background = brush.color;

const objects = [];
const redoStack = [];
let currentTool = "select";

function undo() {
  if (objects.length === 0) return;
  redoStack.push(objects.pop());
  redraw = true;
  render();
}

function redo() {
  if (redoStack.length === 0) return;
  objects.push(redoStack.pop());
  redraw = true;
  render();
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  strokeCanvas.width = canvas.width;
  strokeCanvas.height = canvas.height;

  redraw = true;
  render();
}

function screenToWorld(x, y) {
  return {
    x: (x - camera.x) / camera.zoom,
    y: (y - camera.y) / camera.zoom,
  };
}

function setCameraTransform() {
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);
}

function clearCanvas() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function render() {
  if (!redraw && !drawing.active) return;
  clearCanvas();
  setCameraTransform();

  ctx.fillStyle = "#ececec";
  ctx.fillRect(
    -camera.x / camera.zoom,
    -camera.y / camera.zoom,
    canvas.width / camera.zoom,
    canvas.height / camera.zoom,
  );

  renderObjects();
  redraw = false;
}
function renderObjects() {
  objects.forEach((object) => {
    drawStroke(object);
  });

  if (drawing.active) {
    drawStroke({
      type: currentTool,
      points: drawing.points,
      color: brush.color,
      width: brush.width,
      opacity: brush.opacity,
      pressure: brush.pressure,
    });
  }
}

function drawStroke(object) {
  if (object.points.length < 2) {
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

  setCameraTransform();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function startDrawing(event) {
  if (
    (currentTool !== "draw" && currentTool !== "eraser") ||
    event.button !== 0
  ) {
    return;
  }

  const point = screenToWorld(event.clientX, event.clientY);
  drawing.active = true;
  pointer.id = event.pointerId;

  drawing.points = [
    {
      x: point.x,
      y: point.y,
      pressure: event.pressure,
    },
  ];
  canvas.style.cursor = "crosshair";
  canvas.setPointerCapture(event.pointerId);
  redraw = true;
  render();
}

function draw(event) {
  if (!drawing.active || event.pointerId !== pointer.id) {
    return;
  }

  const point = screenToWorld(event.clientX, event.clientY);

  drawing.points.push({
    x: point.x,
    y: point.y,
    pressure: event.pressure,
  });
  redraw = true;
  render();
}

function stopDrawing(pointerId) {
  if (!drawing.active || pointerId !== pointer.id) {
    return;
  }

  if (drawing.points.length > 1) {
    redoStack.length = 0;
    objects.push({
      type: currentTool,
      points: drawing.points,
      color: brush.color,
      width: brush.width,
      opacity: brush.opacity,
      pressure: brush.pressure,
    });
  }
  drawing.active = false;
  drawing.points = [];
  pointer.id = null;
  canvas.style.cursor = "default";

  render();
}

function panCanvas(event) {
  camera.x = event.clientX - pan.startX;
  camera.y = event.clientY - pan.startY;
  redraw = true;
  render();
}

function startPan(event) {
  if (event.button !== 1) {
    return;
  }

  pan.active = true;
  pan.startX = event.clientX - camera.x;
  pan.startY = event.clientY - camera.y;

  canvas.style.cursor = "grabbing";
}

function stopPan() {
  pan.active = false;
  canvas.style.cursor = "default";
}

function zoomCanvas(event) {
  event.preventDefault();

  const mouseX = event.clientX;
  const mouseY = event.clientY;
  const worldPosition = screenToWorld(mouseX, mouseY);
  const zoomAmount = event.deltaY < 0 ? 1.1 : 0.9;
  camera.zoom *= zoomAmount;
  camera.zoom = Math.min(Math.max(camera.zoom, 0.1), 5);
  camera.x = mouseX - worldPosition.x * camera.zoom;
  camera.y = mouseY - worldPosition.y * camera.zoom;

  updateZoomUI();
  redraw = true;
  render();
}

function updateZoomUI() {
  zoomValue.textContent = `${Math.round(camera.zoom * 100)}%`;
}

function changeZoom(amount) {
  camera.zoom += amount;
  camera.zoom = Math.min(Math.max(camera.zoom, 0.1), 5);
  updateZoomUI();
  redraw = true;
  render();
}

zoomOutt.addEventListener("click", () => changeZoom(-0.1));
zoomIn.addEventListener("click", () => changeZoom(0.1));
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey) return;
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

  canvas.setPointerCapture(event.pointerId);

  if (event.button === 1) {
    startPan(event);
    return;
  }

  startDrawing(event);
});

canvas.addEventListener("pointermove", (event) => {
  event.preventDefault();

  if (pan.active) {
    panCanvas(event);
    return;
  }

  draw(event);
});

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();

  if (event.button === 1) {
    stopPan();
  } else {
    stopDrawing(event.pointerId);
  }
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener("pointercancel", (event) => {
  stopDrawing(event.pointerId);

  if (pan.active) {
    stopPan();
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener("wheel", zoomCanvas, {
  passive: false,
});

widthSlider.addEventListener("input", () => {
  brush.width = Number(widthSlider.value);
  widthValue.textContent = brush.width + " px";
});

opacitySlider.addEventListener("input", () => {
  brush.opacity = Number(opacitySlider.value) / 100;
  opacityValue.textContent = opacitySlider.value + "%";
});
document.querySelectorAll(".tool").forEach((tool) => {
  tool.addEventListener("click", () => {
    if (tool.id === "undoBtn" || tool.id === "redoBtn") {
      return;
    }
    document.querySelectorAll(".tool").forEach((item) => {
      item.classList.remove("active");
    });

    tool.classList.add("active");
    currentTool = tool.id.replace("Tool", "");
  });
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");

const newCanvas = document.getElementById("newCanvas");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const shortcutsBtn = document.getElementById("shortcutsBtn");
const abtBtn = document.getElementById("abtBtn");

menuBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  menuPanel.classList.toggle("active");
});

menuPanel.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  menuPanel.classList.remove("active");
});

newCanvas.addEventListener("click", () => {
  objects.length = 0;
  redoStack.length = 0;

  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
  updateZoomUI();
  redraw = true;
  render();

  menuPanel.classList.remove("active");
});

exportBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "doodle.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  menuPanel.classList.remove("active");
});

clearBtn.addEventListener("click", () => {
  if (objects.length === 0) return;

  redoStack.length = 0;
  objects.length = 0;
  redraw = true;
  render();
  menuPanel.classList.remove("active");
});
