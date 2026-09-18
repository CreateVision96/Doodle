const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

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
  type: "mouse",
  pressure: 0,
};

const objects = [];
let currentTool = "select";

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  render();
}

function screenToWorld(x, y) {
  return {
    x: (x - camera.x) / camera.zoom,
    y: (y - camera.y) / camera.zoom,
  };
}

function worldToScreen(x, y) {
  return {
    x: x * camera.zoom + camera.x,
    y: y * camera.zoom + camera.y,
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
}

function renderObjects() {
  objects.forEach((object) => {
    if (object.type === "stroke") {
      drawStroke(object);
    }
  });
}

function drawStroke(object) {
  if (object.points.length < 2) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(object.points[0].x, object.points[0].y);
  for (let i = 1; i < object.points.length; i++) {
    ctx.lineTo(object.points[i].x, object.points[i].y);
  }
  ctx.strokeStyle = object.color;
  ctx.lineWidth = object.width;
  ctx.globalAlpha = object.opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.stroke();
  ctx.globalAlpha = 1;
}

function startDrawing(event) {
  if (currentTool !== "draw" || event.button !== 0) {
    return;
  }
  const point = screenToWorld(event.clientX, event.clientY);
  drawing.active = true;

  pointer.id = event.pointerId;
  pointer.type = event.pointerType;
  pointer.pressure = event.pressure;

  drawing.points = [
    {
      x: point.x,
      y: point.y,
      pressure: event.pressure,
    },
  ];
  canvas.style.cursor = "crosshair";
  canvas.setPointerCapture(event.pointerId);
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
  render();

  drawStroke({
    points: drawing.points,
    color: "#111111",
    width: 2,
    opacity: 1,
  });
}

function stopDrawing(pointerId) {
  if (!drawing.active || pointerId !== pointer.id) {
    return;
  }
  if (drawing.points.length > 1) {
    objects.push({
      type: "stroke",
      points: drawing.points,
      color: "#111111",
      width: 2,
      opacity: 1,
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
  render();
}

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
