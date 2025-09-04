'use client';

import { useEffect, useRef, useState } from 'react';

interface GlobeASCIIProps {
  size?: number;
  rotationSpeed?: number;
  className?: string;
  autoRotate?: boolean;
}

interface Point {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  screenX?: number;
  screenY?: number;
  factor?: number;
}

export function GlobeASCII({ 
  size = 60, 
  rotationSpeed = 0.005,
  className = '',
  autoRotate = false,
}: GlobeASCIIProps) {
  const containerRef = useRef<HTMLPreElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !containerRef.current) return;

    const speed = autoRotate ? rotationSpeed : 0;
    const globe = new Globe(
      containerRef.current,
      size,
      size,
      speed
    );

    return () => {
      globe.destroy();
    };
  }, [size, rotationSpeed, autoRotate, isClient]);

  if (!isClient) {
    return (
      <pre 
        className={`font-mono text-xs leading-none select-none ${className}`}
        style={{ lineHeight: 1, letterSpacing: '0.1em' }}
        aria-hidden="true"
      >
        {' '.repeat(size * size)}
      </pre>
    );
  }

  return (
    <pre 
      ref={containerRef}
      className={`font-mono text-xs leading-none select-none ${className}`}
      style={{ lineHeight: 1, letterSpacing: '0.1em' }}
      aria-hidden="true"
    />
  );
}

class Globe {
  private container: HTMLElement;
  private width: number;
  private height: number;
  private radius: number;
  private K1 = 40;
  private angleX: number;
  private angleY: number;
  private zoom = 2;
  private texture: string[] | null = null;
  private textureWidth = 1;
  private textureHeight = 0;
  private animationFrame: number | null = null;
  private isAnimating = true;
  private points: Point[];
  private rotationSpeed: number;
  // Ratio of character cell width to height, used to correct vertical scaling
  private charAspect = 1;

  constructor(
    container: HTMLElement,
    width = 80,
    height = 40,
    rotationSpeed = 0.009
  ) {
    this.container = container;
    this.width = width;
    this.height = height;
    this.radius = Math.min(width, height) / 3;
    this.rotationSpeed = rotationSpeed;
    
    // Set initial rotation angles
    this.angleX = -Math.PI / 2.2;
    this.angleY = Math.PI * 1.15;
    
    this.points = this.createSpherePoints();
    this.loadTexture();
    this.measureCharAspect();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.measureCharAspect());
    }
    
    this.startAnimation();
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', () => this.measureCharAspect());
    }
    this.stopAnimation();
  }

  private startAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.isAnimating = true;
    
    const animate = () => {
      if (this.isAnimating) {
        // Auto-rotate continuously
        if (this.rotationSpeed !== 0) {
          this.angleY += this.rotationSpeed;
        }
        
        const asciiOutput = this.render();
        if (this.container) {
          this.container.textContent = asciiOutput;
        }
        
        this.animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  private stopAnimation() {
    this.isAnimating = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private async loadTexture() {
    try {
      const response = await fetch('/earth.txt');
      const text = await response.text();
      const lines = text.split('\n');
      this.textureHeight = lines.length;
      this.textureWidth = lines[0].length;
      this.texture = lines;
    } catch (error) {
      console.error('Failed to load texture:', error);
    }
  }

  private createSpherePoints(): Point[] {
    const points: Point[] = [];
    for (let phi = 0; phi < Math.PI * 2; phi += Math.PI / 60) {
      for (let theta = 0; theta < Math.PI; theta += Math.PI / 60) {
        const x = Math.sin(theta) * Math.cos(phi);
        const y = Math.sin(theta) * Math.sin(phi);
        const z = Math.cos(theta);
        
        const u = phi / (Math.PI * 2);
        const v = 1 - (theta / Math.PI);
        
        points.push({ x, y, z, u, v });
      }
    }
    return points;
  }

  private rotateX(point: Point, angle: number): Point {
    const y = point.y * Math.cos(angle) - point.z * Math.sin(angle);
    const z = point.y * Math.sin(angle) + point.z * Math.cos(angle);
    return { ...point, y, z };
  }

  private rotateY(point: Point, angle: number): Point {
    const x = point.x * Math.cos(angle) - point.z * Math.sin(angle);
    const z = point.x * Math.sin(angle) + point.z * Math.cos(angle);
    return { ...point, x, z };
  }

  private project(point: Point): Point {
    const factor = this.K1 / (this.K1 + point.z * this.zoom);
    const x = point.x * factor * this.radius + this.width / 2;
    // Correct vertical scaling by the character cell aspect ratio (width/height)
    const y = point.y * factor * this.radius * this.charAspect + this.height / 2;
    return { ...point, screenX: x, screenY: y, factor };
  }

  private getTextureChar(u: number, v: number): string {
    if (!this.texture) return ' ';
    
    const tx = Math.floor(u * (this.textureWidth - 1));
    const ty = Math.floor(v * (this.textureHeight - 1));
    
    if (ty >= 0 && ty < this.textureHeight && tx >= 0 && tx < this.textureWidth) {
      return this.texture[ty][tx] || ' ';
    }
    return ' ';
  }

  private render(): string {
    if (!this.texture) return '';
    
    const buffer = Array(this.height).fill(null).map(() => Array(this.width).fill(' '));
    const zBuffer = Array(this.height).fill(null).map(() => Array(this.width).fill(-Infinity));

    for (const point of this.points) {
      let p = this.rotateX(point, this.angleX);
      p = this.rotateY(p, this.angleY);

      if (p.z > -0.15) {
        const projected = this.project(p);
        
        const x = Math.round(projected.screenX!);
        const y = Math.round(projected.screenY!);

        if (x >= 0 && x < this.width && y >= 0 && y < this.height && p.z > zBuffer[y][x]) {
          zBuffer[y][x] = p.z;
          buffer[y][x] = this.getTextureChar(p.u, p.v);
        }
      }
    }

    return buffer.map(row => row.join('')).join('\n');
  }


  // Measure the character cell width/height ratio to render a circular globe
  private measureCharAspect() {
    try {
      const style = getComputedStyle(this.container);
      const sampleCharCount = 100;
      const sampleText = 'M'.repeat(sampleCharCount);
      const span = document.createElement('span');
      span.textContent = sampleText;
      span.style.position = 'absolute';
      span.style.visibility = 'hidden';
      span.style.whiteSpace = 'pre';
      span.style.fontFamily = style.fontFamily;
      span.style.fontSize = style.fontSize;
      span.style.lineHeight = style.lineHeight;
      span.style.letterSpacing = style.letterSpacing;
      document.body.appendChild(span);
      const rect = span.getBoundingClientRect();
      document.body.removeChild(span);

      const charWidthPx = rect.width / sampleCharCount;
      let lineHeightPx = 0;
      const lh = style.lineHeight;
      if (lh.endsWith('px')) {
        lineHeightPx = parseFloat(lh);
      } else {
        const fontSizePx = parseFloat(style.fontSize);
        const numeric = parseFloat(lh);
        lineHeightPx = (isNaN(numeric) ? 1 : numeric) * fontSizePx;
      }
      if (lineHeightPx > 0) {
        this.charAspect = Math.max(0.1, Math.min(10, charWidthPx / lineHeightPx));
      } else {
        this.charAspect = 1;
      }
    } catch {
      this.charAspect = 1;
    }
  }

}