# PEIZHI Desktop（二期）

本目录为桌面客户端占位（Tauri / Electron）。与 Web、手机端共用同一 FastAPI 后端。

## 接入方式

1. 后端地址可配置（默认 `http://127.0.0.1:8000`）
2. 使用 [packages/openapi/openapi.json](../../packages/openapi/openapi.json) 生成类型与 SDK
3. UI 可复用 Web 的交互流程：表单 → 配置单 → 跳转购买 → 纠价入库

## 生成 TypeScript 客户端示例

```bash
npx openapi-typescript ../../packages/openapi/openapi.json -o ./src/api-types.ts
```

## 注意

- 桌面端可做本地价格收藏/离线缓存，但**写入权威价必须走** `POST /api/prices/corrections`
- Admin 审核接口需要请求头 `X-Admin-Token`
