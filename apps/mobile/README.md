# PEIZHI Mobile（二期）

本目录为手机端占位。业务逻辑全部由后端 OpenAPI 提供，**不要在 App 内重复实现配单/兼容/价格规则**。

## 接入方式

1. 启动后端：`http://127.0.0.1:8000`
2. 契约文件：[packages/openapi/openapi.json](../../packages/openapi/openapi.json)
3. 可用 OpenAPI Generator / orval / openapi-typescript 生成客户端

## 建议技术栈

- React Native / Expo，或 Flutter
- 环境变量配置 `API_BASE`

## 首期必接接口

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/builds/suggest` | 生成配置 |
| GET | `/api/prices/{part_id}` | 多通道价格 |
| POST | `/api/prices/corrections` | 用户纠价 |
| GET | `/api/prices/verified/{part_id}` | 权威价 |

纠价通过校验后进入 `verified_prices`，各端读取同一权威价源。
