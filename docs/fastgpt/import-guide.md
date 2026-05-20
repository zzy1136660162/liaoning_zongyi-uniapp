# FastGPT 导入建议

## 建议导入顺序

1. 先导入 `system-prompt.md` 的内容到 FastGPT 的系统提示词。
2. 再导入 `knowledge-base/products/` 目录下的单商品 Markdown。
3. 最后补充导入 `knowledge-base/lnzy_product_knowledge_base.md` 作为汇总知识库。

## 推荐分库方式

- `业务流程库`：放系统提示词中提到的页面路径、流程说明、常见问题。
- `商品知识库`：放本次从 `xls` 生成的产品 Markdown。

## 检索建议

- 商品知识库优先按“单商品一文档”导入，检索更稳定。
- 如果后续 `xls` 更新，重新运行生成脚本并覆盖导入即可。
- 对订单状态、退款状态、物流进度这类实时问题，建议在 FastGPT 工作流中串接业务接口；仅靠知识库无法准确回答实时结果。
