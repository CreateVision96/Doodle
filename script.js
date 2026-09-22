const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const widthSlider = document.getElementById("widthSlider");
const widthValue = document.getElementById("widthValue");

const opacitySlider = document.getElementById("opacitySlider");
const opacityValue = document.getElementById("opacityValue");

const zoomOut = document.getElementById("zoomOut");
const zoomIn = document.getElementById("zoomIn");
const zoomValue = document.getElementById("zoomValue");

const colorButton = document.getElementById("ClrBtn");
const colorPicker = document.getElementById("colorPicker");

const undoButton = document.getElementById("undoBtn");
const redoButton = document.getElementById("redoBtn");

const pressureButton = document.getElementById("pressToggle");

let camera = {
  x: 0,
  y: 0,
  zoom: 1,
};

let brush = {
  width: 2,
  opacity: 1,
  color: "#111111",
  pressure: true,
};

let currentTool = "select";

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

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  redrawCanvas();
}

function screenToCanvas(x, y) {
  return {
    x: (x - camera.x) / camera.zoom,
    y: (y - camera.y) / camera.zoom,
  };
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
    drawFreehand(object);
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

function drawFreehand(object) {
  if (!object.points || object.points.length === 0) {
    return;
  }

  if (object.type === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  }

  ctx.beginPath();
  ctx.moveTo(object.points[0].x, object.points[0].y);

  for (let i = 1; i < object.points.length; i++) {
    const point = object.points[i];

    let width = object.width;
    if (object.pressure) {
      const pressure = point.pressure || 0.5;
      width *= 0.4 + pressure * 1.6;
    }

    ctx.lineWidth = width;
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
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
  if (currentTool === "select") {
    return;
  }

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

function saveObject(object) {
  objects.push(object);
  redoObjects = [];
}

function undo() {
  if (objects.length === 0) {
    return;
  }

  const object = objects.pop();

  redoObjects.push(object);
  redrawCanvas();
}

function redo() {
  if (redoObjects.length === 0) {
    return;
  }

  const object = redoObjects.pop();

  objects.push(object);
  redrawCanvas();
}

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
  camera.zoom += amount;

  camera.zoom = Math.max(0.1, Math.min(camera.zoom, 5));

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

colorButton.addEventListener("click", () => {
  colorPicker.click();
});

colorPicker.addEventListener("input", () => {
  brush.color = colorPicker.value;

  colorButton.style.background = brush.color;
});

colorButton.style.background = brush.color;

widthSlider.addEventListener("input", () => {
  brush.width = Number(widthSlider.value);

  widthValue.textContent = brush.width + " px";
});

opacitySlider.addEventListener("input", () => {
  brush.opacity = Number(opacitySlider.value) / 100;

  opacityValue.textContent = opacitySlider.value + "%";
});

if (pressureButton) {
  pressureButton.addEventListener("click", () => {
    brush.pressure = !brush.pressure;

    pressureButton.classList.toggle("active", brush.pressure);
  });
}

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

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
