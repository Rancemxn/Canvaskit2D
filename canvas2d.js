/**
 * CanvasRenderingContext2D Implementation using CanvasKit-WASM
 * Standalone browser version - no external dependencies
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  // Module state
  let CanvasKit = null;
  let FontMgr = null;
  let DefaultTypeface = null;
  let FontLoaded = false;
  let initialized = false;

  // Configuration
  const config = {
    canvaskitPath: './canvaskit/',
    fontsPath: './fonts/',
    fonts: ['Roboto-Regular.woff2', 'NotoSans-Regular.woff2']
  };

  /**
   * Initialize CanvasKit and load fonts
   * @param {Object} options - Configuration options
   * @param {string} options.canvaskitPath - Path to CanvasKit files
   * @param {string} options.fontsPath - Path to font files
   * @param {string[]} options.fonts - Array of font filenames to load
   * @returns {Promise<boolean>}
   */
  async function init(options = {}) {
    if (initialized) return FontLoaded;
    
    Object.assign(config, options);
    
    // Load CanvasKit
    if (!global.CanvasKitInit) {
      await loadScript(config.canvaskitPath + 'canvaskit.js');
    }
    
    CanvasKit = await global.CanvasKitInit({
      locateFile: (file) => config.canvaskitPath + file
    });
    global.CanvasKit = CanvasKit; 
    
    if (!CanvasKit) {
      throw new Error('Failed to initialize CanvasKit');
    }

    // Try to get FontMgr
    try {
      if (CanvasKit.FontMgr && typeof CanvasKit.FontMgr === 'function') {
        try {
          FontMgr = new CanvasKit.FontMgr();
        } catch (e) {
          // FontMgr constructor not accessible
        }
      }
      
      if (!FontMgr && CanvasKit.FontMgr?.RefDefault) {
        FontMgr = CanvasKit.FontMgr.RefDefault();
      }
      if (!FontMgr && CanvasKit.FontMgr?.System) {
        FontMgr = CanvasKit.FontMgr.System();
      }
      if (!FontMgr && CanvasKit.FontMgr?.matchFamilyStyle) {
        FontMgr = CanvasKit.FontMgr;
      }
    } catch (e) {
      // FontMgr not available
    }
    global.FontMgr = FontMgr; 

    // Try to get default typeface from FontMgr
    if (FontMgr?.matchFamilyStyle) {
      const families = ['sans-serif', 'Arial', 'Helvetica', 'system-ui'];
      for (const family of families) {
        DefaultTypeface = FontMgr.matchFamilyStyle(family, {
          weight: 400, width: 5, slant: 0
        });
        if (DefaultTypeface) break;
      }
    }

    // Test if typeface works
    let needsFont = true;
    if (DefaultTypeface) {
      try {
        const testFont = new CanvasKit.Font(DefaultTypeface, 12);
        const glyphs = testFont.getGlyphIDs?.('Test');
        const widths = testFont.getGlyphWidths?.(glyphs);
        let total = 0;
        if (widths) for (let w of widths) total += w;
        testFont.delete?.();
        if (total > 0) needsFont = false;
      } catch (e) {}
    }

    // Load fonts if needed
    if (needsFont) {
      await loadFonts();
    }

    initialized = true;
    return FontLoaded;
  }

  /**
   * Load a script dynamically
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(script);
    });
  }

  /**
   * Load fonts from configured path
   */
  async function loadFonts() {
    for (const fontFile of config.fonts) {
      try {
        const response = await fetch(config.fontsPath + fontFile);
        if (!response.ok) continue;
        
        const data = await response.arrayBuffer();
        const bytes = new Uint8Array(data);
        
        // Try MakeFreeTypeFaceFromData first (works with woff2)
        if (CanvasKit.Typeface?.MakeFreeTypeFaceFromData) {
          DefaultTypeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(bytes);
        }
        
        // Fallback to MakeFromData
        if (!DefaultTypeface && CanvasKit.Typeface?.MakeFromData) {
          DefaultTypeface = CanvasKit.Typeface.MakeFromData(bytes);
        }
        
        // Verify typeface works
        if (DefaultTypeface) {
          try {
            const testFont = new CanvasKit.Font(DefaultTypeface, 12);
            const glyphs = testFont.getGlyphIDs?.('Test');
            const widths = testFont.getGlyphWidths?.(glyphs);
            let total = 0;
            if (widths) for (let w of widths) total += w;
            testFont.delete?.();
            if (total > 0) {
              FontLoaded = true;
              break;
            }
          } catch (e) {}
        }
      } catch (e) {
        // Continue to next font
      }
    }
  }

  /**
   * Parse CSS color string to CanvasKit Color
   */
  function parseColor(color) {
    if (!CanvasKit) return [0, 0, 0, 1];
    if (!color) return CanvasKit.Color(0, 0, 0, 1);
    
    if (Array.isArray(color) && color.length >= 3) return color;
    if (typeof color === 'object' && color._shader) return color;
    
    if (typeof color === 'string') {
      const str = color.trim().toLowerCase();
      
      // Hex colors
      if (str.startsWith('#')) {
        let hex = str.slice(1);
        let r = 0, g = 0, b = 0, a = 1;
        
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16) / 255;
          g = parseInt(hex[1] + hex[1], 16) / 255;
          b = parseInt(hex[2] + hex[2], 16) / 255;
        } else if (hex.length === 6) {
          r = parseInt(hex.slice(0, 2), 16) / 255;
          g = parseInt(hex.slice(2, 4), 16) / 255;
          b = parseInt(hex.slice(4, 6), 16) / 255;
        } else if (hex.length === 8) {
          r = parseInt(hex.slice(0, 2), 16) / 255;
          g = parseInt(hex.slice(2, 4), 16) / 255;
          b = parseInt(hex.slice(4, 6), 16) / 255;
          a = parseInt(hex.slice(6, 8), 16) / 255;
        }
        return CanvasKit.Color4f(r, g, b, a);
      }
      
      // rgb() or rgba()
      const rgbMatch = str.match(/rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)(?:\s*[,\s]\s*(\d*(?:\.\d+)?))?\s*\)/);
      if (rgbMatch) {
        return CanvasKit.Color4f(
          parseFloat(rgbMatch[1]) / 255,
          parseFloat(rgbMatch[2]) / 255,
          parseFloat(rgbMatch[3]) / 255,
          rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1
        );
      }
      
      // Named colors
      const named = {
        'black': [0, 0, 0], 'white': [1, 1, 1],
        'red': [1, 0, 0], 'green': [0, 0.502, 0], 'blue': [0, 0, 1],
        'yellow': [1, 1, 0], 'cyan': [0, 1, 1], 'magenta': [1, 0, 1],
        'orange': [1, 0.647, 0], 'purple': [0.502, 0, 0.502],
        'pink': [1, 0.753, 0.796], 'brown': [0.647, 0.165, 0.165],
        'gray': [0.502, 0.502, 0.502], 'grey': [0.502, 0.502, 0.502],
        'transparent': [0, 0, 0],
        'coral': [1, 0.498, 0.314], 'dodgerblue': [0.118, 0.565, 1],
        'lime': [0, 1, 0], 'navy': [0, 0, 0.502], 'teal': [0, 0.502, 0.502],
        'maroon': [0.502, 0, 0], 'olive': [0.502, 0.502, 0],
        'silver': [0.753, 0.753, 0.753], 'aqua': [0, 1, 1],
        'fuchsia': [1, 0, 1]
      };
      
      const c = named[str];
      if (c) {
        return CanvasKit.Color4f(c[0], c[1], c[2], str === 'transparent' ? 0 : 1);
      }
      
      if (CanvasKit.parseColorString) {
        try { return CanvasKit.parseColorString(color); } catch (e) {}
      }
    }
    
    return CanvasKit.Color(0, 0, 0, 1);
  }

  function radToDeg(rad) {
    return rad * 180 / Math.PI;
  }

  function multiplyMatrices(a, b) {
    return [
      a[0]*b[0] + a[1]*b[3] + a[2]*b[6],
      a[0]*b[1] + a[1]*b[4] + a[2]*b[7],
      a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
      a[3]*b[0] + a[4]*b[3] + a[5]*b[6],
      a[3]*b[1] + a[4]*b[4] + a[5]*b[7],
      a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
      a[6]*b[0] + a[7]*b[3] + a[8]*b[6],
      a[6]*b[1] + a[7]*b[4] + a[8]*b[7],
      a[6]*b[2] + a[7]*b[5] + a[8]*b[8],
    ];
  }

  /**
   * CanvasGradient class
   */
  class CanvasGradient {
    constructor(type, ...args) {
      this._type = type;
      this._args = args;
      this._stops = [];
      this._shader = null;
    }

    addColorStop(offset, color) {
      if (offset < 0 || offset > 1) return;
      this._stops.push({ offset, color: parseColor(color) });
      this._shader = null;
    }

    _createShader() {
      if (this._shader) return this._shader;
      if (!CanvasKit || this._stops.length === 0) return null;
      
      const colors = [], positions = [];
      const sorted = [...this._stops].sort((a, b) => a.offset - b.offset);
      
      for (const stop of sorted) {
        let c = stop.color;
        if (Array.isArray(c) && c.length >= 4) colors.push(c);
        else if (Array.isArray(c) && c.length === 3) colors.push([c[0], c[1], c[2], 1]);
        else colors.push(c);
        positions.push(stop.offset);
      }
      
      const tileMode = CanvasKit.TileMode.Clamp;
      
      try {
        switch (this._type) {
          case 'linear': {
            const [x0, y0, x1, y1] = this._args;
            this._shader = CanvasKit.Shader.MakeLinearGradient([x0, y0], [x1, y1], colors, positions, tileMode);
            break;
          }
          case 'radial': {
            const [x0, y0, r0, x1, y1, r1] = this._args;
            this._shader = CanvasKit.Shader.MakeTwoPointConicalGradient([x0, y0], r0, [x1, y1], r1, colors, positions, tileMode);
            break;
          }
          case 'conic': {
            const [startAngle, x, y] = this._args;
            const startDeg = radToDeg(startAngle);
            this._shader = CanvasKit.Shader.MakeSweepGradient(x, y, colors, positions, tileMode, null, 0, startDeg, startDeg + 360);
            break;
          }
        }
      } catch (e) {}
      
      return this._shader;
    }
  }

  /**
   * CanvasPattern class
   */
  class CanvasPattern {
    constructor(image, repetition) {
      this._image = image;
      this._repetition = repetition || 'repeat';
      this._shader = null;
      this._transform = [1, 0, 0, 0, 1, 0, 0, 0, 1];

      if (CanvasKit) {
        try {
          let skImage = null;
          if (image instanceof HTMLCanvasElement || typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
            skImage = CanvasKit.MakeImageFromCanvasImageSource(image);
          }

          if (skImage) {
            let tmx = CanvasKit.TileMode.Repeat;
            let tmy = CanvasKit.TileMode.Repeat;
            if (this._repetition === 'repeat-x') tmy = CanvasKit.TileMode.Clamp;
            if (this._repetition === 'repeat-y') tmx = CanvasKit.TileMode.Clamp;
            if (this._repetition === 'no-repeat') {
              tmx = CanvasKit.TileMode.Clamp;
              tmy = CanvasKit.TileMode.Clamp;
            }
            this._shader = skImage.makeShaderOptions(tmx, tmy, CanvasKit.FilterMode.Linear, CanvasKit.MipmapMode.None, null);
          }
        } catch (e) {
          console.warn('Pattern creation failed', e);
        }
      }
    }

    setTransform(transform) {
      if (transform && typeof transform === 'object' && transform.a !== undefined) {
        this._transform = [transform.a, transform.c, transform.e, transform.b, transform.d, transform.f, 0, 0, 1];
      }
    }

    _createShader() {
      return this._shader;
    }
  }

  /**
   * Path2D class
   */
  class Path2D {
    constructor(path) {
      try {
        if (path instanceof Path2D && path._path) {
          this._path = path._path.copy();
        } else if (typeof path === 'string' && CanvasKit) {
          this._path = CanvasKit.Path.MakeFromSVGString(path);
          if (!this._path) this._path = new CanvasKit.Path();
        } else if (CanvasKit) {
          this._path = new CanvasKit.Path();
        }
      } catch (e) {
        this._path = CanvasKit ? new CanvasKit.Path() : null;
      }
    }

    addPath(path) {
      try {
        if (path?._path) {
          this._path?.addPath(path._path.copy());
        }
      } catch (e) {}
    }

    closePath() { try { this._path?.close(); } catch (e) {} }
    moveTo(x, y) { try { this._path?.moveTo(x, y); } catch (e) {} }
    lineTo(x, y) { try { this._path?.lineTo(x, y); } catch (e) {} }
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      try { this._path?.cubicTo(cp1x, cp1y, cp2x, cp2y, x, y); } catch (e) {}
    }
    quadraticCurveTo(cpx, cpy, x, y) {
      try { this._path?.quadTo(cpx, cpy, x, y); } catch (e) {}
    }
    arc(x, y, radius, startAngle, endAngle, counterclockwise) {
      try { this._path?.arc(x, y, radius, startAngle, endAngle, counterclockwise); } catch (e) {}
    }
    arcTo(x1, y1, x2, y2, radius) {
      try { this._path?.arcToTangent(x1, y1, x2, y2, radius); } catch (e) {}
    }
    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
      try {
        const steps = 36;
        const angleStep = (endAngle - startAngle) / steps;
        const dir = counterclockwise ? -1 : 1;
        
        for (let i = 0; i <= steps; i++) {
          const angle = startAngle + i * angleStep * dir;
          const cos = Math.cos(angle), sin = Math.sin(angle);
          const cosR = Math.cos(rotation), sinR = Math.sin(rotation);
          const px = x + (radiusX * cos * cosR - radiusY * sin * sinR);
          const py = y + (radiusX * cos * sinR + radiusY * sin * cosR);
          
          if (i === 0) this._path?.moveTo(px, py);
          else this._path?.lineTo(px, py);
        }
      } catch (e) {}
    }
    rect(x, y, width, height) {
      try { this._path?.addRect(CanvasKit.XYWHRect(x, y, width, height)); } catch (e) {}
    }
    roundRect(x, y, width, height, radii) {
      try {
        let r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
        this._path?.addRRect(CanvasKit.RRectXY(CanvasKit.XYWHRect(x, y, width, height), r, r));
      } catch (e) {}
    }
  }

  /**
   * ImageData class
   */
  class ImageData {
    constructor(widthOrData, heightOrWidth, height) {
      if (widthOrData instanceof Uint8ClampedArray) {
        this.data = widthOrData;
        this.width = heightOrWidth;
        this.height = height;
      } else {
        this.width = widthOrData;
        this.height = heightOrWidth;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  }

  /**
   * TextMetrics class
   */
  class TextMetrics {
    constructor(width, bounds, fontMetrics) {
      this.width = width;
      this.actualBoundingBoxLeft = bounds?.left || 0;
      this.actualBoundingBoxRight = bounds?.right || width;
      this.actualBoundingBoxAscent = bounds?.top || 0;
      this.actualBoundingBoxDescent = bounds?.bottom || 0;
      this.fontBoundingBoxAscent = fontMetrics?.top || 0;
      this.fontBoundingBoxDescent = fontMetrics?.bottom || 0;
      this.emHeightAscent = fontMetrics?.ascent || 0;
      this.emHeightDescent = fontMetrics?.descent || 0;
      this.hangingBaseline = fontMetrics?.hanging || 0;
      this.alphabeticBaseline = 0;
      this.ideographicBaseline = fontMetrics?.ideographic || 0;
    }
  }

  /**
   * CanvasRenderingContext2D class
   */
  class CanvasRenderingContext2D {
    constructor(canvas, surface, width, height) {
      this.canvas = canvas;
      this._surface = surface;
      this._ckCanvas = surface?.getCanvas?.();
      this._width = width;
      this._height = height;
      this._stateStack = [];
      this._state = this._createDefaultState();
      this._currentPath = CanvasKit ? new CanvasKit.Path() : null;
      this._fillPaint = CanvasKit ? new CanvasKit.Paint() : null;
      this._strokePaint = CanvasKit ? new CanvasKit.Paint() : null;
      this._contextLost = false;
      this._font = CanvasKit ? new CanvasKit.Font(DefaultTypeface, 10) : null;
    }

    _createDefaultState() {
      return {
        lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
        lineDash: [], lineDashOffset: 0,
        font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', direction: 'inherit',
        fillStyle: '#000000', strokeStyle: '#000000',
        shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0,
        globalAlpha: 1, globalCompositeOperation: 'source-over',
        imageSmoothingEnabled: true, imageSmoothingQuality: 'low', filter: 'none',
        letterSpacing: '0px', wordSpacing: '0px', fontKerning: 'auto',
        fontStretch: 'normal', fontVariantCaps: 'normal', textRendering: 'auto',
        transform: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        currentX: 0, currentY: 0,
      };
    }

    _ensureTypeface() {
      if (!this._font || !CanvasKit) return;
      if (FontLoaded && DefaultTypeface) {
        const current = this._font.getTypeface?.();
        let valid = false;
        if (current) {
          try {
            const glyphs = this._font.getGlyphIDs?.('Test');
            const widths = this._font.getGlyphWidths?.(glyphs);
            let sum = 0;
            if (widths) for (let w of widths) sum += w;
            valid = sum > 0;
          } catch (e) {}
        }
        if (!current || !valid) {
          this._font.setTypeface?.(DefaultTypeface);
        }
      }
    }

    // Properties
    get lineWidth() { return this._state.lineWidth; }
    set lineWidth(v) { this._state.lineWidth = Math.max(0, v); }
    get lineCap() { return this._state.lineCap; }
    set lineCap(v) { if (['butt', 'round', 'square'].includes(v)) this._state.lineCap = v; }
    get lineJoin() { return this._state.lineJoin; }
    set lineJoin(v) { if (['miter', 'round', 'bevel'].includes(v)) this._state.lineJoin = v; }
    get miterLimit() { return this._state.miterLimit; }
    set miterLimit(v) { this._state.miterLimit = Math.max(0, v); }
    get lineDashOffset() { return this._state.lineDashOffset; }
    set lineDashOffset(v) { this._state.lineDashOffset = v; }
    get font() { return this._state.font; }
    set font(v) { this._state.font = v; this._parseFont(v); }
    get textAlign() { return this._state.textAlign; }
    set textAlign(v) { if (['start', 'end', 'left', 'right', 'center'].includes(v)) this._state.textAlign = v; }
    get textBaseline() { return this._state.textBaseline; }
    set textBaseline(v) { if (['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'].includes(v)) this._state.textBaseline = v; }
    get direction() { return this._state.direction; }
    set direction(v) { if (['ltr', 'rtl', 'inherit'].includes(v)) this._state.direction = v; }
    get fillStyle() { return this._state.fillStyle; }
    set fillStyle(v) { this._state.fillStyle = v; }
    get strokeStyle() { return this._state.strokeStyle; }
    set strokeStyle(v) { this._state.strokeStyle = v; }
    get shadowBlur() { return this._state.shadowBlur; }
    set shadowBlur(v) { this._state.shadowBlur = Math.max(0, v); }
    get shadowColor() { return this._state.shadowColor; }
    set shadowColor(v) { this._state.shadowColor = v; }
    get shadowOffsetX() { return this._state.shadowOffsetX; }
    set shadowOffsetX(v) { this._state.shadowOffsetX = v; }
    get shadowOffsetY() { return this._state.shadowOffsetY; }
    set shadowOffsetY(v) { this._state.shadowOffsetY = v; }
    get globalAlpha() { return this._state.globalAlpha; }
    set globalAlpha(v) { this._state.globalAlpha = Math.max(0, Math.min(1, v)); }
    get globalCompositeOperation() { return this._state.globalCompositeOperation; }
    set globalCompositeOperation(v) { this._state.globalCompositeOperation = v; }
    get imageSmoothingEnabled() { return this._state.imageSmoothingEnabled; }
    set imageSmoothingEnabled(v) { this._state.imageSmoothingEnabled = Boolean(v); }
    get imageSmoothingQuality() { return this._state.imageSmoothingQuality; }
    set imageSmoothingQuality(v) { if (['low', 'medium', 'high'].includes(v)) this._state.imageSmoothingQuality = v; }
    get filter() { return this._state.filter; }
    set filter(v) { this._state.filter = v; }
    get letterSpacing() { return this._state.letterSpacing; }
    set letterSpacing(v) { this._state.letterSpacing = String(v); }
    get wordSpacing() { return this._state.wordSpacing; }
    set wordSpacing(v) { this._state.wordSpacing = String(v); }
    get fontKerning() { return this._state.fontKerning; }
    set fontKerning(v) { if (['auto', 'normal', 'none'].includes(v)) this._state.fontKerning = v; }
    get fontStretch() { return this._state.fontStretch; }
    set fontStretch(v) { if (['ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed', 'normal', 'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded'].includes(v)) this._state.fontStretch = v; }
    get fontVariantCaps() { return this._state.fontVariantCaps; }
    set fontVariantCaps(v) { if (['normal', 'small-caps', 'all-small-caps', 'petite-caps', 'all-petite-caps', 'unicase', 'titling-caps'].includes(v)) this._state.fontVariantCaps = v; }
    get textRendering() { return this._state.textRendering; }
    set textRendering(v) { if (['auto', 'optimizeSpeed', 'optimizeLegibility', 'geometricPrecision'].includes(v)) this._state.textRendering = v; }

    isContextLost() { return this._contextLost; }

    getContextAttributes() {
      return { alpha: true, desynchronized: false, colorSpace: 'srgb', willReadFrequently: false };
    }

    getLineDash() { return [...this._state.lineDash]; }
    setLineDash(segments) {
      if (!Array.isArray(segments)) return;
      const dash = segments.filter(s => s >= 0 && isFinite(s)).map(Number);
      this._state.lineDash = dash.length % 2 === 1 ? [...dash, ...dash] : dash;
    }

    save() {
      this._stateStack.push({ ...this._state, transform: [...this._state.transform], lineDash: [...this._state.lineDash] });
      try { this._ckCanvas?.save(); } catch (e) {}
    }

    restore() {
      if (this._stateStack.length > 0) {
        this._state = this._stateStack.pop();
        try { this._ckCanvas?.restore(); } catch (e) {}
      }
    }

    reset() {
      this._state = this._createDefaultState();
      this._stateStack = [];
      try { this._currentPath?.reset?.(); } catch (e) {}
    }

    beginPath() { try { this._currentPath?.reset?.(); } catch (e) {} }
    closePath() { try { this._currentPath?.close?.(); } catch (e) {} }
    moveTo(x, y) { try { this._currentPath?.moveTo(x, y); this._state.currentX = x; this._state.currentY = y; } catch (e) {} }
    lineTo(x, y) { try { this._currentPath?.lineTo(x, y); this._state.currentX = x; this._state.currentY = y; } catch (e) {} }
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) { try { this._currentPath?.cubicTo(cp1x, cp1y, cp2x, cp2y, x, y); this._state.currentX = x; this._state.currentY = y; } catch (e) {} }
    quadraticCurveTo(cpx, cpy, x, y) { try { this._currentPath?.quadTo(cpx, cpy, x, y); this._state.currentX = x; this._state.currentY = y; } catch (e) {} }
    arc(x, y, radius, startAngle, endAngle, counterclockwise = false) {
      try {
        this._currentPath?.arc(x, y, radius, startAngle, endAngle, counterclockwise);
        this._state.currentX = x + radius * Math.cos(endAngle);
        this._state.currentY = y + radius * Math.sin(endAngle);
      } catch (e) {}
    }
    arcTo(x1, y1, x2, y2, radius) { try { this._currentPath?.arcToTangent(x1, y1, x2, y2, radius); } catch (e) {} }
    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise = false) {
      try {
        const steps = 36;
        const angleStep = (endAngle - startAngle) / steps;
        const dir = counterclockwise ? -1 : 1;
        for (let i = 0; i <= steps; i++) {
          const angle = startAngle + i * angleStep * dir;
          const cos = Math.cos(angle), sin = Math.sin(angle);
          const cosR = Math.cos(rotation), sinR = Math.sin(rotation);
          const px = x + (radiusX * cos * cosR - radiusY * sin * sinR);
          const py = y + (radiusX * cos * sinR + radiusY * sin * cosR);
          if (i === 0) this._currentPath?.moveTo(px, py);
          else this._currentPath?.lineTo(px, py);
        }
      } catch (e) {}
    }
    rect(x, y, w, h) { try { this._currentPath?.addRect(CanvasKit.XYWHRect(x, y, w, h)); } catch (e) {} }
    roundRect(x, y, w, h, radii) {
      try {
        const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
        this._currentPath?.addRRect(CanvasKit.RRectXY(CanvasKit.XYWHRect(x, y, w, h), r, r));
      } catch (e) {}
    }

    _setupPaint(paint, style, styleValue) {
      if (!paint || !CanvasKit) return;

      try {
        paint.setShader?.(null);
        paint.setPathEffect?.(null);
        paint.setMaskFilter?.(null);
        paint.setColorFilter?.(null);
        paint.setImageFilter?.(null);

        paint.setStyle(style);
        paint.setStrokeWidth(this._state.lineWidth);
        paint.setStrokeMiter(this._state.miterLimit);

        const capMap = { butt: CanvasKit.StrokeCap.Butt, round: CanvasKit.StrokeCap.Round, square: CanvasKit.StrokeCap.Square };
        const joinMap = { miter: CanvasKit.StrokeJoin.Miter, round: CanvasKit.StrokeJoin.Round, bevel: CanvasKit.StrokeJoin.Bevel };
        paint.setStrokeCap(capMap[this._state.lineCap] || CanvasKit.StrokeCap.Butt);
        paint.setStrokeJoin(joinMap[this._state.lineJoin] || CanvasKit.StrokeJoin.Miter);

        if (this._state.lineDash.length > 0) {
          paint.setPathEffect(CanvasKit.PathEffect.MakeDash(this._state.lineDash, this._state.lineDashOffset));
        }

        const globalAlpha = this._state.globalAlpha;

        if (typeof styleValue === 'object' && styleValue._createShader) {
          paint.setColor(CanvasKit.Color4f(1, 1, 1, globalAlpha));
          const shader = styleValue._createShader();
          if (shader) paint.setShader(shader);
        } else {
          const parsedColor = parseColor(styleValue);
          if (parsedColor && typeof parsedColor === 'object' && 'length' in parsedColor) {
            let r = 0, g = 0, b = 0, a = 1;
            if (parsedColor.length >= 4) { r = parsedColor[0]; g = parsedColor[1]; b = parsedColor[2]; a = parsedColor[3]; }
            else if (parsedColor.length >= 3) { r = parsedColor[0]; g = parsedColor[1]; b = parsedColor[2]; }
            paint.setColor(CanvasKit.Color4f(r, g, b, a * globalAlpha));
          } else {
            paint.setColor(parsedColor);
            if (paint.setAlphaf) paint.setAlphaf(globalAlpha);
          }
        }

        if (paint.setBlendMode) paint.setBlendMode(this._getBlendMode());
        if (paint.setAntiAlias) paint.setAntiAlias(true);
      } catch (e) {}
    }

    _getBlendMode() {
      if (!CanvasKit) return null;
      const modeMap = {
        'source-over': CanvasKit.BlendMode.SrcOver, 'source-in': CanvasKit.BlendMode.SrcIn,
        'source-out': CanvasKit.BlendMode.SrcOut, 'source-atop': CanvasKit.BlendMode.SrcATop,
        'destination-over': CanvasKit.BlendMode.DstOver, 'destination-in': CanvasKit.BlendMode.DstIn,
        'destination-out': CanvasKit.BlendMode.DstOut, 'destination-atop': CanvasKit.BlendMode.DstATop,
        'lighter': CanvasKit.BlendMode.Plus, 'copy': CanvasKit.BlendMode.Src, 'xor': CanvasKit.BlendMode.Xor,
        'multiply': CanvasKit.BlendMode.Multiply, 'screen': CanvasKit.BlendMode.Screen,
        'overlay': CanvasKit.BlendMode.Overlay, 'darken': CanvasKit.BlendMode.Darken,
        'lighten': CanvasKit.BlendMode.Lighten, 'color-dodge': CanvasKit.BlendMode.ColorDodge,
        'color-burn': CanvasKit.BlendMode.ColorBurn, 'hard-light': CanvasKit.BlendMode.HardLight,
        'soft-light': CanvasKit.BlendMode.SoftLight, 'difference': CanvasKit.BlendMode.Difference,
        'exclusion': CanvasKit.BlendMode.Exclusion, 'hue': CanvasKit.BlendMode.Hue,
        'saturation': CanvasKit.BlendMode.Saturation, 'color': CanvasKit.BlendMode.Color,
        'luminosity': CanvasKit.BlendMode.Luminosity,
      };
      return modeMap[this._state.globalCompositeOperation] || CanvasKit.BlendMode.SrcOver;
    }

    _applyShadow() {
      if (!CanvasKit) return null;
      if (this._state.shadowBlur > 0 || this._state.shadowOffsetX !== 0 || this._state.shadowOffsetY !== 0) {
        try {
          return {
            shadowColor: parseColor(this._state.shadowColor),
            blurFilter: CanvasKit.MaskFilter.MakeBlur(CanvasKit.BlurStyle.Normal, this._state.shadowBlur / 2, true),
            offsetX: this._state.shadowOffsetX,
            offsetY: this._state.shadowOffsetY
          };
        } catch (e) {}
      }
      return null;
    }

    fill(ruleOrPath, rule) {
      if (!this._currentPath || !this._ckCanvas) return;
      
      let path = this._currentPath;
      let fillRule = 'nonzero';
      if (ruleOrPath instanceof Path2D && ruleOrPath._path) { path = ruleOrPath._path; fillRule = rule || 'nonzero'; }
      else if (typeof ruleOrPath === 'string') fillRule = ruleOrPath;
      
      try {
        path.setFillType(fillRule === 'evenodd' ? CanvasKit.FillType.EvenOdd : CanvasKit.FillType.Winding);
        this._setupPaint(this._fillPaint, CanvasKit.PaintStyle.Fill, this._state.fillStyle);
        
        const shadow = this._applyShadow();
        if (shadow) {
          this._ckCanvas.save();
          this._ckCanvas.translate(shadow.offsetX, shadow.offsetY);
          const shadowPaint = this._fillPaint?.copy?.();
          if (shadowPaint) {
            shadowPaint.setColor(shadow.shadowColor);
            shadowPaint.setMaskFilter(shadow.blurFilter);
            this._ckCanvas.drawPath(path, shadowPaint);
            shadowPaint.delete();
          }
          this._ckCanvas.restore();
        }
        this._ckCanvas.drawPath(path, this._fillPaint);
      } catch (e) {}
    }

    stroke(pathOrNone) {
      if (!this._ckCanvas) return;
      
      const path = pathOrNone instanceof Path2D && pathOrNone._path ? pathOrNone._path : this._currentPath;
      if (!path) return;
      
      try {
        this._setupPaint(this._strokePaint, CanvasKit.PaintStyle.Stroke, this._state.strokeStyle);
        
        const shadow = this._applyShadow();
        if (shadow) {
          this._ckCanvas.save();
          this._ckCanvas.translate(shadow.offsetX, shadow.offsetY);
          const shadowPaint = this._strokePaint?.copy?.();
          if (shadowPaint) {
            shadowPaint.setColor(shadow.shadowColor);
            shadowPaint.setMaskFilter(shadow.blurFilter);
            this._ckCanvas.drawPath(path, shadowPaint);
            shadowPaint.delete();
          }
          this._ckCanvas.restore();
        }
        this._ckCanvas.drawPath(path, this._strokePaint);
      } catch (e) {}
    }

    fillRect(x, y, w, h) {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        this._setupPaint(this._fillPaint, CanvasKit.PaintStyle.Fill, this._state.fillStyle);
        const shadow = this._applyShadow();
        if (shadow) {
          this._ckCanvas.save();
          this._ckCanvas.translate(shadow.offsetX, shadow.offsetY);
          const shadowPaint = this._fillPaint?.copy?.();
          if (shadowPaint) {
            shadowPaint.setColor(shadow.shadowColor);
            shadowPaint.setMaskFilter(shadow.blurFilter);
            this._ckCanvas.drawRect(CanvasKit.XYWHRect(x, y, w, h), shadowPaint);
            shadowPaint.delete();
          }
          this._ckCanvas.restore();
        }
        this._ckCanvas.drawRect(CanvasKit.XYWHRect(x, y, w, h), this._fillPaint);
      } catch (e) {}
    }

    strokeRect(x, y, w, h) {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        this._setupPaint(this._strokePaint, CanvasKit.PaintStyle.Stroke, this._state.strokeStyle);
        this._ckCanvas.drawRect(CanvasKit.XYWHRect(x, y, w, h), this._strokePaint);
      } catch (e) {}
    }

    clearRect(x, y, w, h) {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        const paint = new CanvasKit.Paint();
        paint.setStyle(CanvasKit.PaintStyle.Fill);
        paint.setBlendMode(CanvasKit.BlendMode.Clear);
        this._ckCanvas.drawRect(CanvasKit.XYWHRect(x, y, w, h), paint);
        paint.delete();
      } catch (e) {}
    }

    clip(ruleOrPath, rule) {
      if (!this._ckCanvas) return;
      try {
        let path = this._currentPath;
        let clipRule = 'nonzero';
        if (ruleOrPath instanceof Path2D && ruleOrPath._path) { path = ruleOrPath._path; clipRule = rule || 'nonzero'; }
        else if (typeof ruleOrPath === 'string') clipRule = ruleOrPath;
        
        path?.setFillType?.(clipRule === 'evenodd' ? CanvasKit.FillType.EvenOdd : CanvasKit.FillType.Winding);
        this._ckCanvas.clipPath(path, CanvasKit.ClipOp.Intersect, true);
      } catch (e) {}
    }

    isPointInPath(x, y, rule) {
      if (!this._currentPath || !CanvasKit) return false;
      try {
        const fillRule = rule === 'evenodd' ? CanvasKit.FillType.EvenOdd : CanvasKit.FillType.Winding;
        this._currentPath.setFillType(fillRule);
        return this._currentPath.contains?.(x, y) || false;
      } catch (e) { return false; }
    }

    isPointInStroke(x, y) {
      if (!this._currentPath || !CanvasKit) return false;
      try {
        const strokePath = this._currentPath.stroke?.(this._state.lineWidth);
        return strokePath?.contains?.(x, y) || false;
      } catch (e) { return false; }
    }

    getTransform() {
      const m = this._state.transform;
      return { a: m[0], b: m[3], c: m[1], d: m[4], e: m[2], f: m[5] };
    }

    rotate(angle) {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        const degrees = angle * 180 / Math.PI;
        this._ckCanvas.rotate(degrees, 0, 0);
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const rotMatrix = [cos, -sin, 0, sin, cos, 0, 0, 0, 1];
        this._state.transform = multiplyMatrices(rotMatrix, this._state.transform);
      } catch (e) {}
    }

    scale(x, y) {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        this._ckCanvas.scale(x, y);
        const scaleMatrix = [x, 0, 0, 0, y, 0, 0, 0, 1];
        this._state.transform = multiplyMatrices(scaleMatrix, this._state.transform);
      } catch (e) {}
    }

    translate(x, y) {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        this._ckCanvas.translate(x, y);
        const transMatrix = [1, 0, x, 0, 1, y, 0, 0, 1];
        this._state.transform = multiplyMatrices(transMatrix, this._state.transform);
      } catch (e) {}
    }

    transform(a, b, c, d, e, f) {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        const matrix = [a, c, e, b, d, f, 0, 0, 1];
        this._ckCanvas.concat(matrix);
        this._state.transform = multiplyMatrices(matrix, this._state.transform);
      } catch (e) {}
    }

    setTransform(a, b, c, d, e, f) {
      this.resetTransform();
      if (typeof a === 'object') {
        this.transform(a.a || 1, a.b || 0, a.c || 0, a.d || 1, a.e || 0, a.f || 0);
      } else if (b !== undefined) {
        this.transform(a, b, c, d, e, f);
      }
    }

    resetTransform() {
      if (!this._ckCanvas || !CanvasKit) return;
      try {
        const currentMatrix = this._ckCanvas.getTotalMatrix?.();
        if (currentMatrix && currentMatrix.length >= 9) {
          const a = currentMatrix[0], c = currentMatrix[1], e = currentMatrix[2];
          const b = currentMatrix[3], d = currentMatrix[4], f = currentMatrix[5];
          const det = a * d - b * c;
          if (Math.abs(det) > 1e-10) {
            const invDet = 1 / det;
            const inverse = [
              d * invDet, -c * invDet, (c * f - d * e) * invDet,
              -b * invDet, a * invDet, (b * e - a * f) * invDet,
              0, 0, 1
            ];
            this._ckCanvas.concat(inverse);
          }
        }
      } catch (e) {}
      this._state.transform = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    createLinearGradient(x0, y0, x1, y1) { return new CanvasGradient('linear', x0, y0, x1, y1); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return new CanvasGradient('radial', x0, y0, r0, x1, y1, r1); }
    createConicGradient(startAngle, x, y) { return new CanvasGradient('conic', startAngle, x, y); }
    createPattern(image, repetition) { return new CanvasPattern(image, repetition); }

    _parseFont(fontString) {
      if (!this._font || !CanvasKit) return;
      try {
        const parts = fontString?.trim?.().split?.(/\s+/) || [];
        let fontSize = 10, fontFamily = 'sans-serif', fontWeight = 400, isItalic = false;

        for (const part of parts) {
          if (part.endsWith('px')) fontSize = parseFloat(part) || 10;
          else if (part === 'italic') isItalic = true;
          else if (part === 'bold') fontWeight = 700;
          else if (part.endsWith('00') && !isNaN(parseInt(part))) fontWeight = parseInt(part);
          else if (!['normal', 'inherit', 'initial'].includes(part)) fontFamily = part.replace(/['"]/g, '');
        }

        this._font.setSize(fontSize);

        if (FontMgr) {
          const typeface = FontMgr.matchFamilyStyle(fontFamily, { weight: fontWeight, width: 5, slant: isItalic ? 1 : 0 });
          if (typeface) this._font.setTypeface(typeface);
          else if (DefaultTypeface) this._font.setTypeface(DefaultTypeface);
        } else if (DefaultTypeface) {
          this._font.setTypeface(DefaultTypeface);
        }
      } catch (e) {
        if (DefaultTypeface) this._font.setTypeface(DefaultTypeface);
      }
    }

    fillText(text, x, y, maxWidth) {
      if (!this._ckCanvas || !this._fillPaint || !this._font) return;
      
      try {
        this._setupPaint(this._fillPaint, CanvasKit.PaintStyle.Fill, this._state.fillStyle);
        
        const metrics = this._font.getMetrics?.() || {};
        const ascent = metrics.ascent || -10; 
        const descent = metrics.descent || 2;
        const baselineMap = {
          top: -ascent,
          hanging: -ascent * 0.8,
          middle: -(ascent + descent) / 2,
          alphabetic: 0, 
          ideographic: descent, 
          bottom: -descent
        };
        
        this._drawTextLine(text, x, y + (baselineMap[this._state.textBaseline] || 0), maxWidth, this._fillPaint, false);
      } catch (e) {}
    }

    strokeText(text, x, y, maxWidth) {
      if (!this._ckCanvas || !this._strokePaint || !this._font) return;
      
      try {
        this._setupPaint(this._strokePaint, CanvasKit.PaintStyle.Stroke, this._state.strokeStyle);
        const metrics = this._font.getMetrics?.() || {};
        const ascent = metrics.ascent || -10; 
        const descent = metrics.descent || 2;
        
        const baselineMap = {
          top: -ascent,
          hanging: -ascent * 0.8,
          middle: -(ascent + descent) / 2,
          alphabetic: 0, 
          ideographic: descent, 
          bottom: -descent
        };
        this._drawTextLine(text, x, y + (baselineMap[this._state.textBaseline] || 0), maxWidth, this._strokePaint, true);
      } catch (e) {}
    }

    _drawTextLine(text, x, y, maxWidth, paint, isStroke) {
      if (!text || !this._ckCanvas || !this._font || !paint) return;
      
      try {
        this._ensureTypeface();
        
        let totalWidth = 0;
        try {
          const glyphs = this._font.getGlyphIDs?.(text);
          if (glyphs && glyphs.length > 0) {
            const widths = this._font.getGlyphWidths?.(glyphs);
            if (widths && widths.length > 0) {
              for (let w of widths) totalWidth += w;
            }
          } else {
            totalWidth = text.length * (this._font.getSize?.() || 10) * 0.6;
          }
        } catch (e) {
          totalWidth = text.length * (this._font.getSize?.() || 10) * 0.6;
        }
        
        let offsetX = 0;
        if (this._state.textAlign === 'center') offsetX = -totalWidth / 2;
        else if (this._state.textAlign === 'right' || this._state.textAlign === 'end') offsetX = -totalWidth;
        
        if (this._state.direction === 'rtl') {
          if (this._state.textAlign === 'start') offsetX = -totalWidth;
          else if (this._state.textAlign === 'end') offsetX = 0;
        }
        
        const finalX = x + offsetX;
        
        if (isStroke) {
          try {
            const textPath = this._font.getPath?.(text, finalX, y, paint);
            if (textPath) {
              this._ckCanvas.drawPath(textPath, paint);
              textPath.delete?.();
            } else {
              this._ckCanvas.drawText(text, finalX, y, paint, this._font);
            }
          } catch (e) {
            this._ckCanvas.drawText(text, finalX, y, paint, this._font);
          }
          return;
        }
        
        const currentStyle = paint.getStyle?.();
        if (currentStyle !== CanvasKit?.PaintStyle?.Fill) {
          paint.setStyle(CanvasKit.PaintStyle.Fill);
        }
        
        this._ckCanvas.drawText(text, finalX, y, paint, this._font);
      } catch (e) {}
    }

    measureText(text) {
      if (!text || !this._font) return new TextMetrics(0, {}, {});
      try {
        const glyphs = this._font.getGlyphIDs?.(text);
        const widths = this._font.getGlyphWidths?.(glyphs) || [];
        let totalWidth = 0;
        for (let w of widths) totalWidth += w;
        return new TextMetrics(totalWidth, { left: 0, right: totalWidth, top: 0, bottom: 10 }, this._font.getMetrics?.() || {});
      } catch (e) {
        return new TextMetrics(0, {}, {});
      }
    }

    drawImage(image, ...args) {
      if (!this._ckCanvas || !CanvasKit) return;

      let ckImage = null;
      try {
        if (image && image._ckImage) ckImage = image._ckImage;
        else if (typeof Image !== 'undefined' && image instanceof Image) ckImage = CanvasKit.MakeImageFromCanvasImageSource(image);
        else if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ckImage = CanvasKit.MakeImageFromCanvasImageSource(image);
      } catch (e) {}

      if (!ckImage) return;

      try {
        let sx = 0, sy = 0, sWidth = ckImage.width?.() || 0, sHeight = ckImage.height?.() || 0;
        let dx, dy, dWidth, dHeight;
        
        if (args.length === 2) { dx = args[0]; dy = args[1]; dWidth = sWidth; dHeight = sHeight; }
        else if (args.length === 4) { dx = args[0]; dy = args[1]; dWidth = args[2]; dHeight = args[3]; }
        else if (args.length === 8) { sx = args[0]; sy = args[1]; sWidth = args[2]; sHeight = args[3]; dx = args[4]; dy = args[5]; dWidth = args[6]; dHeight = args[7]; }
        
        const paint = new CanvasKit.Paint();
        paint.setAntiAlias(true);
        paint.setAlphaf(this._state.globalAlpha);
        paint.setBlendMode(this._getBlendMode());
        
        this._ckCanvas.drawImageRect(ckImage, CanvasKit.XYWHRect(sx, sy, sWidth, sHeight), CanvasKit.XYWHRect(dx, dy, dWidth, dHeight), paint);
        paint.delete();
      } catch (e) {}
    }

    createImageData(w, h) {
      return w instanceof ImageData ? new ImageData(w.width, w.height) : new ImageData(w, h);
    }

    getImageData(sx, sy, sw, sh) {
      if (!this._ckCanvas || !CanvasKit) return new ImageData(sw, sh);
      try {
        const info = { width: sw, height: sh, colorType: CanvasKit.ColorType.RGBA_8888, alphaType: CanvasKit.AlphaType.Unpremul, colorSpace: CanvasKit.ColorSpace.SRGB };
        const pixels = this._ckCanvas.readPixels(sx, sy, info);
        return pixels ? new ImageData(new Uint8ClampedArray(pixels), sw, sh) : new ImageData(sw, sh);
      } catch (e) {
        return new ImageData(sw, sh);
      }
    }

    putImageData(imageData, dx, dy) {
      if (!this._ckCanvas || !imageData?.data) return;
      try {
        this._ckCanvas.writePixels(imageData.data, imageData.width, imageData.height, dx, dy);
      } catch (e) {}
    }

    drawFocusIfNeeded() { /* Basic implementation - no-op */ }

    flush() { try { this._surface?.flush?.(); } catch (e) {} }

    dispose() {
      try {
        this._fillPaint?.delete?.();
        this._strokePaint?.delete?.();
        this._currentPath?.delete?.();
        this._font?.delete?.();
        this._surface?.delete?.();
      } catch (e) {}
    }
  }

  /**
   * Create a CanvasRenderingContext2D for the given canvas
   */
  function createCanvasContext(canvas) {
    if (!CanvasKit) throw new Error('CanvasKit not initialized. Call init() first.');
    
    const surface = CanvasKit.MakeWebGLCanvasSurface(canvas);
    if (!surface) {
      throw new Error('Failed to create CanvasKit surface');
    }
    
    return new CanvasRenderingContext2D(canvas, surface, canvas.width, canvas.height);
  }

  // Export
  global.Canvas2D = {
    init,
    createCanvasContext,
    CanvasGradient,
    CanvasPattern,
    Path2D,
    ImageData,
    TextMetrics,
    CanvasRenderingContext2D,
    getCanvasKit: () => CanvasKit,
    isInitialized: () => initialized,
    isFontLoaded: () => FontLoaded
  };

})(typeof window !== 'undefined' ? window : this);
