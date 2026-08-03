# 多端 OpenAPI 契约

由后端导出：

```bash
cd backend
python scripts/export_openapi.py
```

生成文件：`openapi.json`

## 使用建议

- **Web**：`apps/web` 已通过 `fetch` 对接
- **Mobile / Desktop**：用该 schema 生成客户端，避免手写 DTO 漂移

在线调试也可打开后端 Swagger：`http://127.0.0.1:8000/docs`
