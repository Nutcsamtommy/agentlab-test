# 文獻整理:以反向代理(WAF)完成 PQC 遷移的既有做法與已知風險

> 檢索範圍:2024 年(含)之後,聚焦 TLS 終止層遷移策略。
> 本文件非系統性回顧,非定量統合分析。
> ⚠️ **本整理僅基於單一來源(Balaji et al., 2026,arXiv:2605.17955v1 [1])。**
> TLS 終止層定義:WAF、反向代理、API gateway、load balancer、web server。
>
> ⚠️ **出處年份/識別碼更正:** SPEC.md 原標註本文獻為
> `arXiv:2505.17955v1, 2025`。經逐字元核對附件 PDF 首頁側邊直排文字
> (反轉後為 `arXiv:2605.17955v1 [cs.CR] 18 May 2026`)並直接讀取原始 PDF 影像複核,
> 確認正確識別碼為 **arXiv:2605.17955v1(2026 年 5 月 18 日)**。本文件全文採用
> 此經核實版本;詳見 `REFERENCES.md`「出處驗證備註」。

## 1. 既有做法

### 1.1 配置解析 → 正規化 → 策略比對的組態能見度框架

- **適用場景:** 金融機構等擁有異質 TLS 終止元件(Nginx、Apache、Spring Boot 等)
  的環境,用於盤點量子就緒現況、產出可稽核的加密清冊,並排序遷移優先順序。
- **關鍵技術:** 三階段 PARSE→NORMALIZE→COMPARE pipeline;將各技術原生組態
  正規化為技術無關的「統一 TLS 模型」(Unified TLS Model, UTM),每個欄位附
  `derived_from` 溯源紀錄;以量子就緒策略(quantum-readiness policy)比對
  NIST SP 800-52、PCI-DSS v4.0、CIS Benchmarks 等基準,將每組密碼套件依其是否
  易受 Shor/Grover 演算法攻擊分類;並定義五階段遷移生命週期
  Discover → Assess → Prioritize → Migrate → Verify,形成持續性監控迴圈。
- **是否需應用層改動:** 否 —— 此為盤點/規劃工具本身,不涉及應用層修改;
  其目的是回答「每個終止點目前被設定為允許使用什麼密碼學」這個問題。
- **出處:** [1] §III-A(動機與設計目標)、§III-B(三階段架構、UTM)、
  §III-D(五階段遷移生命週期)。

### 1.2 於 TLS 終止點就地啟用 hybrid PQC 金鑰交換

- **適用場景:** 金融機構內部應用之正式環境概念驗證(PoC)部署,涵蓋
  對外 web server(Apache,作為反向代理)與內部 API gateway(Java/Spring Boot)
  兩層終止點,用以保護指向內部銀行應用的所有 TLS 連線。
- **關鍵技術:** hybrid key exchange —— web server 層透過升級 OpenSSL 並整合
  Open Quantum Safe(OQS)provider,啟用 X25519-ML-KEM-768;API gateway 層則在
  JVM 啟動時以 `Security.insertProviderAt` 註冊 BouncyCastle 的 JSSE/PQC provider,
  於 JCA/JSSE 層啟用 ML-KEM-512 / X25519-ML-KEM-768,兩者皆保留對不支援 hybrid
  群組之舊客戶端的回退相容性;所有元件以 Docker 容器化部署以確保環境一致性。
- **是否需應用層改動:** 否 —— 論文明確聲明「zero application-layer changes」,
  銀行應用程式本身未被修改;此為論文所稱「layer-by-layer migration」策略,
  由最外層終止點開始、逐層向內遷移。
- **出處:** [1] §V-A(部署情境與威脅模型)、§V-B(三層架構)、
  §V-C(web server / API gateway 實作)、§V-E(a)(b)(經驗教訓)。

### 1.3 大規模組態量測作為採用基準線與風險量化方法

- **適用場景:** 在實際啟動遷移前,先以公開、可重現的方式量化「現況」——
  即某一 TLS 終止技術(以論文為例為 Nginx)在真實世界中的量子脆弱性
  暴露程度,作為衡量未來 PQC 採用進度、排序整治優先順序的基準線,
  而非直接介入單一機構的遷移執行。
- **關鍵技術:** 四階段蒐集流程(GitHub Code Search API 枚舉候選檔案 →
  Contents API 抓取內容並以 SHA-256 去重 → 信心分類器過濾非組態檔 →
  依 repository 的 `archived` 旗標與最後 push 時間分類為 active/archived)
  取得 8,443 份去重後的 Nginx 組態檔(共解析出 12,875 個 server-block,
  其中 5,982 個啟用 TLS),再套用與 1.1 相同的解析/正規化管線分析
  協定版本、cipher 套件、金鑰交換與憑證管理等面向。論文報告:該語料庫中
  post-quantum hybrid 金鑰交換採用率為零;28.9% 組態使用無前向保密的
  RSA 金鑰交換;21.8% 組態仍允許 TLS 1.0 或 1.1。
- **是否需應用層改動:** 不適用 —— 此為量測/研究方法,非遷移執行步驟,
  不涉及對任何被量測系統的改動。
- **出處:** [1] §IV-A(Dataset Construction,含四階段蒐集流程與
  8,443/12,875/5,982 等數字)、§IV-B RQ1(協定採用)、RQ3(量子脆弱性
  暴露面,零 PQC 採用、28.9% RSA 無前向保密)、§VI(結論中重申
  28.9%、21.8% 數字)。

## 2. 已知風險

### 2.1 配置能見度不足:「允許但未協商」的落差

網路層掃描器(如 Qualys SSL Labs、testssl.sh)只能觀察實際協商的握手行為,
無法揭露配置檔案中仍被允許、但從未在正常流量下被觸發的過時協定版本、
weak cipher fallback,或 HSM-backed 金鑰參照;伺服器可能在每次握手都協商
TLS 1.3 與強密碼套件,但其配置檔仍列出 TLS 1.0 作為允許的 fallback ——
這對掃描器而言是不可見的攻擊面。這正是論文設計配置層級解析框架的核心動機。
**出處:** [1] §II-C(TLS as the Primary Migration Surface)、
§III-A(Motivation and Design Goals 中對 network-level scanners 侷限性的討論)。

### 2.2 異質終止元件的管理複雜度

金融機構的 TLS 終止並非集中式,而是分散在 load balancer、CDN edge node、
API gateway、reverse proxy、應用層 web server 等元件上,各自獨立協商加密參數
與管理憑證/私鑰;每種技術透過不同介面暴露組態、使用不同指令命名與繼承語意,
目前不存在能統一查詢並比較這些元件加密狀態的共通工具。論文本身提出的框架
也僅涵蓋 Nginx、Apache、Spring Boot,HAProxy、Envoy、IIS、Tomcat 與雲端託管
TLS 服務均未涵蓋,擴充涵蓋範圍被列為直接的後續工作方向。
**出處:** [1] §II-C、§IV-D(b)(Technology coverage 限制)。

### 2.3 效能開銷(100 併發客戶端基準)

論文以 h2load 在 C=100 併發客戶端、30 秒測試下,比較 X25519(基準)與
ML-KEM-512(PQC 啟用)兩種組態:平均連線建立時間(time-for-connect)
由 24.7 ms 增至 30.4 ms(約 +23%),反映 TLS 握手中 ML-KEM 金鑰封裝的額外
運算成本;端對端請求延遲平均增加約 1.3%,每客戶端請求速率下降約 1.6%;
所有測試回合在兩種組態下皆為零錯誤。論文將此開銷評估為「在連線可重用、
資料具有數十年機密性需求的金融機構情境下,屬於可接受的權衡」。
**出處:** [1] §V-D(Methodology、Results,TABLE XI)。

### 2.4 憑證遷移仍為未竟階段,且需持續維護加密靈活性

本次 PoC 僅處理金鑰交換層;數位憑證認證在此階段維持不變,仍使用 RSA 或
ECDSA 簽章。遷移至 ML-DSA 憑證被論文明確列為後續必要階段,且須等待
IETF LAMPS composite certificate 標準穩定、PKI 支援 PQC 簽章後才能進行,
目前尚無定案時程。此外,論文將其五階段生命週期(Discover→Assess→Prioritize
→Migrate→Verify)設計為持續迴圈而非一次性專案,意味著隨未來密碼學進展
(演算法汰換、標準更新),同一維運負擔會反覆出現。
**出處:** [1] §V-E(d)(Certificate migration remains an open phase)、
§V-F(Discussion)、§III-D。

### 2.5 資料集代表性與單一機構部署的可推廣性限制(論文自陳限制)

大規模量測語料(8,443 份 Nginx 組態)取自公開 GitHub 儲存庫,可能過度代表
開發/範本用途的組態 —— 42.6% 的 TLS-enabled 情境使用非正式環境主機名稱,
正式金融服務組態並未公開可得。另一方面,OCBC 案例代表單一機構的部署,
論文明確聲明其可否推廣至其他機構、架構或高流量環境「應透過額外部署驗證」。
**出處:** [1] §IV-D(a)(Dataset representativeness)、§IV-D(d)
(Single institution deployment)。

## 3. 結論

依附件文獻([1]),TLS 終止層 PQC 遷移的既有做法可歸納為三類:(1)配置解析→
正規化→策略比對,盤點異質終止點加密現況並排序遷移優先級;(2)於 web server /
API gateway 等終止點就地啟用 hybrid 金鑰交換(如 X25519-ML-KEM-768、
ML-KEM-512),零應用層改動;(3)大規模組態量測,量化量子脆弱性暴露面作為
基準線。已知風險:配置能見度落差(允許但未協商)、異質元件管理複雜度、約 23%
連線建立效能開銷、憑證遷移與加密靈活性維護等未竟成本。本整理僅基於
Balaji et al.(2026,arXiv:2605.17955v1)一篇文獻。

## 4. 限制與後續

- 本整理僅基於單一來源,完整的文獻整理需要外部檢索能力,目前未具備
  (本次作業環境亦未授予網路存取權限,無法自行檢索補充文獻)。
- **附件截斷:無。** 本次已完整讀取附件 PDF 全部 16 頁(含摘要、正文
  §I–§VI、全部圖表、致謝與參考文獻清單),亦交叉核對 `.pdf.txt` 解析文字檔,
  未發現任何章節被截斷或缺漏。`.pdf.txt` 在論文末頁(參考文獻 [17] 與
  ACKNOWLEDGMENT 標題附近)因雙欄版面被解析工具交錯合併,造成局部文字順序
  錯置的抽取瑕疵,但經比對原始 PDF 影像確認內容完整,不影響本整理所引用
  之任何發現。
- **出處識別碼更正:** SPEC.md 標註本文獻為 `arXiv:2505.17955v1, 2025`,但
  逐字元核對附件 PDF 得出的實際識別碼為 `arXiv:2605.17955v1`,發表日期為
  2026 年 5 月 18 日。本文件與 `REFERENCES.md` 已依附件原文更正並記錄此差異,
  尚待人類確認 SPEC.md 中的原始標註是否為誤植。
- 本整理的範圍限制:非系統性回顧(未定義檢索式、未記錄檢索過程)、
  非定量統合分析(未計算 effect size、未做 meta-analysis),且僅涵蓋單一
  金融機構之單一 PoC 部署,論文本身亦聲明其向其他機構/架構的可推廣性
  尚待額外部署驗證(見 §2.5)。
- 建議後續可補充的方向:(a)待具備外部檢索能力後,擴充至 2024 年後其他
  PQC-in-TLS 遷移文獻,以脫離單一來源限制;(b)追蹤憑證層(ML-DSA)遷移
  的後續研究,待 IETF LAMPS composite certificate 標準穩定後補充;
  (c)擴充涵蓋 HAProxy、Envoy、雲端託管 TLS 服務等本文獻未涵蓋之終止元件類型。
