// blob_animation.ts draws the soft, gooey blobs on the block page. Blobs drift
// away from the cursor and ease back to where they started.

const SVG_NS = 'http://www.w3.org/2000/svg'

// below this width the text takes the top of the window and blobs the bottom.
// keep in sync with the max-width media query in block/block.css
const NARROW_WIDTH = 720

const CONFIG = {
  numSeeds: 6,
  childrenPerSeed: 4,
  childrenDistanceRange: 110,
  circleMinRadius: 15,
  circleMaxRadius: 75,
  attraction: 0.1,
  repulsion: 1000,
}

class Blob {
  x: number
  y: number
  readonly originX: number
  readonly originY: number
  readonly element: SVGCircleElement

  constructor(x: number, y: number, r: number) {
    this.x = this.originX = x
    this.y = this.originY = y
    this.element = document.createElementNS(SVG_NS, 'circle')
    this.element.setAttribute('r', r.toFixed(1))
    this.render()
  }

  // push away from the cursor and ease back toward the origin.
  // returns whether the blob moved enough to be worth redrawing
  step(mouseX: number, mouseY: number): boolean {
    const dx = this.x - mouseX
    const dy = this.y - mouseY
    const angle = Math.atan2(dy, dx)
    const push = CONFIG.repulsion / Math.max(Math.sqrt(dx * dx + dy * dy), 1)
    const nextX = this.x + Math.cos(angle) * push + (this.originX - this.x) * CONFIG.attraction
    const nextY = this.y + Math.sin(angle) * push + (this.originY - this.y) * CONFIG.attraction

    const moved = Math.abs(nextX - this.x) + Math.abs(nextY - this.y) > 0.05
    this.x = nextX
    this.y = nextY
    if (moved) this.render()
    return moved
  }

  private render(): void {
    this.element.setAttribute('cx', this.x.toFixed(1))
    this.element.setAttribute('cy', this.y.toFixed(1))
  }
}

export default class BlobAnimation {
  private readonly svg: SVGSVGElement
  private readonly group: SVGGElement
  private readonly reducedMotion: boolean
  private blobs: Blob[] = []
  private mouseX = 0
  private mouseY = 0
  private frame = 0
  private resizeTimer = 0

  constructor(svg: SVGSVGElement, pointerArea: HTMLElement, options: { shaded: boolean }) {
    this.svg = svg
    this.group = svg.querySelector('.blob-group') as SVGGElement
    this.svg.classList.toggle('flat', !options.shaded)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!this.reducedMotion) {
      pointerArea.addEventListener('pointermove', (e) => {
        this.mouseX = e.clientX
        this.mouseY = e.clientY
        this.wake()
      })
      pointerArea.addEventListener('pointerleave', () => {
        this.restMouse()
        this.wake()
      })
    }

    window.addEventListener('resize', () => {
      window.clearTimeout(this.resizeTimer)
      this.resizeTimer = window.setTimeout(() => this.start(), 200)
    })
  }

  // (re)seed blobs for the current window size and start animating
  start(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    const narrow = width < NARROW_WIDTH

    this.group.replaceChildren()
    this.blobs = []
    this.restMouse()

    const random = (min: number, max: number) => min + Math.random() * (max - min)
    const near = (target: number, range: number) => target + (Math.random() * 2 - 1) * range
    const radius = () => random(CONFIG.circleMinRadius, CONFIG.circleMaxRadius)

    for (let i = 0; i < CONFIG.numSeeds; i++) {
      // wide windows: the right side; narrow windows: along the bottom
      const seed = narrow
        ? new Blob(random(width * 0.1, width), random(height * 0.8, height), radius())
        : new Blob(random(width * 0.58, width), random(height * 0.12, height * 0.88), radius())
      this.blobs.push(seed)
      for (let j = 0; j < CONFIG.childrenPerSeed; j++) {
        const range = CONFIG.childrenDistanceRange
        // on narrow windows keep children below the fade behind the text
        const y = near(seed.originY, range)
        this.blobs.push(
          new Blob(near(seed.originX, range), narrow ? Math.max(y, height * 0.78) : y, radius())
        )
      }
    }
    this.group.append(...this.blobs.map((b) => b.element))

    // settle into place once, then only animate in response to the cursor
    this.settle()
    this.wake()
  }

  // move every blob one step; returns whether any of them moved
  private stepAll(): boolean {
    let moved = false
    for (const blob of this.blobs) {
      moved = blob.step(this.mouseX, this.mouseY) || moved
    }
    return moved
  }

  private settle(): void {
    for (let i = 0; i < 120 && this.stepAll(); i++) {}
  }

  // with no cursor over the page, blobs feel a gentle push from below
  private restMouse(): void {
    this.mouseX = window.innerWidth / 2
    this.mouseY = window.innerHeight * 2.5
  }

  private wake(): void {
    if (this.reducedMotion || this.frame !== 0) return
    this.frame = requestAnimationFrame(this.tick)
  }

  // redraw only while something is moving, so an idle block page costs nothing
  private tick = (): void => {
    this.frame = this.stepAll() ? requestAnimationFrame(this.tick) : 0
  }
}
