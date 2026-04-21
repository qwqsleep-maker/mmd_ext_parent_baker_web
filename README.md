# MMD External Parent Baker Web

React/Vite frontend source for the Blender add-on:

[mmd_ext_parent_baker](https://github.com/qwqsleep-maker/mmd_ext_parent_baker)

This repository is the web editor source code. End users normally do not need to install this project separately because the built frontend is bundled into the Blender add-on release package.

## 中文说明

### 这个仓库是做什么的

这是 `mmd_ext_parent_baker` 的 React/Vite 前端源码仓库。

它提供一个时间线式的 external parent 编辑界面，可以：

- 读取 Blender 当前场景
- 选择 source model / source action
- 为 source bone 添加 external-parent track
- 添加 enabled / disabled keyframe
- 为 enabled keyframe 选择 target root / target bone
- 提交 bake 请求回 Blender

对应的 Blender add-on 仓库：

[mmd_ext_parent_baker](https://github.com/qwqsleep-maker/mmd_ext_parent_baker)

### 最终用户是否需要单独安装

通常不需要。

当前产品形态是：

- 最终用户只安装 `mmd_ext_parent_baker` 的 GitHub Release 资产
- add-on release 内已经带有构建后的 Web UI
- 用户在 Blender 面板里点击 `Open Web UI` 即可打开浏览器页面

这个仓库主要用于前端开发、测试和构建，不再作为最终用户的直接安装入口。

### 开发环境要求

- Node.js
- npm
- 一个已经运行 `mmd_ext_parent_baker` 服务的 Blender 实例

### 开发运行

安装依赖：

```powershell
cd "E:\blender code\mmd_ext_parent_baker_web"
npm install
```

启动开发服务器：

```powershell
npm run dev
```

然后在浏览器中打开 Vite 输出的本地地址。

开发模式下，如果 URL 中没有 `?apiBaseUrl=...`，前端会回退到：

```text
http://127.0.0.1:37601
```

注意：

- 这个回退地址只用于本地开发
- 真正的 bundled UI 不依赖这个默认值
- 如果 Blender 因为多实例占用而自动拿到了 `37602`、`37603` 等端口，开发模式请手动修改 `Base URL`

### 构建

```powershell
npm run build
```

输出目录：

```text
dist/
```

这个 `dist/` 不再提交到 add-on 仓库。

发布时，add-on 仓库中的 GitHub Actions 会：

1. 按 `web_bundle.toml` 锁定的 commit/tag 拉取这个仓库
2. 运行 `npm ci`
3. 运行 `npm test`
4. 运行 `npm run build`
5. 把生成的 `dist/` 复制到 add-on staging 目录中的 `web_dist/`
6. 打包成最终的 Blender release zip

### 本地联调

如果你在本地同时开发 add-on 和 web：

1. 在本仓库运行 `npm test`
2. 运行 `npm run build`
3. 把 `dist/` 手工复制到 `mmd_ext_parent_baker/web_dist/`
4. 再启动 Blender add-on 测试 bundled UI

这只是本地开发流程，不是正式发布路径。

### Bundled UI 的运行方式

当页面由 Blender add-on 打开时：

- 页面 URL 会包含 `?apiBaseUrl=...`
- 这个参数由 Blender 动态注入
- 它指向当前 Blender 实例自己的真实 API 地址

例如：

```text
http://127.0.0.1:42015/?apiBaseUrl=http%3A%2F%2F127.0.0.1%3A37602
```

因此：

- 不要假设 API 永远是 `37601`
- 多个 Blender 同时打开时，每个实例都有自己的 Web UI URL
- 最稳妥的方式永远是从 Blender 面板点击 `Open Web UI`

### 使用流程

1. 在 Blender 中打开 `mmd_tools` 场景
2. 启用并启动 `mmd_ext_parent_baker`
3. 通过 Blender 面板打开 Web UI
4. 点击 `Refresh Scene`
5. 选择 `Source Model` 和 `Source Action`
6. 设置 `Frame Start` / `Frame End`
7. 添加 track
8. 选择 source bone
9. 添加 keyframe
10. 设置 target root / target bone
11. 点击 `Bake External Parent`
12. 回到 Blender 播放生成的 Action

### 帧模式

前端支持两种显示和输入模式：

- `Blender Frames`
- `MMD Frames`

`Blender Frames` 直接使用 Blender 真实帧号。

`MMD Frames` 用于 VMD/mmd_tools 工作流，转换公式是：

```text
blenderFrame = mmdFrame + importTimelineFrame + margin
mmdFrame = blenderFrame - importTimelineFrame - margin
```

在 `MMD Frames` 模式下会显示两个额外输入：

- `Import Timeline Frame`
- `Margin`

无论界面显示哪种模式，提交给 Blender 的请求都始终使用真实 Blender 帧号。

### 验证

```powershell
npm test
npm run build
```

## English

### What This Repository Is

This is the React/Vite frontend source repository for `mmd_ext_parent_baker`.

It provides a timeline-style UI for:

- fetching the current Blender scene
- selecting source model / source action
- adding external-parent tracks per source bone
- creating enabled / disabled keyframes
- selecting target root / target bone for enabled keyframes
- sending bake requests back to Blender

Blender add-on repository:

[mmd_ext_parent_baker](https://github.com/qwqsleep-maker/mmd_ext_parent_baker)

### Do End Users Need To Install This Separately

Usually no.

The current product shape is:

- end users install only the GitHub Release asset from `mmd_ext_parent_baker`
- the add-on release already bundles the built frontend
- they open the browser UI from Blender with `Open Web UI`

This repository is for frontend development, testing, and building. It is no longer the primary end-user installation target.

### Development Requirements

- Node.js
- npm
- a Blender instance running the `mmd_ext_parent_baker` service

### Development

Install dependencies:

```powershell
cd "E:\blender code\mmd_ext_parent_baker_web"
npm install
```

Start the dev server:

```powershell
npm run dev
```

Open the local Vite URL in your browser.

In development mode, if the page URL does not contain `?apiBaseUrl=...`, the UI falls back to:

```text
http://127.0.0.1:37601
```

Notes:

- this fallback is for local development only
- the bundled add-on UI does not rely on it
- if Blender auto-selected `37602`, `37603`, or another port because of multiple instances, update `Base URL` manually in dev mode

### Build

```powershell
npm run build
```

Output directory:

```text
dist/
```

This `dist/` is not committed into the add-on repository anymore.

During release packaging, the add-on repository GitHub Actions workflow:

1. reads `web_bundle.toml`
2. checks out this repository at the pinned commit/tag
3. runs `npm ci`
4. runs `npm test`
5. runs `npm run build`
6. copies the generated `dist/` into add-on staging as `web_dist/`
7. produces the final Blender release zip

### Local Integration Workflow

If you are developing add-on and web together locally:

1. run `npm test` in this repository
2. run `npm run build`
3. manually copy `dist/` into `mmd_ext_parent_baker/web_dist/`
4. start the Blender add-on and test the bundled UI

That is a local development workflow only, not the official release path.

### How Bundled UI Discovery Works

When the page is opened by the Blender add-on:

- the page URL includes `?apiBaseUrl=...`
- Blender injects this parameter at launch time
- it points to the real API address for that specific Blender instance

Example:

```text
http://127.0.0.1:42015/?apiBaseUrl=http%3A%2F%2F127.0.0.1%3A37602
```

Therefore:

- do not assume the API is always `37601`
- multiple Blender instances each have their own Web UI URL
- the safest path is always opening the UI from the Blender panel

### Workflow

1. Open an `mmd_tools` scene in Blender
2. Enable and start `mmd_ext_parent_baker`
3. Open the Web UI from the Blender panel
4. Click `Refresh Scene`
5. Select `Source Model` and `Source Action`
6. Set `Frame Start` / `Frame End`
7. Add a track
8. Choose the source bone
9. Add keyframes
10. Set target root / target bone
11. Click `Bake External Parent`
12. Play the generated Action in Blender

### Frame Modes

The UI supports two display/input modes:

- `Blender Frames`
- `MMD Frames`

`Blender Frames` uses real Blender frame numbers directly.

`MMD Frames` is intended for VMD / mmd_tools workflows. The conversion is:

```text
blenderFrame = mmdFrame + importTimelineFrame + margin
mmdFrame = blenderFrame - importTimelineFrame - margin
```

When `MMD Frames` is selected, two extra inputs appear:

- `Import Timeline Frame`
- `Margin`

Regardless of display mode, requests sent to Blender always use real Blender frame numbers.

### Verification

```powershell
npm test
npm run build
```
