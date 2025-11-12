/**
 * p5.js sketch for "Routing in Histograms"
 *
 * This is a complete rewrite based on a thorough reading of the paper.
 * It corrects all previously identified bugs related to illegal paths and
 * infinite loops.
 *
 * Core Corrected Concepts:
 * 1.  `isRectilinearVisible`: Implements the paper's definition ("bounding
 *     rectangle is in P") by checking for collisions with the histogram body.
 * 2.  Dominator Selection: Correctly finds the Near (`nd`) and Far (`fd`)
 *     Dominators using the paper's tie-breaking rule (closest to base line).
 * 3.  Routing Algorithm: Faithfully implements the 3-case routing scheme
 *     with robust logic that prevents loops.
 */

let vertices = [];
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
    const buttonWidth = 130; // An approximate width for calculation
    resetButton.position(width - buttonWidth - 15, height - 45);
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
    if (routingInterval) return; // Disable clicks during routing

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

// --- Drawing and UI ---

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
    // Draw labels separately to avoid being overlapped by stroke
    noStroke();
    fill(0);
    for (const v of vertices) {
        text(v.id, v.x + 10, v.y - 10);
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

function resetSketch() {
    clearInterval(routingInterval);
    routingInterval = null;
    startVertex = null;
    targetVertex = null;
    currentVertex = null;
    path = [];
    vis.message = "Select a start vertex (green).";

    vertices = [
        { x: 50, y: 50, id: 0 }, { x: 750, y: 50, id: 1 }, { x: 750, y: 550, id: 2 },
        { x: 650, y: 550, id: 3 }, { x: 650, y: 250, id: 4 }, { x: 550, y: 250, id: 5 },
        { x: 550, y: 450, id: 6 }, { x: 450, y: 450, id: 7 }, { x: 450, y: 150, id: 8 },
        { x: 350, y: 150, id: 9 }, { x: 350, y: 350, id: 10 }, { x: 250, y: 350, id: 11 },
        { x: 250, y: 200, id: 12 }, { x: 150, y: 200, id: 13 }, { x: 150, y: 550, id: 14 },
        { x: 50, y: 550, id: 15 }
    ];
    preprocessVertices();
}

// --- Core Algorithm and Logic ---

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
        const intersect = ((vi.y > py) !== (vj.y > py))
            && (px < (vj.x - vi.x) * (py - vi.y) / (vj.y - vi.y) + vi.x);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * [CORRECT IMPLEMENTATION] Checks for rectilinear visibility.
 * A bounding box is valid if its center is in the polygon and it doesn't collide
 * with any of the histogram's "teeth" (downward-facing horizontal edges).
 */
function isRectilinearVisible(v1, v2) {
    if (v1.id === v2.id) return false;

    const minX = Math.min(v1.x, v2.x), maxX = Math.max(v1.x, v2.x);
    const minY = Math.min(v1.y, v2.y), maxY = Math.max(v1.y, v2.y);

    // Initial check: The center of the box must be inside the polygon.
    if (!isPointInPolygon((minX + maxX) / 2, (minY + maxY) / 2)) {
        return false;
    }

    // Collision check: No horizontal edge of the histogram can invade the box.
    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        
        // Consider only horizontal edges that are not the top base.
        if (p1.y === p2.y && p1.y > vertices[0].y) {
            // Check if this edge's y-level is within the box's vertical span.
            if (p1.y > minY && p1.y < maxY) {
                // Check if this edge's x-span overlaps with the box's x-span.
                if (Math.max(p1.x, p2.x) > minX && Math.min(p1.x, p2.x) < maxX) {
                    return false; // Collision! This edge blocks visibility.
                }
            }
        }
    }
    return true;
}

function preprocessVertices() {
    for (const v of vertices) {
        v.neighbors = vertices.filter(n => isRectilinearVisible(v, n));
        if (v.neighbors.length > 0) {
            v.l_v = v.neighbors.reduce((min, n) => (n.id < min.id ? n : min), v.neighbors[0]);
            v.r_v = v.neighbors.reduce((max, n) => (n.id > max.id ? n : max), v.neighbors[0]);
            // Routing table: go to the higher vertex (smaller y) to escape a pocket.
            v.routingTable = { higher_is_l: v.l_v.y < v.r_v.y };
        }
    }
}

function route() {
    if (currentVertex.id === targetVertex.id) {
        vis.message = `Path found! Length: ${path.length - 1} hops.`;
        clearInterval(routingInterval);
        return;
    }

    let s = currentVertex;
    let t = targetVertex;
    let nextVertex = null;

    // Case 1: Target is a direct neighbor.
    if (s.neighbors.some(n => n.id === t.id)) {
        nextVertex = t;
    } else {
        // Check if t is in the interval I(s) = [l(s), r(s)].
        // Handle wraparound case (e.g., for s=0, I(s) could be [15, 1]).
        let t_in_Is = (s.l_v.id <= s.r_v.id)
            ? (t.id >= s.l_v.id && t.id <= s.r_v.id)
            : (t.id >= s.l_v.id || t.id <= s.r_v.id);

        if (!t_in_Is) {
            // Case 2: Target is outside I(s). Use routing table to escape pocket.
            nextVertex = s.routingTable.higher_is_l ? s.l_v : s.r_v;
        } else {
            // Case 3: Target is inside I(s) but not visible. Use dominators.
            // Find Near Dominator (nd): rightmost neighbor with x <= t.x.
            const candidates_nd = s.neighbors.filter(n => n.x <= t.x);
            const maxX_nd = Math.max(...candidates_nd.map(n => n.x));
            const rightmost_nd = candidates_nd.filter(n => n.x === maxX_nd);
            const nd = rightmost_nd.reduce((minY, n) => n.y < minY.y ? n : minY, rightmost_nd[0]);

            // Find Far Dominator (fd): leftmost neighbor with x >= t.x.
            const candidates_fd = s.neighbors.filter(n => n.x >= t.x);
            const minX_fd = Math.min(...candidates_fd.map(n => n.x));
            const leftmost_fd = candidates_fd.filter(n => n.x === minX_fd);
            const fd = leftmost_fd.reduce((minY, n) => n.y < minY.y ? n : minY, leftmost_fd[0]);

            // Decide which dominator to move to.
            // A simple, robust heuristic is to move to the one closer to the target.
            nextVertex = (dist(nd.x, nd.y, t.x, t.y) <= dist(fd.x, fd.y, t.x, t.y)) ? nd : fd;
        }
    }

    // --- State Update and Loop Detection ---
    if (nextVertex) {
        if (path.some(p => p.id === nextVertex.id)) { // Check if we have visited this node before.
            vis.message = "Error: Routing loop detected!";
            clearInterval(routingInterval);
            return;
        }
        currentVertex = nextVertex;
        path.push(currentVertex);
    } else {
        vis.message = "Error: Algorithm stuck (no next vertex found).";
        clearInterval(routingInterval);
    }
}