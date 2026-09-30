

# SPEC.md — PQC 混合金鑰交換 TLS 握手開銷量測

**日期:** 2026-09-30
**來源需求:** stage_s002.md
**論文:** Balaji et al., arXiv:2605.17955v1, §V-D
**版本:** v2(整合人類回覆)

---

## 1. 目標與範圍

在本機環境下,以 h2load 對一個 TLS 1.3 HTTP/2 伺服器進行量測,比較 **X25519**(基準)與 **ML-KEM-512**(或環境僅支援的 X25519MLKEM768)兩種金鑰交換群組的:

- 平均連線建立時間
- 端對端請求延遲
- 每客戶端請求速率
- 錯誤數

比較基準為 **relative**(相對於 X25519 的變化率),不追求與論文相同的絕對毫秒數。

### 非目標(明確排除)

- 不複現 §III 組態解析框架
- 不複現 §IV 大規模 Nginx 量測
- 不複現 §V-A~C OCBC 實際部署
- 不做 ML-DSA 憑證層實驗
- 不追求論文絕對數值
- **不以不等價替代方案宣稱複現**

---

## 2. 技術棧說明

本項目為 **效能量測腳本**,非典型 Web 應用。實作為:

| 層 | 技術 |
|---|---|
| 量測腳本 | Bash(或 Python,取本機可用者) |
| TLS 伺服器 | 依 T2 評估結果決定(見 §3 T2) |
| 負載工具 | h2load(nghttp2/1.59.0,路徑 `/usr/bin/h2load`) |
| 產出 | results.json(純資料,無 API) |
| 驗證 | 腳本可重複執行 + JSON schema 檢查 |

> 本項目不涉及 Angular / NestJS / Jest 前端後端架構。

### 已確認環境事實

| 項目 | 值 |
|---|---|
| h2load | 已安裝,nghttp2/1.59.0,`/usr/bin/h2load` |
| 系統 OpenSSL | 3.0.13(不支援 ML-KEM,不得更動) |
| Docker/Podman | 未確認,需 T2 中偵測 |
| Go 1.24+ | 未確認,需 T2 中偵測 |

---

## 3. 任務清單

### T1 — 環境偵測與記錄

**描述:** 偵測本機 OpenSSL 版本、h2load 版本(已知 nghttp2/1.59.0)、CPU 型號、作業系統版本、Go 版本(若存在)、Docker/Podman 版本(若存在)。將結果寫入 `results.json` 的 `environment` 欄位。

**驗收條件:**
- 執行 `openssl version` 輸出被記錄
- 執行 `h2load -v` 結果被記錄(預期 `nghttp2/1.59.0`)
- `lscpu` 或 `sysctl -n machdep.cpu.brand_string` 的 CPU 資訊被記錄
- `go version`(若存在)被記錄;不存在則記錄 `"go_version": "not_found"`
- `docker --version` 或 `podman --version`(若存在)被記錄;皆不存在則記錄 `"container_runtime": "not_found"`
- `results.json` 中 `environment` 物件含 `openssl_version`、`h2load_version`、`cpu`、`os`、`concurrency`(=100)、`duration_seconds`(=30)

---

### T2 — ML-KEM 可行性評估(關鍵分支)

**描述:** 依以下**固定優先順序**評估,判斷本機能否取得支援 ML-KEM 的 TLS 環境:

| 優先序 | 方案 | 判定條件 |
|---|---|---|
| **P1** | Go 1.24+ `crypto/tls` | `go version` ≥ 1.24,且可編譯出 TLS 1.3 HTTP/2 伺服器 |
| **P2** | 獨立編譯 OpenSSL 3.5+ | 可編譯至 `/opt/openssl-3.5/` 或 `~/openssl-3.5/`,不影響系統路徑 |
| **P3** | 容器(Docker/Podman) | `docker` 或 `podman` 存在,可拉取含 OpenSSL 3.5+ 的映像 |
| **P4** | 本機原生 OpenSSL | 已知 3.0.13,不支援 ML-KEM → **直接排除** |

**各方案約束:**

- **P1 (Go):**
  - 基準組(X25519)與實驗組(ML-KEM)**必須使用同一套 Go `crypto/tls` 實作**,只變動金鑰交換群組。
  - 不得用 Go 跑 ML-KEM、用 OpenSSL 跑 X25519(無效比較)。
  - 若採用此方案,`status` 仍可為 `completed`,但 `notes` 必須寫明:「TLS 實作為 Go crypto/tls,非論文使用的 OpenSSL+OQS,絕對數值不可比。差距歸因列入環境差異。」

- **P2 (獨立編譯):**
  - 編譯目標路徑:`/opt/openssl-3.5/` 或 `~/openssl-3.5/`。
  - **絕對不得更動系統路徑的 OpenSSL。**
  - 若編譯時間超過 **30 分鐘**或相依性不足,不必勉強,記錄嘗試過程後改走 P3。

- **P3 (容器):**
  - 需先確認 `docker --version` 或 `podman --version` 存在。
  - 拉取含 OpenSSL 3.5+ 的映像(如 `openssl:3.5` 或自建)。
  - 容器內外的 h2load 版本可能不同,**可接受**,但必須在 `results.json` 的 `environment` 中記錄宿主機與容器內兩者的實際版本。
  - 容器內的 TLS 伺服器與宿主機的 h2load 之間需有網路通路(通常 `localhost` 或 `--network host`)。

**驗收條件:**
- 評估結果記錄於 `results.json` 的 `environment.mlkem_availability` 欄位,值為:
  - `"go"`(P1 成功)
  - `"standalone_build"`(P2 成功)
  - `"container"`(P3 成功)
  - `"unavailable"`(P1~P3 皆失敗)
- 若為 `unavailable`,T3~T7 跳過,直接進入 T8(blocked_env 路徑)
- 若為其他值,記錄實際使用的工具與版本於 `environment.mlkem_tool_detail`
- 評估過程(嘗試了哪些方案、各自結果)記錄於 `notes`

**約束:**
- **不得升級或替換系統 OpenSSL**
- 若使用 Go,必須確認其 TLS 1.3 實作與 h2load 的 HTTP/2 協定相容;若不相容,視為該方案失敗,繼續下一優先序
- 不得以「用 AES-GCM 替代 ML-KEM」等方式產出數字並宣稱複現

---

### T3 — 建立 TLS 1.3 HTTP/2 伺服器(X25519 組態)

**描述:** 啟動一個 TLS 1.3 HTTP/2 伺服器,金鑰交換群組固定為 X25519,回應固定大小的 HTTP/2 回應(1 KB JSON)。

**TLS 實作:** 依 T2 結果決定(Go / 獨立編譯 OpenSSL / 容器內 OpenSSL)。

**驗收條件:**
- 伺服器可被 `curl --http2 -v https://localhost:<port>/` 成功連線
- TLS 1.3 握手成功,金鑰交換群組為 X25519(以 `openssl s_client` 或 `curl -v` 輸出確認)
- 回應體大小固定(記錄於腳本,兩組態相同)

---

### T4 — 建立 TLS 1.3 HTTP/2 伺服器(ML-KEM 組態)

**描述:** 同 T3,但金鑰交換群組改為 ML-KEM-512(或環境僅支援的 X25519MLKEM768)。若環境只支援混合群組,記錄實際群組名稱。

**TLS 實作:** **必須與 T3 使用同一套 TLS 實作**(同一語言/同一二進位/同一容器映像),只變動金鑰交換群組參數。

**驗收條件:**
- 伺服器可被 h2load 成功連線
- TLS 1.3 握手成功,金鑰交換群組為 ML-KEM-512 或 X25519MLKEM768(記錄實際值)
- 回應體大小與 T3 完全相同
- TLS 實作與 T3 一致(記錄於腳本註解或 `results.json`)

> 若 T2 判定 `unavailable`,本任務不執行。

---

### T5 — 撰寫量測腳本

**描述:** 建立 `measure.sh`(或 `measure.py`),接受一個參數表示組態(`x25519` / `mlkem`),啟動對應伺服器、執行 h2load 量測、關閉伺服器,輸出結構化結果。

**固定參數(兩種組態必須相同):**

| 參數 | 值 |
|---|---|
| 併發連線數 | 100 |
| 持續時間 | 30 秒 |
| 請求路徑 | `/` |
| 請求方法 | GET |
| 回應大小 | 固定 1 KB(由伺服器端決定,兩組態相同) |
| h2load 額外參數 | 不附加(或記錄任何必要參數) |

**驗收條件:**
- 腳本存在於 project 目錄下
- 執行 `./measure.sh x25519` 與 `./measure.sh mlkem` 時,除伺服器端金鑰交換群組外,h2load 的命令行參數完全一致(可用 `set -x` 或腳本內 echo 驗證)
- 腳本可重複執行(第二次執行不會因殘留狀態失敗;需處理 port 佔用)
- 腳本輸出包含:平均連線建立時間(ms)、平均請求延遲(ms)、請求速率(req/s)、錯誤數
- 腳本負責啟動與關閉伺服器(或提供 `start_server.sh <config>` / `stop_server.sh` 輔助腳本)

---

### T6 — 執行 X25519 基準量測

**描述:** 啟動 X25519 伺服器,執行 `./measure.sh x25519`,記錄結果。

**驗收條件:**
- 量測完成,錯誤數 = 0(若非零,記錄實際值)
- 結果暫存供 T8 使用

---

### T7 — 執行 ML-KEM 量測

**描述:** 啟動 ML-KEM 伺服器,執行 `./measure.sh mlkem`,記錄結果。

**驗收條件:**
- 量測完成,錯誤數 = 0(若非零,記錄實際值)
- 結果暫存供 T8 使用

> 若 T2 判定 `unavailable`,本任務不執行。

---

### T8 — 產出 results.json

**描述:** 彙整 T1~T7 結果,寫入 `results.json`。

**驗收條件:**
- 檔案存在且為合法 JSON(`python3 -m json.tool results.json` 或 `jq .` 通過)
- `comparison_basis` 欄位值為 `"relative"`
- `status` 欄位值為 `"completed"` 或 `"blocked_env"`
- 若 `status` = `"completed"`:
  - `metrics` 陣列含 4 個物件,每個有 `name` / `baseline` / `measured` / `claimed_change` / `relative_change`
  - `baseline` 為 X25519 實測值
  - `measured` 為 ML-KEM 實測值
  - `claimed_change` 為論文宣稱的變化(字串,如 `"+23%"`)
  - `relative_change` 為 `(measured - baseline) / baseline` 的百分比
  - 若 TLS 實作為 Go(非 OpenSSL+OQS),`notes` 必須包含環境差異聲明(見 T2 P1 約束)
- 若 `status` = `"blocked_env"`:
  - `metrics` 為空陣列或不存在
  - `notes` 欄位寫明:缺少什麼、嘗試過哪些方案(P1/P2/P3)、各自卡在哪裡、為何不可行
- `environment` 欄位完整(見 T1)
- 若使用容器方案,`environment` 中須記錄宿主機 h2load 版本與容器內 h2load 版本

---

### T9 — 撰寫交付報告

**描述:** 由 PM 在 Reviewer 通過後撰寫 `DELIVERY_REPORT.md`。

**驗收條件:**
- 含完成項目清單
- 含測試/量測結果摘要
- 含已知限制
- 含需要人類處理的後續事項
- 若 T2 觸發 blocked_env,如實記載評估過程(嘗試了哪些方案、各自卡在哪裡)
- 若使用 Go 方案,明確寫出「TLS 實作為 Go crypto/tls,非論文使用的 OpenSSL+OQS,絕對數值不可比」
- 若 Coder 被安全防護攔截,如實記載被攔截的操作、人類批示內容、對交付範圍的影響

---

## 4. 資料模型(results.json Schema)

```jsonc
{
  "comparison_basis": "relative",
  "status": "completed" | "blocked_env",
  "environment": {
    "openssl_version": "OpenSSL 3.0.13 30 Jan 2024",
    "h2load_version": "nghttp2/1.59.0",
    "h2load_version_container": "nghttp2/1.62.0",  // 僅容器方案時存在
    "cpu": "Apple M2" | "Intel Xeon ...",
    "os": "macOS 15.1" | "Ubuntu 24.04",
    "go_version": "go1.24.1" | "not_found",
    "container_runtime": "Docker version 27.0" | "not_found",
    "concurrency": 100,
    "duration_seconds": 30,
    "mlkem_availability": "go" | "standalone_build" | "container" | "unavailable",
    "mlkem_tool_detail": "go1.24.1 crypto/tls" | "OpenSSL 3.5.0 (~/openssl-3.5/)" | "container: openssl:3.5"
  },
  "key_exchange_groups": {
    "baseline": "X25519",
    "measured": "ML-KEM-512" | "X25519MLKEM768"
  },
  "tls_implementation": {
    "baseline": "go crypto/tls" | "OpenSSL 3.5.0 s_server" | "container openssl s_server",
    "measured": "go crypto/tls" | "OpenSSL 3.5.0 s_server" | "container openssl s_server",
    "same_implementation": true  // 必須為 true
  },
  "metrics": [
    {
      "name": "avg_connection_establishment_time_ms",
      "baseline": 24.7,
      "measured": 30.4,
      "claimed_change": "+23%",
      "relative_change": "+23.1%"
    },
    {
      "name": "avg_request_latency_ms",
      "baseline": 12.3,
      "measured": 12.5,
      "claimed_change": "+1.3%",
      "relative_change": "+1.6%"
    },
    {
      "name": "requests_per_second_per_client",
      "baseline": 80.5,
      "measured": 78.8,
      "claimed_change": "-1.6%",
      "relative_change": "-2.1%"
    },
    {
      "name": "error_count",
      "baseline": 0,
      "measured": 0,
      "claimed_change": "0",
      "relative_change": "N/A"
    }
  ],
  "notes": "任何補充說明。若 TLS 實作為 Go:「TLS 實作為 Go crypto/tls,非論文使用的 OpenSSL+OQS,絕對數值不可比。差距歸因列入環境差異。」若 blocked_env: 記錄嘗試過程。"
}
```

> 上例數值僅為格式示範,非預期結果。

---

## 5. API 契約(量測腳本介面)

本項目無 HTTP API。腳本介面如下:

### measure.sh / measure.py

```
用法: ./measure.sh <config>
參數:
  config: "x25519" | "mlkem"
行為:
  1. 啟動對應組態的 TLS 1.3 HTTP/2 伺服器
  2. 等待伺服器就緒(health check)
  3. 執行 h2load 量測
  4. 關閉伺服器
  5. 輸出結構化結果
輸出(stdout): 結構化量測結果(供腳本解析)
輸出(stderr): 除錯資訊
退出碼: 0 = 成功, 1 = 失敗(伺服器未啟動、h2load 錯誤等)
```

### h2load 固定參數

```
h2load -c 100 --timeout 30000 https://localhost:<port>/
```

> 實際參數以腳本內固定值為準;兩種組態的 h2load 命令行必須逐字相同(除 port 若不同)。

---

## 6. 執行流程

```
T1 環境偵測
  └→ T2 ML-KEM 可行性評估(優先序: Go → 獨立編譯 → 容器)
       ├→ unavailable → T8 (status=blocked_env) → T9
       └→ 可用 → T3 啟動 X25519 伺服器(同一 TLS 實作)
                  └→ T5 確認量測腳本
                       └→ T6 執行 X25519 量測
                            └→ T4 啟動 ML-KEM 伺服器(同一 TLS 實作)
                                 └→ T7 執行 ML-KEM 量測
                                      └→ T8 產出 results.json
                                           └→ T9 交付報告
```

---

## 7. 約束與紅線

| # | 約束 |
|---|---|
| C1 | **不得升級、替換或移除系統 OpenSSL** |
| C2 | 不得以不等價替代方案(如僅改對稱加密、改 TLS 版本)產出數字並宣稱複現 |
| C3 | 兩種組態的 h2load 參數(除金鑰交換群組外)必須完全相同 |
| C4 | 若 ML-KEM 不可用,必須回報 `blocked_env`,不得降級為「只跑 X25519 然後估算」 |
| C5 | 所有版本資訊必須為實測值,不得手填 |
| C6 | **基準組與實驗組必須使用同一套 TLS 實作**(同一語言/二進位/容器映像),只變動金鑰交換群組。用 Go 跑 ML-KEM、用 OpenSSL 跑 X25519 是無效比較 |
| C7 | 若使用 Go 方案,`notes` 與交付報告必須聲明「TLS 實作為 Go crypto/tls,非論文使用的 OpenSSL+OQS,絕對數值不可比」 |
| C8 | 獨立編譯 OpenSSL 時,編譯時間上限 30 分鐘;超時或相依性不足則放棄,改走下一優先序 |
| C9 | 容器方案中,宿主機與容器內的 h2load 版本若不同,必須在 `environment` 中分別記錄 |

---

## 8. 交付物清單

| 檔案 | 說明 |
|---|---|
| `measure.sh`(或 `.py`) | 量測腳本(含伺服器啟動/關閉邏輯) |
| `results.json` | 量測結果 |
| `DELIVERY_REPORT.md` | 交付報告(PM 撰寫) |

---

## 待人類確認

無待確認事項。

> 所有五項待確認事項已於 HUMAN_INBOX.md 中回覆,並整合至本 SPEC v2。Coder 可依據 T2 的優先順序(Go → 獨立編譯 → 容器)依序嘗試,無需再等待人類批准。