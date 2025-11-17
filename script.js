let vertices = [];
let edges = [];      // horizontal edges for breakpoint computation
let startVertex = null;
let targetVertex = null;
let currentVertex = null;
let path = [];
let routingInterval = null;

let vis = { message: "Select a start vertex (green)." };

function setup() {
    const canvas = createCanvas(800, 600);
    canvas.parent('canvas-container');

    let resetButton = createButton('Reset Simulation');

    resetButton.parent('canvas-container');
    resetButton.style('position', 'absolute');
    resetButton.style('left', '350px');  
    resetButton.style('top',  '550px'); 

    resetButton.mousePressed(resetSketch);

    resetSketch();
}


function draw() {
    background(240);
    drawGrid();
    drawHistogram();
    drawPath();
    drawVertices();
    drawInstructions();
}

function mousePressed() {
    if (routingInterval) return; // disable clicks during routing computation

    for (const v of vertices) {
        if (dist(mouseX, mouseY, v.x, v.y) < 12) {
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

// Drawing and ui

function drawGrid() {
    stroke(220);
    for (let x = 0; x < width; x += 20) line(x, 0, x, height);
    for (let y = 0; y < height; y += 20) line(0, y, width, y);
}

function drawHistogram() {
    stroke(0);
    strokeWeight(3);
    noFill();
    beginShape();
    for (const v of vertices) vertex(v.x, v.y);
    endShape(CLOSE);
}

function drawVertices() {
    for (const v of vertices) {
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
        ellipse(v.x, v.y, 14, 14);
    }

    // Draw labels (id and possibly br-id)
    noStroke();
    fill(0);
    textSize(12);
    for (const v of vertices) {
        let labelText = `${v.id}`;
        if (v.label && v.label.brId !== null) {
            labelText += `, br:${v.label.brId}`;
        }
        text(labelText, v.x + 10, v.y - 10);
    }
}

function drawPath() {
    if (path.length > 1) {
        stroke(0, 0, 255, 180);
        strokeWeight(4);
        noFill();
        beginShape();
        for (const p of path) vertex(p.x, p.y);
        endShape();
    }
}

function drawInstructions() {
    fill(0);
    noStroke();
    textSize(16);
    textAlign(LEFT, TOP);
    text(vis.message, 10, 10);
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

    // Fixed histogram polygon (counterclockwise from left base vertex 0)
    vertices = [
        { x:  50, y:  50, id: 0 },   // top-left base
        { x:  50, y: 550, id: 1 },
        { x: 150, y: 550, id: 2 },
        { x: 150, y: 200, id: 3 },
        { x: 250, y: 200, id: 4 },
        { x: 250, y: 350, id: 5 },
        { x: 350, y: 350, id: 6 },
        { x: 350, y: 150, id: 7 },
        { x: 450, y: 150, id: 8 },
        { x: 450, y: 450, id: 9 },
        { x: 550, y: 450, id: 10 },
        { x: 550, y: 250, id: 11 },
        { x: 650, y: 250, id: 12 },
        { x: 650, y: 550, id: 13 },
        { x: 750, y: 550, id: 14 },
        { x: 750, y:  50, id: 15 }   // top-right base
    ];


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

    // 1) Left/right classification and corresponding vertex cv(v)
    for (let i = 0; i < n; i++) {
        const v = vertices[i];
        const next = vertices[(i + 1) % n];
        const prev = vertices[(i - 1 + n) % n];

        v.cv = null;
        v.isLeftVertex = false;
        v.isRightVertex = false;

        if (v.y === next.y) {
            // v -- next is a horizontal edge, v is left, next is right
            v.isLeftVertex = true;
            next.isRightVertex = true;
            v.cv = next;
            next.cv = v;

            edges.push({
                left: v,
                right: next,
                y: v.y
            });
        } else if (prev.y === v.y) {
            // prev -- v is a horizontal edge, prev is left, v is right
            prev.isLeftVertex = true;
            v.isRightVertex = true;
            v.cv = prev;
            prev.cv = v;

            // edge already added when processing prev
        }
    }

    // 2) Convex vs. reflex (using cross product, polygon is CCW)
    for (let i = 0; i < n; i++) {
        const prev = vertices[(i - 1 + n) % n];
        const v = vertices[i];
        const next = vertices[(i + 1) % n];

        const ax = v.x - prev.x;
        const ay = v.y - prev.y;
        const bx = next.x - v.x;
        const by = next.y - v.y;
        const cross = ax * by - ay * bx;

        v.isReflex = (cross < 0);
        v.isConvex = (cross > 0);

        let lr = v.isLeftVertex ? 'l' : (v.isRightVertex ? 'r' : '?');
        let ang = v.isReflex ? 'reflex' : (v.isConvex ? 'convex' : 'flat');
        v.type = `${lr}-${ang}`;
    }
}

// Visibility Graph, bounds ℓ(v), r(v) 

function computeNeighborsAndBounds() {
    const n = vertices.length;

    for (const v of vertices) {
        v.neighbors = [];
    }

    // Compute r-visibility neighbors
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const vi = vertices[i];
            const vj = vertices[j];
            if (isRectilinearVisible(vi, vj)) {
                vi.neighbors.push(vj);
                vj.neighbors.push(vi);
            }
        }
    }

    // Compute ℓ(v), r(v) and routingTable bit
    for (const v of vertices) {
        if (v.neighbors.length === 0) continue;

        // Include v itself in neighborhood for theoretical niceness, but we won't use it as a neighbor for routing.
        const neighborIds = v.neighbors.map(n => n.id);
        let l_v = v.neighbors[0];
        let r_v = v.neighbors[0];

        for (const n of v.neighbors) {
            if (n.id < l_v.id) l_v = n;
            if (n.id > r_v.id) r_v = n;
        }

        v.l_v = l_v; // ℓ(v)
        v.r_v = r_v; // r(v)

        // Single-bit routing table: true if left visible neighbor is higher than right
        // Remember: smaller y means higher (top base is smallest y)
        v.routingTable = {
            higher_is_l: (l_v.y < r_v.y)
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
        v.label = { id: v.id, brId: null };
    }

    const topBaseLeft = vertices[0];
    const topBaseRight = vertices[15];

    for (const v of vertices) {
        let isLeftBase = (v.id === topBaseLeft.id);
        let isRightBase = (v.id === topBaseRight.id);

        // Decide which case v falls into
        let needsRightSearch = (v.isReflex && v.isRightVertex) || isLeftBase;
        let needsLeftSearch = (v.isReflex && v.isLeftVertex) || isRightBase;

        let chosenBreakpoint = null;

        if (needsRightSearch) {
            // look for left endpoints to the right and below
            let bestEdge = null;
            for (const e of edges) {
                if (e.left.x <= v.x) continue;    // must be to the right
                if (e.y <= v.y) continue;         // must be below (larger y on screen)
                if (!isRectilinearVisible(v, e.left)) continue;

                if (!bestEdge) {
                    bestEdge = e;
                } else {
                    // choose the one closest below v: minimal (e.y - v.y)
                    const curDelta = e.y - v.y;
                    const bestDelta = bestEdge.y - v.y;
                    if (curDelta < bestDelta - 1e-6) {
                        bestEdge = e;
                    }
                }
            }
            if (bestEdge) {
                chosenBreakpoint = bestEdge.left;
            }
        }

        if (needsLeftSearch && !chosenBreakpoint) {
            // look for right endpoints to the left and below
            let bestEdge = null;
            for (const e of edges) {
                if (e.right.x >= v.x) continue; // must be to the left
                if (e.y <= v.y) continue; // must be below
                if (!isRectilinearVisible(v, e.right)) continue;

                if (!bestEdge) {
                    bestEdge = e;
                } else {
                    const curDelta = e.y - v.y;
                    const bestDelta = bestEdge.y - v.y;
                    if (curDelta < bestDelta - 1e-6) {
                        bestEdge = e;
                    }
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
    if (s.neighbors.some(n => n.id === t.id)) {
        nextVertex = t;
    } else {
        // Check if t is in the interval I(s) = [ℓ(s), r(s)] (by indices).
        const lId = s.l_v.id;
        const rId = s.r_v.id;
        const tid = t.id;

        // For this fixed histogram, indices are along the x-monotone boundary, so we
        // can safely use simple [lId, rId] without wrap-around.
        const tInIs = (tid >= lId && tid <= rId);

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
                    // midpoint between b and cv(b) splits I(s, t) into two sub-intervals
                    const midX = (b.x + b.cv.x) / 2;
                    if (t.x <= midX) {
                        nextVertex = nd;
                    } else {
                        nextVertex = fd;
                    }
                } else {
                    // if no breakpoint is available, fall back to distance-based choice between nd and fd
                    const dNd = dist(nd.x, nd.y, t.x, t.y);
                    const dFd = dist(fd.x, fd.y, t.x, t.y);
                    nextVertex = (dNd <= dFd) ? nd : fd;
                }
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
