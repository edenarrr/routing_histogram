// --- Vertex class ---
class Vertex {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;

        // Geometry / classification
        this.cv = null;  // corresponding vertex
        this.isLeftVertex = false;
        this.isRightVertex = false;
        this.isReflex = false;
        this.isConvex = false;
        this.type = null;  // {'l-reflex', 'l-convex', 'r-reflex', 'r-convex'}

        // Visibility graph
        this.neighbors = [];
        this.l_v = null;  // ℓ(v)
        this.r_v = null;  // r(v)

        // Routing data
        this.routingTable = {higher_is_l: null};  // single-bit routing table
        this.breakpoint = null;  // br(v)
        this.label = {id: id, brId: null};
    }

    addNeighbor(v) {
        if (!this.neighbors.includes(v)) {
            this.neighbors.push(v);
        }
    }

    isNeighbor(v) {
        return this.neighbors.includes(v);
    }
}


// --- Histogram class ---
class Histogram {
    constructor(name, vertices) {
        this.name = name;
        this.vertices = vertices;
    }

    buildVertices() {
        return this.vertices;
    }
}

// --- Predefined histograms ---
const HISTOGRAMS = [
    new Histogram("Histogram 1", [
        new Vertex( 50,  50, 0),
        new Vertex( 50, 550, 1),
        new Vertex(150, 550, 2),
        new Vertex(150, 200, 3),
        new Vertex(250, 200, 4),
        new Vertex(250, 350, 5),
        new Vertex(350, 350, 6),
        new Vertex(350, 150, 7),
        new Vertex(450, 150, 8),
        new Vertex(450, 450, 9),
        new Vertex(550, 450,10),
        new Vertex(550, 250,11),
        new Vertex(650, 250,12),
        new Vertex(650, 550,13),
        new Vertex(750, 550,14),
        new Vertex(750,  50,15)
    ]),

    new Histogram("Histogram 2", [
        new Vertex( 50,  50, 0),
        new Vertex( 50, 550, 1),

        new Vertex(200, 550, 2),
        new Vertex(200, 300, 3),
        new Vertex(280, 300, 4),
        new Vertex(280, 450, 5),

        new Vertex(380, 450, 6),
        new Vertex(380, 250, 7),
        new Vertex(500, 250, 8),
        new Vertex(500, 500, 9),

        new Vertex(620, 500,10),
        new Vertex(620, 350,11),
        new Vertex(700, 350,12),
        new Vertex(700, 550,13),

        new Vertex(750, 550,14),
        new Vertex(750,  50,15)
    ]),

    new Histogram("Histogram 3", [
        new Vertex( 50,  50, 0),
        new Vertex( 50, 500, 1),

        new Vertex(120, 500, 2),
        new Vertex(120, 300, 3),
        new Vertex(200, 300, 4),
        new Vertex(200, 550, 5),

        new Vertex(280, 550, 6),
        new Vertex(280, 200, 7),
        new Vertex(360, 200, 8),
        new Vertex(360, 450, 9),

        new Vertex(440, 450,10),
        new Vertex(440, 250,11),
        new Vertex(560, 250,12),
        new Vertex(560, 550,13),

        new Vertex(750, 550,14),
        new Vertex(750,  50,15)
    ]),

    new Histogram("Histogram 4", [
        new Vertex( 50,  50, 0),
        new Vertex( 50, 550, 1),

        new Vertex(180, 550, 2),
        new Vertex(180, 400, 3),
        new Vertex(260, 400, 4),
        new Vertex(260, 550, 5),

        new Vertex(420, 550, 6),
        new Vertex(420, 250, 7),
        new Vertex(480, 250, 8),
        new Vertex(480, 450, 9),

        new Vertex(600, 450,10),
        new Vertex(600, 350,11),
        new Vertex(680, 350,12),
        new Vertex(680, 550,13),

        new Vertex(750, 550,14),
        new Vertex(750,  50,15)
    ])
];

// Pick a random histogram index in [0, HISTOGRAMS.length - 1]
let currentHistogramIndex = Math.floor(Math.random() * HISTOGRAMS.length);

// --- Layout Constants ---
const LOGICAL_WIDTH  = 800;
const LOGICAL_HEIGHT = 600;

const PANEL_WIDTH  = 500;  // width of each box on screen
const PANEL_HEIGHT = 450;  // height of each box on screen
const PANEL_GAP    = 100;   // horizontal space between boxes

// Inner margins inside each box (space between box border and histogram/graph)
const INNER_MARGIN_X = 20;
const INNER_MARGIN_Y = 20;

const SCALE_X = (PANEL_WIDTH  - 2 * INNER_MARGIN_X) / LOGICAL_WIDTH;
const SCALE_Y = (PANEL_HEIGHT - 2 * INNER_MARGIN_Y) / LOGICAL_HEIGHT;

const CANVAS_WIDTH  = PANEL_WIDTH * 2 + PANEL_GAP;
const CANVAS_HEIGHT = PANEL_HEIGHT;

// Functions to map vertex coords to screen coords
function sxLeft(x)  { return INNER_MARGIN_X + x * SCALE_X; }
function sxRight(x) { return PANEL_WIDTH + PANEL_GAP + INNER_MARGIN_X + x * SCALE_X; }
function sy(y)      { return INNER_MARGIN_Y + y * SCALE_Y; }


// --- Global Variables ---

let vertices = [];
let edges = [];  // horizontal edges for breakpoint computation
let startVertex = null;
let targetVertex = null;
let currentVertex = null;
let path = [];
let routingInterval = null;

let vis = { message: "Select a start vertex (green)." };

function setup() {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('canvas-container');

    // Container for the buttons, placed under the canvas
    const controls = createDiv();
    controls.parent('canvas-container');
    controls.style('margin-top', '10px');
    controls.style('display', 'flex');
    controls.style('gap', '10px');
    controls.style('justify-content', 'center');

    // Reset button
    let resetButton = createButton('Reset simulation');
    resetButton.parent(controls);
    resetButton.mousePressed(resetSketch);

    // Previous histogram button
    let prevButton = createButton('Previous histogram');
    prevButton.parent(controls);
    prevButton.mousePressed(() => switchHistogram(-1));

    // Next histogram button
    let nextButton = createButton('Next histogram');
    nextButton.parent(controls);
    nextButton.mousePressed(() => switchHistogram(+1));

    resetSketch();
}


function switchHistogram(delta) {
    // Move to previous (-1) or next (+1) histogram, with wrap-around.
    currentHistogramIndex = (currentHistogramIndex + delta + HISTOGRAMS.length) % HISTOGRAMS.length;

    resetSketch();
}

function draw() {
    background(240);
    drawGrid();
    drawHistogram();
    drawPath();
    drawVertices();
    drawRVisibilityGraph();
    drawInstructions();
}

function mousePressed() {
    if (routingInterval) return; // disable clicks during routing computation

    // Only react to clicks inside the left panel (area of the histogram)
    if (mouseX < 0 || mouseX > PANEL_WIDTH || mouseY < 0 || mouseY > PANEL_HEIGHT) {
        return;
    }

    for (const v of vertices) {
        const vx = sxLeft(v.x);
        const vy = sy(v.y);
        
        if (dist(mouseX, mouseY, vx, vy) < 12) {
            if (!startVertex) {
                startVertex = v;
                currentVertex = v;
                path = [v];
                vis.message = "Select a target vertex (red).";
            } else if (!targetVertex) {
                if (v.id === startVertex.id) return;
                targetVertex = v;
                vis.message = "Routing...";
                routingInterval = setInterval(route, 600);
            }
            return;
        }
    }
}

function drawGrid() {
    stroke(220);
    strokeWeight(1);

    const stepX = 20 * SCALE_X;
    const stepY = 20 * SCALE_Y;

    for (let x = 0; x <= CANVAS_WIDTH; x += stepX) {
        line(x, 0, x, CANVAS_HEIGHT);
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += stepY) {
        line(0, y, CANVAS_WIDTH, y);
    }

    stroke(0);
    strokeWeight(2);
    noFill();
    rect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
    rect(PANEL_WIDTH + PANEL_GAP, 0, PANEL_WIDTH, PANEL_HEIGHT);
}

function drawHistogram() {
    if (!vertices || vertices.length === 0) return;

    stroke(0);
    strokeWeight(4);
    noFill();
    beginShape();
    for (const v of vertices) vertex(sxLeft(v.x), sy(v.y));
    endShape(CLOSE);
}

function drawVertices() {
    textSize(12);
    textAlign(LEFT, BOTTOM);

    for (const v of vertices) {
        const x = sxLeft(v.x);
        const y = sy(v.y);

        // Colors for  vertices
        if (startVertex && v.id === startVertex.id) fill(0, 255, 0);
        else if (targetVertex && v.id === targetVertex.id) fill(255, 0, 0);
        else fill(255);

        if (currentVertex && v.id === currentVertex.id) {
            strokeWeight(3);
            stroke(255, 165, 0);
        } else {
            strokeWeight(1);
            stroke(0);
        }
        ellipse(x, y, 14, 14);

        // Draw labels (id and possibly br-id)
        noStroke();
        fill(0);
        textSize(12);
        if (v.breakpoint) {
            text(`${v.id}, br:${v.breakpoint.id}`, x + 8, y - 4);
        } else {
            text(`${v.id}`, x + 8, y - 4);
        }
    }
}

function drawPath() {
    if (path.length > 1) {
        stroke(0, 102, 204);
        strokeWeight(3);
        noFill();
        beginShape();
        for (const p of path) vertex(sxLeft(p.x), sy(p.y));
        endShape();
    }
}

function drawRVisibilityGraph() {
    // Edges of the r-visibility graph
    stroke(0);
    strokeWeight(1.5);
    for (const v of vertices) {
        for (const n of v.neighbors) {
            if (n.id > v.id) { // avoid drawing twice
                line(sxRight(v.x), sy(v.y), sxRight(n.x), sy(n.y));
            }
        }
    }

    // Vertices
    fill(255);
    stroke(0);
    strokeWeight(1.5);
    for (const v of vertices) {
        ellipse(sxRight(v.x), sy(v.y), 14, 14);
    }

    // Labels (ids only to keep it simple)
    noStroke();
    fill(0);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    for (const v of vertices) {
        text(`${v.id}`, sxRight(v.x) + 8, sy(v.y) - 4);
    }
}


function drawInstructions() {
    fill(0);
    noStroke();
    textSize(16);
    textAlign(LEFT, TOP);
    text(vis.message, 20, 10);
}

// Reset and preprocessing 

function resetSketch() {
    clearInterval(routingInterval);
    routingInterval = null;
    startVertex = null;
    targetVertex = null;
    currentVertex = null;
    path = [];
    vis.message = "Select a start vertex (green).";

    // Build vertices from the currently selected histogram
    const histogram = HISTOGRAMS[currentHistogramIndex];
    vertices = histogram.buildVertices();


    preprocessVertices();
}

/**
 * Preprocess: classify vertices, compute visibility graph, landmarks, labels and routing tables.
 */
function preprocessVertices() {
    classifyVerticesAndEdges();
    computeNeighborsAndBounds();
    computeBreakpointsAndLabels();
}

// --- Geometry Helpers ---

function isPointInPolygon(px, py) {
    let onBoundary = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const p1 = vertices[i], p2 = vertices[j];
        const onSegment = (
            px >= Math.min(p1.x, p2.x) - 1e-9 && px <= Math.max(p1.x, p2.x) + 1e-9 &&
            py >= Math.min(p1.y, p2.y) - 1e-9 && py <= Math.max(p1.y, p2.y) + 1e-9 &&
            Math.abs((p1.x - p2.x) * (py - p1.y) - (p1.y - p2.y) * (px - p1.x)) < 1e-9
        );
        if (onSegment) { onBoundary = true; break; }
    }
    if (onBoundary) return true;

    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const vi = vertices[i], vj = vertices[j];
        const intersect = ((vi.y > py) !== (vj.y > py)) &&
            (px < (vj.x - vi.x) * (py - vi.y) / (vj.y - vi.y) + vi.x);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Rectilinear visibility (r-visibility) for our histogram.
 * Two vertices v1 and v2 are r-visible iff the closed axis-aligned rectangle
 * between them lies inside the polygon.
 *
 * We approximate this robustly by sampling interior points:
 *  - For non-degenerate rectangles: sample a grid of interior points.
 *  - For horizontal/vertical segments: sample along the segment.
 */
function isRectilinearVisible(v1, v2) {
    if (v1.id === v2.id) return false;

    const minX = Math.min(v1.x, v2.x);
    const maxX = Math.max(v1.x, v2.x);
    const minY = Math.min(v1.y, v2.y);
    const maxY = Math.max(v1.y, v2.y);

    const width = maxX - minX;
    const height = maxY - minY;
    const eps = 1e-3;

    // --- Degenerate rectangles: horizontal or vertical segment ---
    if (width < eps || height < eps) {
        // Sample along the segment (excluding exact endpoints is fine)
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = v1.x + t * (v2.x - v1.x);
            const py = v1.y + t * (v2.y - v1.y);
            if (!isPointInPolygon(px, py)) {
                return false;
            }
        }
        return true;
    }

    // --- Non-degenerate rectangle: sample interior grid ---
    const samplesX = 10;
    const samplesY = 6;

    for (let ix = 1; ix <= samplesX; ix++) {
        const px = minX + (ix / (samplesX + 1)) * width; // strictly inside in x
        for (let iy = 1; iy <= samplesY; iy++) {
            const py = minY + (iy / (samplesY + 1)) * height; // strictly inside in y
            if (!isPointInPolygon(px, py)) {
                return false;
            }
        }
    }

    return true;
}

// --- Vertex Classification & Edges ---

function classifyVerticesAndEdges() {
    const n = vertices.length;
    edges = [];

    // --- 1) Reset flags ---
    for (const v of vertices) {
        v.cv = null;
        v.isLeftVertex  = false;
        v.isRightVertex = false;
    }

    // --- 2) Build horizontal edges and set left/right endpoints by x-coordinate ---
    for (let i = 0; i < n; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];

        if (a.y === b.y) {              // horizontal edge
            let left = a;
            let right = b;
            if (b.x < a.x) {            // swap if needed
                left = b;
                right = a;
            }

            left.isLeftVertex  = true;
            right.isRightVertex = true;

            left.cv  = right;
            right.cv = left;

            edges.push({ left, right, y: left.y });
        }
    }

    // --- 3) Convex vs reflex using orientation cross product ---
    for (let i = 0; i < n; i++) {
        const prev = vertices[(i - 1 + n) % n];
        const v    = vertices[i];
        const next = vertices[(i + 1) % n];

        const ax = v.x - prev.x;
        const ay = v.y - prev.y;
        const bx = next.x - v.x;
        const by = next.y - v.y;
        const cross = ax * by - ay * bx;

        v.isReflex = (cross > 0);
        v.isConvex = (cross < 0);

        const lr  = v.isLeftVertex ? "l" : (v.isRightVertex ? "r" : "?");
        const ang = v.isReflex ? "reflex" : (v.isConvex ? "convex" : "flat");
        v.type = `${lr}-${ang}`;   // e.g., "l-reflex", "r-convex"
    }
}


// Visibility Graph, bounds ℓ(v), r(v) 

function computeNeighborsAndBounds() {
  const n = vertices.length;

  for (const v of vertices) {
    v.neighbors = [];
  }

  // r-visibility neighbors
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const vi = vertices[i];
      const vj = vertices[j];
      if (isRectilinearVisible(vi, vj)) {
        vi.addNeighbor(vj);
        vj.addNeighbor(vi);
      }
    }
  }

  // ℓ(v) = argmin{wid | w ∈ N(v)} : leftmost visible neighbor
  // r(v) = argmax{wid | w ∈ N(v)} : rightmost visible neighbor
  for (const v of vertices) {
    if (v.neighbors.length === 0) continue;

    let l_v = v.neighbors[0];
    let r_v = v.neighbors[0];

    for (const n of v.neighbors) {
        if (n.id < l_v.id) l_v = n;
        if (n.id > r_v.id) r_v = n;
    }

    v.l_v = l_v;
    v.r_v = r_v;

    // Single-bit routing table: true if left visible neighbor is higher than right
    v.routingTable = {
      higher_is_l: (l_v.y < r_v.y)   // smaller y = higher
    };
  }
}


// Breakpoints and labels

function computeBreakpointsAndLabels() {
    // Breakpoint br(v) as in the paper, approximated for screen coordinates
    // For r-reflex and left base vertices: left endpoint of a horizontal edge
    // to the right and below v, visible from v, with minimal vertical distance.
    // For l-reflex and right base vertices: symmetric to the left.
    for (const v of vertices) {
        v.breakpoint = null;
        v.label.id   = v.id;
        v.label.brId = null;
    }

    const topBaseLeft  = vertices[0];
    const topBaseRight = vertices[vertices.length - 1];

    for (const v of vertices) {
        let isLeftBase = (v.id === topBaseLeft.id);
        let isRightBase = (v.id === topBaseRight.id);

        // Decide which case v falls into
        let needsRightSearch = (v.isReflex && v.isRightVertex) || isLeftBase;
        let needsLeftSearch = (v.isReflex && v.isLeftVertex) || isRightBase;

        let chosenBreakpoint = null;

        if (needsRightSearch) {
    // r-reflex or left base: search to the right (or aligned) and below
    let bestEdge = null;
    for (const e of edges) {
        if (e.left.x < v.x) continue;     // strictly left -> skip
        if (e.y <= v.y) continue;         // must be below (larger y on screen)
        if (!isRectilinearVisible(v, e.left)) continue;

        if (!bestEdge || (e.y - v.y) < (bestEdge.y - v.y)) {
            bestEdge = e;                 // closest below v
        }
    }
    if (bestEdge) {
        chosenBreakpoint = bestEdge.left;
    }
}

if (needsLeftSearch && !chosenBreakpoint) {
    // l-reflex or right base: search to the left (or aligned) and below
    let bestEdge = null;
    for (const e of edges) {
        if (e.right.x > v.x) continue;    // strictly right -> skip
        if (e.y <= v.y) continue;         // must be below
        if (!isRectilinearVisible(v, e.right)) continue;

        if (!bestEdge || (e.y - v.y) < (bestEdge.y - v.y)) {
            bestEdge = e;
        }
    }
    if (bestEdge) {
        chosenBreakpoint = bestEdge.right;
    }
}


        if (chosenBreakpoint) {
            v.breakpoint = chosenBreakpoint;
            v.label = { id: v.id, brId: chosenBreakpoint.id };
        }
    }
}

// Dominators and routing

function getDominators(s, t) {
    // Near dominator nd(s, t): rightmost neighbor not to the right of t
    // Far dominator fd(s, t): leftmost neighbor not to the left of t
    const eps = 1e-6;
    let nd = null;
    let fd = null;

    for (const n of s.neighbors) {
        if (n.id === s.id) continue;

        // candidate for nd: x <= t.x
        if (n.x <= t.x + eps) {
            if (!nd ||
                n.x > nd.x + eps ||
                (Math.abs(n.x - nd.x) <= eps && n.y > nd.y)) { // closer to base (larger y)
                nd = n;
            }
        }

        // candidate for fd: x >= t.x
        if (n.x >= t.x - eps) {
            if (!fd ||
                n.x < fd.x - eps ||
                (Math.abs(n.x - fd.x) <= eps && n.y > fd.y)) {
                fd = n;
            }
        }
    }

    return { nd, fd };
}

function route() {
    if (!currentVertex || !targetVertex) return;

    if (currentVertex.id === targetVertex.id) {
        vis.message = `Path found! Length: ${path.length - 1} hops.`;
        clearInterval(routingInterval);
        routingInterval = null;
        return;
    }

    const s = currentVertex;
    const t = targetVertex;
    let nextVertex = null;

    if (!s.neighbors || s.neighbors.length === 0 || !s.l_v || !s.r_v) {
        vis.message = "Error: current vertex has no visibility data.";
        clearInterval(routingInterval);
        routingInterval = null;
        return;
    }

    // Case 1: Target is a direct neighbor.
    if (s.isNeighbor(t)) {
        nextVertex = t;
    } else {
        // Check if t is in the interval I(s) = [ℓ(s), r(s)].
        const minId = Math.min(s.l_v.id, s.r_v.id);
        const maxId = Math.max(s.l_v.id, s.r_v.id);
        const tInIs = (t.id >= minId && t.id <= maxId);
        const eps  = 1e-6;

        if (!tInIs) {
            // Case 2: t ∉ I(s). Escape pocket using routing table bit.
            nextVertex = s.routingTable.higher_is_l ? s.l_v : s.r_v;
        } else {
            // Case 3: t ∈ I(s) \ N(s). Use near/far dominators and breakpoint.
            const { nd, fd } = getDominators(s, t);

            if (!nd || !fd) {
                // Fallback: move to neighbor closer to t.
                let best = null;
                let bestDist = Infinity;
                for (const n of s.neighbors) {
                    const d = dist(n.x, n.y, t.x, t.y);
                    if (d < bestDist) {
                        bestDist = d;
                        best = n;
                    }
                }
                nextVertex = best;
            } else {
                // Use breakpoint of nd(s, t) to decide side of I(s, t)
                const b = nd.breakpoint;
                if (b && b.cv) {
                    if (t.x >= nd.x && t.x <= b.x) {
                        nextVertex = nd;
                    } else if (t.x >= b.cv.x && t.x <= fd.x){
                        nextVertex = fd;
                    }
                } 
                // else { Safety block, if preprocessing is correct and lemmas too, no need for this
                //     // No breakpoint available: decide using horizontal proximity to the target.
                //     const dxNd = Math.abs(nd.x - t.x);
                //     const dxFd = Math.abs(fd.x - t.x);
                //     const eps  = 1e-6;

                //     if (dxNd < dxFd - eps) {
                //         nextVertex = nd;
                //     } else if (dxFd < dxNd - eps) {
                //         nextVertex = fd;
                //     } else {
                //         // Tie-break: prefer the higher one (smaller y)
                //         nextVertex = (nd.y < fd.y) ? nd : fd;
                //     }
                // }
            }
        }
    }

    // --- State Update and Loop Detection ---
    if (nextVertex) {
        if (path.some(p => p.id === nextVertex.id)) {
            vis.message = "Error: Routing loop detected!";
            clearInterval(routingInterval);
            routingInterval = null;
            return;
        }
        currentVertex = nextVertex;
        path.push(currentVertex);
    } else {
        vis.message = "Error: Algorithm stuck (no next vertex found).";
        clearInterval(routingInterval);
        routingInterval = null;
    }
}
