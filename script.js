let points = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
}

function draw() {
  background(255);

  for (let p of points) {
    fill(0);
    noStroke();
    circle(p.x, p.y, 10);
  }
}

function mousePressed() {
  points.push({ x: mouseX, y: mouseY });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}