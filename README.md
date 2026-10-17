# 替它听 · 静态站点

宠物智能听诊器市场调研的项目展示页。**纯静态，无构建步骤、无依赖、零外部请求**，把这三个文件放进任意静态托管即可上线。

```
web/
├── index.html     页面结构
├── style.css      全部样式
└── script.js      心音波形（Canvas）＋ 播放心音（Web Audio）＋ 滚动淡入
```

## 部署方式（任选其一）

**Netlify（最快）**
直接把这个文件夹拖到 https://app.netlify.com/drop ，几秒后拿到网址。

**Vercel**
```bash
npx vercel --prod
```
在 `web/` 目录下执行，框架选 Other，无构建命令，输出目录填 `.`。

**GitHub Pages**
推到仓库后，Settings → Pages → Source 选 `main` 分支 `/web` 目录。

**任意服务器 / 对象存储**
把三个文件上传到同一目录即可，相对路径引用，不需要改任何配置。

**本地预览**
```bash
cd web && python3 -m http.server 8000
```
然后访问 http://localhost:8000

## 实现说明

- **Canvas 心音图**：用阻尼正弦波合成 S1（lub）/ S2（dub）双爆发，模拟真实心音图（PCG）而非通用心电波形。`script.js` 中的 `pcg(t)` 是信号模型。
- **播放心音**：点按钮触发 Web Audio 实时合成，4 个心动周期，低频振荡 + 带通噪声。无音频文件，因此没有任何外部资源。
- **滚动淡入**：IntersectionObserver，`prefers-reduced-motion` 下自动关闭。
- **无 JS 兜底**：`<html>` 上的 `.js` 类由内联脚本添加，脚本失败时内容完整可见。
- **响应式**：1440 / 1600 / 1920 / 390 均已验证，无横向溢出。

## 字体

使用系统字体，不加载 Web Font：

- 标题：`Songti SC` → `Source Han Serif SC` → `Noto Serif SC` → `STSong`
- 正文：`PingFang SC` → `Hiragino Sans GB` → `Microsoft YaHei`
- 数据：`SF Mono` / `Menlo`

macOS 与 Windows 上观感略有差异（宋体 / 苹方 vs 微软雅黑），正式展示前建议在实际使用的设备上过一遍。

## 内容口径

页面顶部的 **1,440（计划发放）/ 1,260（目标有效）** 是调查方案口径；**420（当前分析样本）** 是页面中 Kano、PSM、回归、聚类各图表数据的实际来源。页脚已写明这一区分。

全量数据回收后，需同步更新的位置：

1. 首屏 `.hero-meta` 中的「当前分析样本」
2. 第 03 / 04 / 05 / 06 节中的统计量与图表坐标
3. Kano 四象限 SVG 里 6 个数据点的 `cx` / `cy`（按 `|Worse|` 与 `Better` 重新换算）
4. 页脚数据口径说明

Kano 图的坐标换算规则见 `index.html` 中该 SVG 的注释（viewBox 720×600，x 轴 0–70 映射到 80–690，y 轴 0–95 映射到 520–40）。
