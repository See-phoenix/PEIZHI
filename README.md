# PEIZHI 国内装机配智

API 优先的国内 DIY 装机推荐与选购系统：规则引擎配单 + 兼容校验，价格层同时支持 **A 目录参考价/电商搜索跳转** 与 **B SerpApi 购物实时价**，并支持 **用户纠价 → 系统校验 → 权威价入库**，供 Web / 手机 / 客户端共用。

## 目录

```text
PEIZHI/
  backend/           FastAPI + SQLite
  apps/web/          Next.js Web（首期）
  apps/mobile/       手机端接入说明（二期）
  apps/desktop/      桌面端接入说明（二期）
  packages/openapi/  OpenAPI 契约
```

## 快速启动

### 1. 后端

```bash
cd backend
python -m pip install -r requirements.txt
copy .env.example .env   # Windows；按需填写 SERPAPI_API_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/health

### 2. Web

```bash
cd apps/web
npm install
npm run dev
```

打开 http://127.0.0.1:3000

### 3. 导出 OpenAPI（多端）

```bash
cd backend
python scripts/export_openapi.py
```

## 环境变量（backend/.env）

| 变量 | 说明 | 默认 |
|------|------|------|
| `ADMIN_TOKEN` | 纠价审核管理员 Token（请求头 `X-Admin-Token`） | `peizhi-admin-dev` |
| `SERPAPI_API_KEY` | B 通道实时购物搜索；为空则仅 A 通道 | 空 |
| `PRICE_AUTO_VERIFY_THRESHOLD` | 相对参考价偏差在此内自动入库（0.4=±40%） | `0.40` |
| `DATABASE_URL` | 数据库 | `sqlite:///./peizhi.db` |
| `CORS_ORIGINS` | 允许的前端源 | `http://localhost:3000,...` |

## 价格优先级

1. **权威价**（用户纠价且校验通过）
2. **实时搜索价**（SerpApi，可选）
3. **目录参考价** + 京东 / 天猫 / 拼多多搜索链接

纠价规则摘要：

- 价格 ≤0 拒绝
- 相对目录价低于 0.2 倍或高于 3 倍：自动拒绝
- 偏差超过阈值：进入 `pending`，需管理员 `verify`
- 通过后写入 `verified_prices` + `price_history`

## 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/parts` | 配件列表 |
| POST | `/api/builds/suggest` | 推荐配置 |
| POST | `/api/builds/validate` | 校验配置 |
| GET | `/api/prices/{part_id}` | 聚合价格 |
| POST | `/api/prices/corrections` | 提交纠价 |
| GET | `/api/prices/verified/{part_id}` | 读取权威价 |
| POST | `/api/prices/corrections/{id}/review` | 管理员审核 |

## 测试

```bash
cd backend
python -m pytest tests/ -q
```

## 设计来源（思路复用）

- Gestalt：价格可插拔与降级
- pc-builder：suggest / validate API
- Build Buddy：多维兼容校验
- MetaBuild / 区域比价站：区域购买链接与多商家价

## License

MIT（练习项目，可自由修改）
