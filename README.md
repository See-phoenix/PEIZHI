# PEIZHI 国内配智

API 优先的国内 **装机推荐** + **云服务器/VPS 选型** 系统：规则引擎配单/选型，价格层支持 **A 目录参考价/购买跳转**、**B SerpApi 实时搜索价**，以及 **用户纠价 → 系统校验 → 权威价入库**，供 Web / 手机 / 客户端共用。

## 能力一览

| 模块 | 说明 | 借鉴来源 |
|------|------|----------|
| 装机配智 | 有预算：连续分配；无预算：性能匹配多套对比（防严重拖后腿） | Gestalt / pc-builder / Build Buddy |
| 服务器选型 | 场景+月预算+规格过滤 → 主推/备选套餐 | EC2 Instance Selector、VPS 场景矩阵、云比价站 |
| 价格权威库 | 纠价入库，装机与服务器共用 | Scrabby 历史价思路 |

## 目录

```text
PEIZHI/
  backend/                 FastAPI + SQLite
    data/parts_seed.json   DIY 配件
    data/servers_seed.json 云主机/VPS 套餐
  apps/web/                Next.js（/ 装机，/servers 服务器）
  apps/mobile/             二期说明
  apps/desktop/            二期说明
  packages/openapi/        OpenAPI 契约
```

## 快速启动

### 1. 后端

```bash
cd backend
python -m pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/health

若本地已有旧 `peizhi.db`，重启后会自动合并新增的 server 种子 ID。

### 2. Web

```bash
cd apps/web
npm install
npm run dev
```

- 装机：http://127.0.0.1:3000
- 服务器：http://127.0.0.1:3000/servers

### 3. 导出 OpenAPI

```bash
cd backend
python scripts/export_openapi.py
```

## 环境变量（backend/.env）

| 变量 | 说明 | 默认 |
|------|------|------|
| `ADMIN_TOKEN` | 纠价审核 Token（`X-Admin-Token`） | `peizhi-admin-dev` |
| `SERPAPI_API_KEY` | B 通道实时搜索；空则仅 A | 空 |
| `PRICE_AUTO_VERIFY_THRESHOLD` | 自动入库偏差阈值 | `0.40` |
| `DATABASE_URL` | 数据库 | `sqlite:///./peizhi.db` |
| `CORS_ORIGINS` | 前端源 | `http://localhost:3000,...` |

## 价格优先级

1. **权威价**（纠价校验通过）
2. **实时搜索价**（SerpApi，可选）
3. **目录参考价** + 官网/电商搜索链接（服务器含官网 `official`）

## 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/parts` | 配件列表 |
| POST | `/api/builds/suggest` | 装机推荐 |
| POST | `/api/builds/validate` | 装机校验 |
| GET | `/api/servers` | 服务器套餐列表 |
| POST | `/api/servers/suggest` | 服务器选型 |
| GET | `/api/prices/{part_id}` | 聚合价格（配件与服务器共用） |
| POST | `/api/prices/corrections` | 提交纠价 |
| GET | `/api/prices/verified/{part_id}` | 权威价 |
| POST | `/api/prices/corrections/{id}/review` | 管理员审核 |

### 服务器选型请求示例

```json
{
  "monthly_budget": 100,
  "scene": "website",
  "region_pref": "domestic",
  "min_vcpu": 2,
  "min_memory_gb": 2,
  "include_live_prices": false,
  "limit": 5
}
```

`scene`：`website` | `app` | `database` | `ai` | `overseas` | `dev` | `budget`

## 测试

```bash
cd backend
python -m pytest tests/ -q
```

## Agent Skills（Cursor）

项目已引入前端设计相关 Agent Skills（`SKILL.md` 规范），安装在 `.agents/skills/`，Cursor 会按任务自动匹配加载：

| Skill | 来源 | 用途 |
|------|------|------|
| `design-taste-frontend` | [Taste Skill](https://github.com/Leonxlnx/taste-skill) | 反模板化落地页 / 作品集 / 改版（v2） |
| `web-design-engineer` 等 | [garden-skills](https://github.com/ConardLi/garden-skills) | 网页视觉工程、演示、文章、出图、知识库检索 |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills)（Claude 官方） | 有辨识度的前端审美与排版指引 |

版本锁定见根目录 `skills-lock.json`。更新示例：

```bash
npx skills update -p -y
# 或按包重装
npx skills add Leonxlnx/taste-skill --skill design-taste-frontend -y -a cursor --copy
npx skills add ConardLi/garden-skills --skill '*' -y -a cursor --copy
npx skills add anthropics/skills --skill frontend-design -y -a cursor --copy
```

## License

MIT
