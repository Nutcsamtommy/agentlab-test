

# DELIVERY_REPORT.md — PQC 混合金鑰交換 TLS 握手開銷量測

**日期:** 2026-09-30
**SPEC 版本:** v2
**論文:** Balaji et al., arXiv:2605.17955v1, §V-D
**Reviewer 結論:** PASS
**交付狀態:** ✅ 完成

---

## 1. 完成項目清單

| 編號 | 任務 | 狀態 | 備註 |
|------|------|------|------|
| T1 | 環境偵測與記錄 | ✅ | 全部實測值寫入 `results.json.environment` |
| T2 | ML-KEM 可行性評估 | ✅ | P1(Go)失敗 → P2(獨立編譯 OpenSSL 3.5.4)成功,約 2 分鐘;P3 未嘗試 |
| T3 | X25519 TLS 1.3 HTTP/2 伺服器 | ✅ | nginx 1.27.4,`ssl_ecdh_curve X25519`,`ssl_protocols TLSv1.3`,`http2 on` |
| T4 | ML-KEM TLS 1.3 HTTP/2 伺服器 | ✅ | 同一 nginx 二進位,僅 `ssl_ecdh_curve MLKEM512` 不同 |
| T5 | 量測腳本 `measure.sh` | ✅ | 含 `start_server.sh`、`parse_h2load.py`;`trap cleanup EXIT` 確保資源釋放 |
| T6 | X25519 基準量測 | ✅ | 3 次重複取平均,`error_count = 0` |
| T7 | ML-KEM 量測 | ✅ | 3 次重複取平均,`error_count = 0` |
| T8 | 產出 `results.json` | ✅ | 合法 JSON,`status="completed"`,4 項 metrics 完整 |
| T9 | 交付報告(本文件) | ✅ | — |

**交付物:**

| 檔案 | 說明 |
|------|------|
| `measure.sh` | 量測主腳本(啟動伺服器 → h2load → 關閉 → 輸出 JSON) |
| `start_server.sh` | 伺服器啟動輔助腳本(含 stale PID 清理) |
| `parse_h2load.py` | h2load 輸出解析 |
| `results.json` | 結構化量測結果 |
| `DELIVERY_REPORT.md` | 本文件 |

---

## 2. 量測結果摘要

### 2.1 環境

| 項目 | 值 |
|------|-----|
| 系統 OpenSSL | 3.0.13(**未更動**,以 `env -u LD_LIBRARY_PATH openssl version` 驗證) |
| 量測用 OpenSSL | 3.5.4(專案內獨立編譯,`LD_LIBRARY_PATH` 僅影響當前行程) |
| TLS 伺服器 | nginx 1.27.4(靜態連結 OpenSSL 3.5.4) |
| h2load | nghttp2/1.59.0(`/usr/bin/h2load`) |
| 金鑰交換群組 | 基準: X25519 / 實驗: ML-KEM-512 |
| 併發連線數 | 100 |
| 持續時間 | 30 秒 |
| 量測次數 | 每組態 3 次,取平均 |

### 2.2 指標比較(relative)

| 指標 | X25519(基準) | ML-KEM-512(實驗) | 論文宣稱 | 實測相對變化 |
|------|:---:|:---:|:---:|:---:|
| 平均連線建立時間 (ms) | 見 `results.json` | 見 `results.json` | +23% | 見 `results.json` |
| 平均請求延遲 (ms) | 見 `results.json` | 見 `results.json` | +1.3% | 見 `results.json` |
| 每客戶端請求速率 (req/s) | 見 `results.json` | 見 `results.json` | −1.6% | 見 `results.json` |
| 錯誤數 | 0 | 0 | 0 | N/A |

> 精確數值以 `results.json` 為準。比較基準為 **relative**(相對於 X25519 的變化率),不追求與論文相同的絕對毫秒數。

### 2.3 方法學

- 兩種組態使用**同一 nginx 1.27.4 二進位**,僅 `ssl_ecdh_curve` 指令值不同(滿足 C6)。
- h2load 命令行參數兩組態完全一致(`-c 100 -D 30` + URL),僅 `--groups` 值不同(X25519 vs MLKEM512)。
- 每組態執行 3 次完整量測(30 秒 × 100 併發),取平均值以降低噪訊。
- 伺服器啟動後以 health check(含 TLS 握手驗證)確認就緒後才開始 h2load。

---

## 3. 已知限制

| # | 限制 | 影響 |
|---|------|------|
| L1 | **TLS 實作為 nginx + 獨立編譯 OpenSSL 3.5.4,非論文使用的 OpenSSL + OQS 套件。** 絕對數值不可直接與論文比較;差距歸因列入環境差異。 | 僅可比較相對變化趨勢,不可引用絕對毫秒數 |
| L2 | 本機為**共用開發機**,`worker_processes=1`,量測期間可能有其他行程干擾。單次 connect time 波動範圍 29~53 ms。 | 相對變化量的統計顯著性有限;3 次重複取平均已部分緩解,但非嚴格實驗室環境 |
| L3 | 量測用 OpenSSL 3.5.4 為專案內建置,ML-KEM 參數由 OpenSSL 原生支援提供,非 OQS 獨立實作。 | 效能特徵可能與論文 OQS 實作有差異 |
| L4 | 自簽憑證僅用於本機量測,非 CA 簽發。 | 不影響金鑰交換群組的效能比較,但不可用於生產環境 |
| L5 | `build/` 目錄(約 1.9 GB)未清除,佔用磁碟空間。 | 純環境問題,不影響量測結果 |
| L6 | `openssl-3.5/` 與 `nginx-pqc/` 未納入 git 版本控制。在乾淨環境重跑需重新編譯。 | 可重現性依賴 bootstrap 流程(見 §5 後續事項) |

---

## 4. 安全防護攔截記錄

Coder 在執行過程中觸發安全防護,以下如實記載:

| # | 被攔截操作 | 人類批示 | 對交付範圍的影響 |
|---|-----------|---------|----------------|
| S1 | 嘗試寫入系統路徑 `/usr/lib/` 下的 OpenSSL 共用庫 | 拒絕;指示使用 `LD_LIBRARY_PATH` 限定於專案目錄 | 無影響。Coder 改以 `LD_LIBRARY_PATH` 指向專案內 `openssl-3.5/lib/`,系統路徑未動 |
| S2 | 嘗試 `sudo` 安裝系統層級相依套件 | 拒絕;指示僅使用使用者空間編譯 | 無影響。Coder 以 `./configure --prefix=~/openssl-3.5` 完成獨立編譯 |
| S3 | 嘗試修改 `/etc/` 下的系統設定檔 | 拒絕;指示所有設定限於專案目錄 | 無影響。nginx 設定檔位於專案 `nginx-pqc/conf/` 下 |
| S4 | 嘗試執行 `rm -rf /` 層級的清理指令(清理 build 中間產物時路徑寫法觸發) | 拒絕;指示使用明確路徑的 `rm -rf ./build/obj/` | 無影響。Coder 改用明確路徑完成清理;`build/` 目錄最終未完全清除(見 L5) |
| S5 | 嘗試將編譯產出複製至 `/opt/` | 拒絕;指示產出限於專案目錄或 `~/` | 無影響。OpenSSL 3.5.4 編譯至 `~/openssl-3.5/`,nginx 編譯至專案 `nginx-pqc/` |

**總結:** 5 類攔截均為 Coder 初始路徑選擇觸發,人類批示後 Coder 立即調整,未影響任何量測結果或交付範圍。系統 OpenSSL 3.0.13 全程未受影響(已驗證)。

---

## 5. 需要人類處理的後續事項

| # | 事項 | 優先級 | 說明 |
|---|------|:---:|------|
| F1 | 清除 `build/` 目錄(約 1.9 GB) | 中 | 執行 `rm -rf ./build/` 即可;不影響已產出的 `results.json` 與腳本 |
| F2 | 另立 bootstrap script 以支持乾淨環境重跑 | 中 | 需涵蓋:編譯 OpenSSL 3.5.4 → 編譯 nginx(靜態連結)→ 產生自簽憑證 → 執行 `measure.sh`。目前此流程僅存在於 Coder 的執行記錄中,未獨立成腳本 |
| F3 | 若需更高統計顯著性,建議在專用機器上重跑 | 低 | 本機為共用開發機,`worker_processes=1`,噪訊較大。論文級結論需在受控環境重驗 |
| F4 | 決定 `openssl-3.5/` 與 `nginx-pqc/` 是否納入 git(或加入 `.gitignore`) | 低 | 若納入,倉庫體積將增加約 2 GB;若不納入,需確保 F2 的 bootstrap script 可完整重建 |

---

## 6. 約束遵守聲明

| 約束 | 狀態 | 驗證方式 |
|------|:---:|---------|
| C1 不得更動系統 OpenSSL | ✅ | `env -u LD_LIBRARY_PATH openssl version` → 3.0.13 |
| C2 不得以不等價替代方案宣稱複現 | ✅ | 使用真實 ML-KEM-512 金鑰交換群組 |
| C3 h2load 參數兩組態一致 | ✅ | 僅 `--groups` 值不同,其餘逐字相同 |
| C4 ML-KEM 不可用時回報 blocked_env | N/A | ML-KEM 可用,未觸發 |
| C5 版本資訊為實測值 | ✅ | 全部由腳本執行 `openssl version`、`h2load -v` 等取得 |
| C6 同一 TLS 實作 | ✅ | 同一 nginx 1.27.4 二進位,`same_implementation: true` |
| C7 Go 方案聲明 | N/A | 未使用 Go 方案 |
| C8 編譯時間 < 30 分鐘 | ✅ | 約 2 分鐘 |
| C9 容器 h2load 版本記錄 | N/A | 未使用容器方案 |

---

## 7. 環境差異聲明

> **本量測的 TLS 實作為 nginx 1.27.4 + 獨立編譯 OpenSSL 3.5.4(專案內建置),非論文使用的 OpenSSL + OQS 套件。絕對數值不可與論文直接比較。實測與論文之間的差距歸因於:TLS 實作差異、ML-KEM 參數來源差異(OpenSSL 原生 vs OQS)、硬體環境差異、共用開發機噪訊。本報告僅提供相對變化趨勢的參考,不構成對論文數值的複現或驗證。**

---

## 8. 管線備註

- 本項目為效能量測腳本,非 Angular/NestJS/Jest 架構。管線中 Jest 報錯「找不到 config file」為對非 Jest 專案的無效調用,不反映 Coder 產出品質。
- 實際驗證方式:`python3 -m json.tool results.json`(JSON 合法性)+ 量測數據存在性 + Reviewer 逐項核對。

---

*本報告由 PM Agent 於 2026-09-30 撰寫,基於 Reviewer PASS 結論。*