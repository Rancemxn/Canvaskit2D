> 注意：此仓库使用**LLM**完成。设计初衷仅为个人一时兴起。该项目可能并不会进行维护

# Canvas2D - CanvasKit-WASM 实现

这是一个使用 CanvasKit-WASM 实现的完整 CanvasRenderingContext2D API，可以在纯浏览器环境中使用，无需 Node.js 或构建工具。

## 特点

- 完整实现 Canvas 2D API
- 内置 CanvasKit-WASM 0.40.0 (full build)
- 内置字体支持 (Roboto, Noto Sans)
- 无外部依赖，离线可用
- 与原生 Canvas 2D API 兼容

## 文件结构

```
canvas2d-standalone/
├── index.html          # 演示页面
├── canvas2d.js         # Canvas2D 核心实现
├── canvaskit/
│   ├── canvaskit.js    # CanvasKit JS 绑定
│   └── canvaskit.wasm  # CanvasKit WASM (~8MB)
├── fonts/
│   ├── Roboto-Regular.woff2
│   ├── Roboto-Bold.woff2
│   └── NotoSans-Regular.woff2
└── README.md
```

## 快速开始

### 1. 直接打开演示

使用 HTTP 服务器运行（因为 WASM 需要通过 HTTP 加载）：

```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js
npx serve .

# 或使用 PHP
php -S localhost:8080
```

然后在浏览器中打开 `http://localhost:8080`

### 2. 集成到你的项目

```html
<!DOCTYPE html>
<html>
<head>
  <script src="canvas2d.js"></script>
</head>
<body>
  <canvas id="myCanvas" width="800" height="600"></canvas>
  <script>
    async function init() {
      // 初始化 CanvasKit 和字体
      await Canvas2D.init();
      
      // 创建上下文
      const canvas = document.getElementById('myCanvas');
      const ctx = Canvas2D.createCanvasContext(canvas);
      
      // 使用 Canvas 2D API
      ctx.fillStyle = 'red';
      ctx.fillRect(10, 10, 100, 100);
      
      ctx.font = '24px Arial';
      ctx.fillText('Hello Canvas!', 150, 50);
      
      // 刷新显示
      ctx.flush();
    }
    
    init();
  </script>
</body>
</html>
```

## API 参考

### 全局方法

#### `Canvas2D.init(options)`

初始化 CanvasKit 和字体。必须在使用其他 API 之前调用。

```javascript
await Canvas2D.init({
  canvaskitPath: './canvaskit/',  // CanvasKit 文件路径
  fontsPath: './fonts/',           // 字体文件路径
  fonts: ['Roboto-Regular.woff2']  // 要加载的字体
});
```

#### `Canvas2D.createCanvasContext(canvas)`

为指定的 canvas 元素创建 CanvasRenderingContext2D。

```javascript
const ctx = Canvas2D.createCanvasContext(document.getElementById('myCanvas'));
```

### 已实现的 API

#### 绘制方法
- `fillRect(x, y, width, height)`
- `strokeRect(x, y, width, height)`
- `clearRect(x, y, width, height)`
- `fill(path, fillRule)`
- `stroke(path)`
- `fillText(text, x, y, maxWidth)`
- `strokeText(text, x, y, maxWidth)`

#### 路径方法
- `beginPath()`
- `closePath()`
- `moveTo(x, y)`
- `lineTo(x, y)`
- `arc(x, y, radius, startAngle, endAngle, counterclockwise)`
- `arcTo(x1, y1, x2, y2, radius)`
- `ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise)`
- `rect(x, y, width, height)`
- `roundRect(x, y, width, height, radii)`
- `bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)`
- `quadraticCurveTo(cpx, cpy, x, y)`

#### 变换方法
- `translate(x, y)`
- `rotate(angle)`
- `scale(x, y)`
- `transform(a, b, c, d, e, f)`
- `setTransform(a, b, c, d, e, f)` 或 `setTransform(matrix)`
- `resetTransform()`
- `getTransform()`

#### 状态管理
- `save()`
- `restore()`
- `reset()`
- `clip(fillRule)` 或 `clip(path, fillRule)`
- `isPointInPath(x, y, fillRule)`
- `isPointInStroke(x, y)`

#### 渐变和图案
- `createLinearGradient(x0, y0, x1, y1)`
- `createRadialGradient(x0, y0, r0, x1, y1, r1)`
- `createConicGradient(startAngle, x, y)`
- `createPattern(image, repetition)`

#### 图像操作
- `drawImage(image, ...)`
- `createImageData(width, height)` 或 `createImageData(imagedata)`
- `getImageData(sx, sy, sw, sh)`
- `putImageData(imageData, dx, dy)`

#### 文本测量
- `measureText(text)` - 返回 TextMetrics 对象

#### 属性
- `fillStyle` / `strokeStyle`
- `lineWidth` / `lineCap` / `lineJoin` / `miterLimit`
- `lineDashOffset` - 使用 `getLineDash()` / `setLineDash()`
- `font` / `textAlign` / `textBaseline` / `direction`
- `globalAlpha` / `globalCompositeOperation`
- `shadowColor` / `shadowBlur` / `shadowOffsetX` / `shadowOffsetY`
- `imageSmoothingEnabled` / `imageSmoothingQuality`
- `filter`
- `letterSpacing` / `wordSpacing`
- `fontKerning` / `fontStretch` / `fontVariantCaps` / `textRendering`

#### 其他
- `isContextLost()`
- `getContextAttributes()`
- `drawFocusIfNeeded(element, path)`
- `flush()` - 刷新绘制到屏幕
- `dispose()` - 释放资源

### 类

- `Canvas2D.CanvasGradient`
- `Canvas2D.CanvasPattern`
- `Canvas2D.Path2D`
- `Canvas2D.ImageData`
- `Canvas2D.TextMetrics`
- `Canvas2D.CanvasRenderingContext2D`

## 注意事项

1. **异步初始化**：必须等待 `init()` 完成后才能创建上下文
2. **刷新显示**：绘制后需要调用 `ctx.flush()` 才能显示到屏幕
3. **资源释放**：使用完毕后调用 `ctx.dispose()` 释放 CanvasKit 资源
4. **字体支持**：默认只包含英文字体，如需中文支持请添加中文字体文件

## 浏览器兼容性

- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

需要支持 WebAssembly 和 WebGL。

## 许可证

MIT License
