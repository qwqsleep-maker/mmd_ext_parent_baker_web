# MMD External Parent Baker Web

React/Vite web editor for the Blender add-on:

[mmd_ext_parent_baker](https://github.com/qwqsleep-maker/mmd_ext_parent_baker)

Use this UI to edit MMD external-parent tracks, choose target bones, and submit bake requests to the local Blender HTTP service.

## 中文说明

### 功能

这个前端用于连接 Blender 内的 `mmd_ext_parent_baker` add-on 服务，并提供一个 dope sheet 风格的编辑界面：

- 查询当前 Blender 场景
- 选择 source model / source action
- 为 source bone 添加 external-parent track
- 在指定帧添加 enabled / disabled keyframe
- 为 enabled keyframe 选择 target root 和 target bone
- 提交 bake 请求，生成 Blender 中可直接播放的 output Action

配套 Blender add-on：

[mmd_ext_parent_baker](https://github.com/qwqsleep-maker/mmd_ext_parent_baker)

### 环境要求

- Node.js
- npm
- 已在 Blender 中启用并启动 `mmd_ext_parent_baker` HTTP 服务

默认服务地址：

```text
http://127.0.0.1:37601
```

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

然后在浏览器中打开 Vite 输出的本地 URL。页面中的 `Base URL` 默认是：

```text
http://127.0.0.1:37601
```

如果你在 Blender add-on 中改了 host 或 port，需要在 Web UI 里同步修改 Base URL。

### 构建发布

构建静态文件：

```powershell
npm run build
```

输出目录：

```text
dist/
```

`dist/` 可以用任意静态文件服务器托管。托管后仍然需要浏览器能访问 Blender 本地 HTTP 服务地址。

### 使用流程

1. 在 Blender 中打开 mmd_tools 场景
2. 启用 `mmd_ext_parent_baker` add-on
3. 确认 HTTP Service 正在运行
4. 打开 Web UI
5. 点击 `Refresh Scene`
6. 选择 `Source Model`
7. 确认 `Source Action`
8. 设置 `Frame Start` / `Frame End`
9. 点击 `Add Track`
10. 选择 source bone
11. 点击 `Add Keyframe`
12. 在 Inspector 中选择 target root 和 target bone
13. 点击 `Bake External Parent`
14. 回到 Blender 播放生成的 output Action

### 帧模式

Web UI 支持两种帧显示/输入模式：

- `Blender Frames`
- `MMD Frames`

`Blender Frames` 直接使用 Blender 真实帧。

`MMD Frames` 用于 mmd_tools 导入 VMD 的场景。mmd_tools 的导入机制通常是：

```text
Blender帧 = VMD帧 + 导入时当前时间线所在帧 + margin
```

因此 Web UI 使用公式：

```text
blenderFrame = mmdFrame + importTimelineFrame + margin
mmdFrame = blenderFrame - importTimelineFrame - margin
```

在 `MMD Frames` 模式下会显示两个额外输入：

- `Import Timeline Frame`
- `Margin`

注意：

- 内部状态和提交给 Blender 的 payload 始终使用 Blender 真实帧
- 切换 `Blender Frames` / `MMD Frames` 不会移动已有 keyframe
- 修改 `Import Timeline Frame` 或 `Margin` 只改变显示数字，不改变内部 Blender 帧位置

### 验证命令

运行测试：

```powershell
npm test
```

构建：

```powershell
npm run build
```

## English

### What It Does

This is the React/Vite web editor for the Blender add-on [mmd_ext_parent_baker](https://github.com/qwqsleep-maker/mmd_ext_parent_baker).

It connects to Blender's local HTTP service and lets you:

- Fetch the current mmd_tools scene
- Select source model/action
- Add one external-parent track per source bone
- Add enabled/disabled keyframes
- Select target root and target bone for enabled keyframes
- Submit bake requests back to Blender

### Requirements

- Node.js
- npm
- Blender running the `mmd_ext_parent_baker` add-on service

Default Blender service URL:

```text
http://127.0.0.1:37601
```

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

Open the local Vite URL in your browser. The UI defaults to:

```text
http://127.0.0.1:37601
```

Update `Base URL` if your Blender add-on uses a different host or port.

### Build

Build static files:

```powershell
npm run build
```

Output:

```text
dist/
```

You can serve `dist/` with any static file server. The browser still needs access to the local Blender HTTP service.

### Workflow

1. Open an mmd_tools scene in Blender
2. Enable and start the `mmd_ext_parent_baker` add-on service
3. Open this web UI
4. Click `Refresh Scene`
5. Select source model and source action
6. Set frame range
7. Add a track
8. Choose the source bone
9. Add keyframes
10. Select target root and target bone
11. Click `Bake External Parent`
12. Play the generated output Action in Blender

### Frame Modes

The UI supports:

- `Blender Frames`
- `MMD Frames`

`Blender Frames` uses real Blender frame numbers directly.

`MMD Frames` is for VMD animations imported through mmd_tools. The conversion is:

```text
blenderFrame = mmdFrame + importTimelineFrame + margin
mmdFrame = blenderFrame - importTimelineFrame - margin
```

When `MMD Frames` is selected, two extra inputs are shown:

- `Import Timeline Frame`
- `Margin`

The request sent to Blender always contains real Blender frame numbers. Switching frame modes changes display values only and does not move existing keyframes.

### Verification

```powershell
npm test
npm run build
```
