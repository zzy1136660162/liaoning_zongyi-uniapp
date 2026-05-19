from __future__ import annotations

import argparse
import html
import json
import math
import re
from datetime import datetime
from pathlib import Path

import pandas as pd


PROJECT_PROMPT = """# 辽宁中医 FastGPT 系统提示词

你是“辽宁中医”互联网医疗应用内的智能客服，负责为用户提供流程咨询、商品说明和售后引导。你的回答要专业、简洁、稳妥，优先帮助用户完成当前 App/小程序内已经支持的流程。

## 角色与目标

1. 你是院内互联网医疗场景的客服助手，不是临床诊断医生。
2. 你要优先回答以下问题：
   - 在线复诊、申请配药、处方查看、订单查询、支付后查看结果
   - 收货地址、就诊人管理、退款申请、退款记录、退款物流填写
   - 商品基础信息、功效主治、成分、用法用量、适用人群、禁忌、注意事项、贮藏、厂家、批准文号
3. 你要尽量把答案落到页面路径或操作步骤上，而不是泛泛解释。

## 已知业务范围

- 首页与就诊告知
- 商品浏览、商品详情、用药须知、健康问卷
- 在线复诊
- 申请配药
- 药品处方列表与处方详情
- 订单确认、支付成功、订单详情、订单列表
- 退款申请、退款详情、退款记录、填写物流信息
- 收货地址管理
- 就诊人管理
- 联系客服

## 页面路径口径

- 在线复诊 / 申请配药：`申请配药`、`在线复诊`
- 我的订单：`我的 -> 我的订单`
- 药品处方：`我的 -> 药品处方`
- 收货地址：`我的 -> 收货地址`
- 就诊人管理：`我的 -> 就诊人管理`
- 退款相关：`我的订单 -> 订单详情 -> 退款申请 / 退款记录 / 填写物流信息`
- 联系客服：`我的 -> 联系客服`

## 回答规则

1. 优先基于知识库内容回答，不要脱离知识库编造功效、疗效、库存、物流时效、运费、优惠、退款细则。
2. 对商品问题，优先按以下顺序组织：
   - 商品名与规格
   - 功效主治 / 适用场景
   - 用法用量
   - 适用人群
   - 禁忌 / 注意事项
   - 厂家 / 批准文号（如知识库中有）
3. 对流程问题，优先给 1 到 3 步的操作指引，并指出页面入口。
4. 对实时数据问题，例如订单状态、退款状态、支付结果、物流进度：
   - 如果系统没有提供实时结果，不要假装查到了。
   - 明确说明“我当前无法直接读取你的实时订单/退款数据”。
   - 再引导用户去对应页面查看。
5. 如果知识库没有明确信息，直接说“当前资料里没有明确信息”，不要补充猜测。
6. 当用户表达不清时，先追问一个最小必要问题，例如：
   - 你想咨询的是哪一个商品？
   - 你是想查处方、订单、退款还是地址？
7. 回答不要出现“根据系统显示”这类措辞，除非工作流真的提供了结果。

## 安全与边界

1. 你不能做诊断、开方、改方、替代医生结论。
2. 你不能承诺“保证有效”“一定适合”“一定能退款”“肯定能通过复诊审核”。
3. 涉及以下情况时，要提醒用户以医生或药师指导为准：
   - 孕妇、哺乳期、儿童、老人
   - 过敏体质
   - 慢性病、心脑血管病、肝肾疾病
   - 多种药物同时使用
4. 不要索取身份证号、银行卡号、短信验证码等敏感信息。
5. 如果用户描述严重不适、急症、明显不良反应或药物过敏风险，优先建议及时线下就医或联系专业医生。

## 可用上下文变量

如果工作流传入了变量，可以参考但不要反复复述：

- 用户ID：{{userId}}
- 用户姓名：{{userName}}
- 手机号：{{phone}}

只有在确实能帮助回答时才引用这些变量。

## 推荐输出风格

- 流程类：直接给步骤。
- 商品类：先给结论，再补关键说明。
- 无法确认类：明确说明资料不足，再给下一步建议。

## 示例风格

用户：如何修改收货地址？
回答：可以在 `我的 -> 收货地址` 里处理。进入后选择已有地址可编辑，也可以新增地址；如果要作为默认收货地址，保存后再设为默认即可。

用户：这个药怎么吃？
回答：请先告诉我商品名称。我可以按知识库为你整理该商品的规格、功效主治、用法用量、禁忌和注意事项。
"""


def clean_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""

    text = str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    text = text.replace("•", "、")
    text = re.sub(r"[ \u3000]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip(" \n")


def clean_inline(value) -> str:
    return clean_text(value).replace("\n", " ")


def clean_html_text(value) -> str:
    text = clean_text(value)
    if not text:
        return ""
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?is)<img[^>]*>", " ", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def format_price(value) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""

    if number.is_integer():
        return f"{int(number)}.00"
    return f"{number:.2f}"


def safe_int(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def yes_no(value) -> str:
    number = safe_int(value)
    if number is None:
        return ""
    return "是" if number == 1 else "否"


def biz_type_label(value) -> str:
    return {
        1: "院内医疗产品",
        2: "健康产品",
    }.get(safe_int(value), "")


def merchant_type_label(value) -> str:
    return {
        1: "医院自营",
        2: "技术服务商",
    }.get(safe_int(value), "")


def build_keywords(product: dict) -> str:
    parts = [
        product["product_name"],
        product["sub_title"],
        product["spec_text"],
        product["indications"],
        product["suitable_crowd"],
        product["ingredients"],
        product["manufacturer"],
    ]

    keywords = []
    for part in parts:
        text = clean_inline(part)
        if not text:
            continue
        for item in re.split(r"[，,。；;、/\s]+", text):
            item = item.strip()
            if len(item) < 2:
                continue
            if item not in keywords:
                keywords.append(item)
    return "、".join(keywords[:20])


def maybe_section(lines: list[str], title: str, value: str) -> None:
    content = clean_text(value)
    if not content:
        return
    lines.append(f"## {title}")
    lines.append("")
    lines.append(content)
    lines.append("")


def product_markdown(product: dict) -> str:
    lines: list[str] = []
    lines.append(f"# {product['product_name']}")
    lines.append("")
    if product["sub_title"]:
        lines.append(f"> {product['sub_title']}")
        lines.append("")

    lines.append("## 基础信息")
    lines.append("")
    basics = [
        ("商品ID", product["id"]),
        ("价格", f"¥{product['price']}" if product["price"] else ""),
        ("规格", product["spec_text"]),
        ("单位", product["unit"]),
        ("前台分类ID", product["category_id"]),
        ("业务类型", product["biz_type"]),
        ("商家类型", product["goods_merchant_type"]),
        ("处方药", product["is_prescription"]),
        ("需要健康问卷", product["need_questionnaire"]),
        ("院藏名方", product["is_hospital_star_formula"]),
        ("明星产品", product["is_star_product"]),
        ("厂家", product["manufacturer"]),
        ("批准文号", product["approval_number"]),
    ]
    for label, value in basics:
        if value:
            lines.append(f"- {label}：{value}")
    lines.append("")

    maybe_section(lines, "商品简介", product["intro"])
    maybe_section(lines, "功效主治", product["indications"])
    maybe_section(lines, "用法用量", product["usage_text"])
    maybe_section(lines, "适用人群", product["suitable_crowd"])
    maybe_section(lines, "成分", product["ingredients"])
    maybe_section(lines, "禁忌", product["contraindication"])
    maybe_section(lines, "注意事项", product["precautions"])
    maybe_section(lines, "不良反应", product["adverse_reactions"])
    maybe_section(lines, "药物相互作用", product["drug_interactions"])
    maybe_section(lines, "剂型", product["dosage_form"])
    maybe_section(lines, "外观", product["appearance_desc"])
    maybe_section(lines, "包装规格", product["package_spec"])
    maybe_section(lines, "有效期", product["validity_period"])
    maybe_section(lines, "贮藏", product["storage_condition"])
    maybe_section(lines, "温馨提示", product["warm_tips"])

    lines.append("## 标准问答")
    lines.append("")
    lines.append(f"Q：{product['product_name']} 是什么商品？")
    lines.append(
        f"A：{product['product_name']}，规格为 {product['spec_text'] or '未标注'}。"
        f"{f' 副标题：{product['sub_title']}。' if product['sub_title'] else ''}"
    )
    lines.append("")
    lines.append(f"Q：{product['product_name']} 主要用于什么情况？")
    lines.append(f"A：{product['indications'] or '当前资料里没有明确信息。'}")
    lines.append("")
    lines.append(f"Q：{product['product_name']} 怎么使用？")
    lines.append(f"A：{product['usage_text'] or '当前资料里没有明确信息。'}")
    lines.append("")
    lines.append(f"Q：{product['product_name']} 有哪些禁忌或注意事项？")
    caution_answer = "；".join(
        item for item in [product["contraindication"], product["precautions"]] if item
    )
    lines.append(f"A：{caution_answer or '当前资料里没有明确信息。'}")
    lines.append("")
    lines.append(f"Q：{product['product_name']} 的厂家和批准文号是什么？")
    lines.append(
        "A："
        + "；".join(
            item
            for item in [
                f"厂家：{product['manufacturer']}" if product["manufacturer"] else "",
                f"批准文号：{product['approval_number']}" if product["approval_number"] else "",
            ]
            if item
        )
        or "当前资料里没有明确信息。"
    )
    lines.append("")

    if product["keywords"]:
        lines.append("## 检索关键词")
        lines.append("")
        lines.append(product["keywords"])
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def combined_markdown(products: list[dict], source_name: str) -> str:
    lines = [
        "# 辽宁中医产品知识库",
        "",
        f"- 数据来源：`{source_name}`",
        f"- 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- 商品数量：{len(products)}",
        "",
        "本文件适合直接导入 FastGPT 知识库；同时建议搭配 `products/` 目录中的单商品文档一起导入，以提升检索粒度。",
        "",
        "## 商品目录",
        "",
    ]

    for product in products:
        lines.append(f"- `{product['id']}` {product['product_name']}")

    lines.append("")
    lines.append("---")
    lines.append("")

    for index, product in enumerate(products):
        if index > 0:
            lines.append("---")
            lines.append("")
        lines.append(product_markdown(product).rstrip())
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def catalog_markdown(products: list[dict]) -> str:
    lines = [
        "# 产品目录",
        "",
        "| 商品ID | 商品名 | 规格 | 价格 | 业务类型 | 处方药 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]

    for product in products:
        lines.append(
            f"| {product['id']} | {product['product_name']} | {product['spec_text'] or '-'} | "
            f"{f'¥{product['price']}' if product['price'] else '-'} | {product['biz_type'] or '-'} | {product['is_prescription'] or '-'} |"
        )

    lines.append("")
    return "\n".join(lines)


def import_guide_markdown() -> str:
    return """# FastGPT 导入建议

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
"""


def to_product_record(row: pd.Series) -> dict:
    usage_text = clean_text(row.get("usage_desc")) or clean_text(row.get("common_usage"))
    record = {
        "id": str(safe_int(row.get("id")) or clean_inline(row.get("id"))),
        "product_name": clean_inline(row.get("product_name")),
        "sub_title": clean_inline(row.get("sub_title")),
        "price": format_price(row.get("price")),
        "spec_text": clean_inline(row.get("spec_text")),
        "unit": clean_inline(row.get("unit")),
        "category_id": str(safe_int(row.get("category_id")) or ""),
        "biz_type": biz_type_label(row.get("biz_type")),
        "goods_merchant_type": merchant_type_label(row.get("goods_merchant_type")),
        "is_prescription": yes_no(row.get("is_prescription")),
        "need_questionnaire": yes_no(row.get("need_questionnaire")),
        "is_hospital_star_formula": yes_no(row.get("is_hospital_star_formula")),
        "is_star_product": yes_no(row.get("is_star_product")),
        "intro": clean_html_text(row.get("intro")),
        "indications": clean_text(row.get("indications")),
        "usage_text": usage_text,
        "suitable_crowd": clean_text(row.get("suitable_crowd")),
        "ingredients": clean_text(row.get("ingredients")),
        "contraindication": clean_text(row.get("contraindication")),
        "precautions": clean_text(row.get("precautions")),
        "adverse_reactions": clean_text(row.get("adverse_reactions")),
        "drug_interactions": clean_text(row.get("drug_interactions")),
        "dosage_form": clean_text(row.get("dosage_form")),
        "appearance_desc": clean_text(row.get("appearance_desc")),
        "package_spec": clean_text(row.get("package_spec")),
        "validity_period": clean_text(row.get("validity_period")),
        "storage_condition": clean_text(row.get("storage_condition")),
        "manufacturer": clean_text(row.get("manufacturer")),
        "approval_number": clean_text(row.get("approval_number")),
        "warm_tips": clean_text(row.get("warm_tips")),
    }
    record["keywords"] = build_keywords(record)
    return record


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate FastGPT prompt and product knowledge base files.")
    parser.add_argument("--xls", required=True, help="Absolute path of the lnzy_product.xls file.")
    parser.add_argument(
        "--output",
        default="docs/fastgpt",
        help="Output directory relative to the project root. Default: docs/fastgpt",
    )
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    xls_path = Path(args.xls)
    output_root = project_root / args.output
    kb_root = output_root / "knowledge-base"
    product_root = kb_root / "products"

    if not xls_path.exists():
        raise FileNotFoundError(f"XLS file not found: {xls_path}")

    df = pd.read_excel(xls_path)
    products = [to_product_record(row) for _, row in df.iterrows()]

    write_text(output_root / "system-prompt.md", PROJECT_PROMPT)
    write_text(output_root / "import-guide.md", import_guide_markdown())
    write_text(kb_root / "lnzy_product_catalog.md", catalog_markdown(products))
    write_text(kb_root / "lnzy_product_knowledge_base.md", combined_markdown(products, xls_path.name))

    for product in products:
        file_name = f"product-{str(product['id']).zfill(3)}.md"
        write_text(product_root / file_name, product_markdown(product))

    summary = {
        "source": str(xls_path),
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "productCount": len(products),
        "files": {
            "prompt": "system-prompt.md",
            "guide": "import-guide.md",
            "catalog": "knowledge-base/lnzy_product_catalog.md",
            "combinedKnowledgeBase": "knowledge-base/lnzy_product_knowledge_base.md",
            "productDirectory": "knowledge-base/products",
        },
        "products": [
            {
                "id": product["id"],
                "productName": product["product_name"],
                "price": product["price"],
                "specText": product["spec_text"],
            }
            for product in products
        ],
    }
    write_text(output_root / "manifest.json", json.dumps(summary, ensure_ascii=False, indent=2) + "\n")

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
