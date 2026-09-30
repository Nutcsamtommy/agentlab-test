# QA 報告: S001 文獻整理(不改程式碼的 PQC 遷移)

## 基準

本階段無程式碼、無 API、無資料模型(SPEC §6),專案內無 `package.json`/測試框架,
無既有測試套件可跑,亦無 `npm run verify` 可用。這與 `DELIVERY_REPORT.md` §2 的
說明一致(「Jest:不適用」)。**基準判定:不適用,非「基準不通過」,故不直接判
FIX_DEV,依 SPEC §3 驗收條件與附件原文逐項查核交付物。**

為了讓「情境測試」在無程式碼專案下仍可執行、可重複,新增以 Node.js 內建
`node:test` 撰寫的驗證腳本,直接讀取 `LITERATURE_REVIEW.md`、`REFERENCES.md`、
`DELIVERY_REPORT.md` 與附件原文(`attachments/s001/pqc-financial.pdf.txt`),
對照 SPEC §3 各任務驗收條件與「不得編造」規則做自動化查核。

## 新增的情境測試

| 測試檔 | 測試名稱 | 測什麼 | 結果 |
|---|---|---|---|
| tests/literature_review.test.js | single-source disclaimer banner appears before §1 | 單一來源醒目聲明是否在 §1 之前(T2 驗收) | ✅ 通過 |
| tests/literature_review.test.js | TLS termination layer definition is stated | 廣義 TLS 終止層定義是否完整列出(SPEC §1) | ✅ 通過 |
| tests/literature_review.test.js | at least 2 "existing approaches" entries with citations | §1 做法數 ≥2 且每項皆附 [1] 出處(T2 驗收) | ✅ 通過(實際 3 項) |
| tests/literature_review.test.js | at least 4 "known risks" entries, each with a citation | §2 風險數 ≥4 且每項皆附出處(T3 驗收) | ✅ 通過(實際 5 項) |
| tests/literature_review.test.js | conclusion is <=300 characters and self-contained | 結論字數 ≤300 且含單一來源聲明(T4 驗收) | ✅ 通過(實測 265 字) |
| tests/literature_review.test.js | no fabricated placeholders in REFERENCES.md | REFERENCES.md 無 TBD/待補佔位符(T5 驗收) | ✅ 通過 |
| tests/literature_review.test.js | every [N] citation marker used in LITERATURE_REVIEW.md resolves in REFERENCES.md | 主文所有引用標記均可在 REFERENCES.md 找到對應(T5 驗收) | ✅ 通過(僅 [1]) |
| tests/literature_review.test.js | REFERENCES.md has exactly one entry | 僅 1 條參考,符合「單一來源」裁決(SPEC §9 #1) | ✅ 通過 |
| tests/literature_review.test.js | numeric claims are traceable to the source PDF text | 8,443 / 12,875 / 5,982 / 28.9% / 21.8% / 24.7ms / 30.4ms 等數字是否皆可在附件原文逐字追溯(反編造查核) | ✅ 通過 |
| tests/literature_review.test.js | arXiv ID correction is reconstructable from the source watermark | 將附件 .pdf.txt 第 63–67 行逐行反轉重建浮水印文字,驗證是否確實還原為 `arXiv:2605.17955v1 [cs.CR] 18 May 2026`(全案最高風險的單一事實斷言) | ✅ 通過 |
| tests/literature_review.test.js | DELIVERY_REPORT.md truncation claim matches LITERATURE_REVIEW.md §4 | PM 交付報告對「附件是否截斷」的敘述,是否與 LITERATURE_REVIEW.md 本文一致 | ❌ 失敗(見下方發現 1) |

執行方式:`node --test tests/literature_review.test.js`(11 項測試,10 通過、1 失敗,
無需外部框架、無網路依賴、無執行順序或時間依賴)。

## 發現

### 1. DELIVERY_REPORT.md 對「附件是否截斷」的敘述與實際交付物矛盾

- 嚴重度: 中
- 重現: `tests/literature_review.test.js`::`DELIVERY_REPORT.md truncation claim matches LITERATURE_REVIEW.md §4 (internal consistency)`

  具體位置:`DELIVERY_REPORT.md` §3「已知限制」表第 2 列寫「附件文字截斷:部分章節
  未能完整閱讀(已在 `LITERATURE_REVIEW.md` §4 限制中標註)」;但實際打開
  `LITERATURE_REVIEW.md` §4「限制與後續」,原文明確寫的是「**附件截斷:無。**
  本次已完整讀取附件 PDF 全部 16 頁……未發現任何章節被截斷或缺漏」。兩份文件對
  同一件事的陳述完全相反。
- 依據: 此非 SPEC 驗收條件本身的缺陷 —— `LITERATURE_REVIEW.md` 本身在 T1 驗收
  條件「若存在截斷,筆記中標明『§X 起未能完整閱讀』」上是自洽且誠實的(它正確地
  說明了確認「無截斷」的查證過程,包含逐字元核對 PDF 影像)。問題出在
  `DELIVERY_REPORT.md` 這份面向人類決策者的交付報告,其「已知限制」欄位看起來
  是套用了通用範本敘述(截斷風險)而未依實際交付物內容更新,導致下游若只讀
  `DELIVERY_REPORT.md` 而不逐字核對 `LITERATURE_REVIEW.md`,會誤以為本次文獻
  整理有未讀章節、進而誤判 T1 的完整性。這與 SPEC §7「誠實優先於完成」的精神
  (交付報告本身也應誠實反映交付物實際狀態)有落差,建議 PM 更正
  `DELIVERY_REPORT.md` §3 該列文字,使其與 `LITERATURE_REVIEW.md` §4 一致。

**附加驗證(非缺陷,記錄查證過程):** 本次以附件原文逐字核對了 `LITERATURE_REVIEW.md`
中最關鍵、風險最高的一項事實斷言 —— arXiv ID 更正(`2505.17955v1, 2025` →
`2605.17955v1, 2026-05-18`)。實際將 `.pdf.txt` 第 63–67 行(頁面側邊直排浮水印
被解析工具逐行拆散且左右反轉)逐行反轉重組後,確實得到
`arXiv:2605.17955v1 [cs.CR] 18 May 2026`,與文件聲稱完全一致,判定此更正為真、
非編造。另外交叉核對 C1/C2/C3 貢獻標籤、8,443/12,875/5,982 三個資料集規模數字、
28.9%/21.8% 兩項組態風險比例、h2load 效能基準(24.7ms→30.4ms,+23%,C=100)、
所有 §II/§III/§IV/§V 章節出處標號,均與附件原文逐一吻合,未發現任何編造或
超出原文範圍的推測。

## 下一階段建議

- (非目標,SPEC §8 已明確排除)若後續階段需要擴展文獻範圍或做系統性回顧,
  建議提供額外文獻或授予受限網路檢索能力,如 `DELIVERY_REPORT.md` §7 已建議。
- 建議在交付流程中加入「PM 交付報告 vs. 實際交付物」的自動一致性檢查(例如本次
  新增的 `tests/literature_review.test.js` 可保留並在未來階段重複使用/擴充),
  避免交付報告使用通用範本敘述而未依實際內容更新的情況再次發生。
- REFERENCES.md 中 arXiv URL 可達性標註為「待驗證」(因作業環境無網路存取權限),
  建議人類或具備網路能力的流程後續補驗證一次,雖然本階段已誠實揭露、不影響本次
  判定。

## 判定

**PASS** —— `LITERATURE_REVIEW.md` 與 `REFERENCES.md` 逐項對照 SPEC §3 (T1–T5)
驗收條件全數通過,且以附件原文逐字查核後,未發現任何編造、超出原文範圍的推測,
或未經驗證的外部引用;最具風險的 arXiv ID 更正斷言經獨立重建驗證為真。
發現的唯一問題(`DELIVERY_REPORT.md` 截斷敘述與實際交付物矛盾)屬於 PM 交付報告
本身的文字錯誤,不影響 SPEC 對 `LITERATURE_REVIEW.md`/`REFERENCES.md` 的驗收條件,
已於「發現」中列出並建議 PM 更正,不構成 FIX_DEV 或 FIX_SPEC 的門檻。

QA_VERDICT: PASS
