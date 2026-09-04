# Kiểm lại D1 rows read sau db/027 — bản giao việc

Mở file này trong một phiên bất kỳ. Nó tự chứa: vì sao phải đo, số liệu gốc,
lệnh đo, và cách đọc kết quả. Không cần bối cảnh của phiên đã làm.

**Đo sớm nhất: sáng 2026-09-06 (giờ GMT+7).** Lý do ở mục "Vì sao phải đợi".

---

## Chuyện gì đã xảy ra

`reapStale()` trong `functions/api/_battle.js` là đồng hồ duy nhất của Đấu
trường — dự án này không có cron. Nó hết hạn lời mời không ai trả lời và kết
thúc trận mà đối thủ bỏ đi, và nó chạy ở đầu **mọi** endpoint battle
(`index`, `state`, `challenge`, `turn`, `respond`).

Hai câu lệnh của nó lọc trên `expires_at` và `turn_started_at`. `db/002` chỉ
đánh chỉ mục `(challenger_id, status)` và `(opponent_id, status)`, còn trận đã
xong thì không bao giờ bị dọn — nên cả hai câu là **quét toàn bảng**, chạy trên
mọi request, trên một bảng chỉ có lớn thêm.

`db/027-battle-reaper-index.sql` thêm hai partial index, đúng như `db/026` đã
làm cho Đấu Toán. **Đã áp dụng lên D1 production lúc 2026-09-04 17:40 UTC**
(2026-09-05 00:41 GMT+7). Không có deploy nào đi kèm: không đổi một dòng mã
nào, chỉ đổi giá.

Xác nhận index đang sống (đã chạy, đã xanh):

```
expire : SEARCH battles USING INDEX idx_battles_invited_expires
settle : SEARCH battles USING INDEX idx_battles_active_turn
```

---

## Vì sao việc này quan trọng

Từ **2026-09-01**, Cloudflare **BẮT BUỘC** hạn mức free tier của D1: quá
5.000.000 rows read/ngày thì truy vấn **lỗi thật**, trả về error tới nửa đêm
UTC. Trước đó chỉ là con số trong tài liệu.

Ngày cao nhất trước khi sửa là **2.567.257 rows = 51% hạn mức**, với 13 tài
khoản mà mỗi ngày chỉ 3–5 bé thật sự học. Nghĩa là app đang đi trên đường mà
một ngày đông bé là Đấu trường bắt đầu lỗi.

---

## Số liệu gốc (7 ngày tính đến 2026-09-04, đo trước khi sửa)

Rows read mỗi ngày:

| ngày (UTC) | rows read | % của hạn mức 5M |
|---|---|---|
| 2026-08-28 | 2.045.595 | 40,9% |
| 2026-08-29 | **2.567.257** | **51,3%** ← đỉnh |
| 2026-08-31 | 20.104 | 0,4% |
| 2026-09-01 | 344.603 | 6,9% |
| 2026-09-02 | 1.676.404 | 33,5% |
| 2026-09-03 | 987.316 | 19,7% |
| 2026-09-04 | 1.701.103 | 34,0% | ← ngày lẫn: hầu hết trước khi sửa |

Lưu ý: con số của ngày **hôm nay** còn lớn thêm khi ngày chưa hết (2026-09-04
đọc lúc 17:30 UTC là 1.549.890, đọc lại lúc 18:00 UTC đã là 1.701.103). Chỉ so
sánh những ngày đã trọn vẹn.

Chia theo tính năng (tổng top-20: 8.485.429 rows):

| tính năng | rows read | tỉ lệ | số lần gọi |
|---|---|---|---|
| **Pet Battle (`battles`)** | 5.119.240 | **60,3%** | 181.517 |
| activities / exam stats | 2.592.965 | 30,6% | 94.903 |
| admin skill dashboard | 658.394 | 7,8% | 4.634 |
| còn lại | 110.804 | 1,3% | 98.127 |
| Night Raid | 2.052 | 0,0% | 471 |
| Math Fight (`math_fights`) | 1.974 | 0,0% | 1.185 |

**Hai câu lệnh bị sửa** — đây là thứ phải nhìn sau khi đo:

| câu lệnh | rows read | số lần gọi | rows/lần |
|---|---|---|---|
| `UPDATE battles … status='expired' … expires_at < ?` | 2.237.132 | 45.322 | **49** |
| `UPDATE battles … status='done' … turn_started_at < ?` | 2.159.863 | 43.547 | **50** |

Lúc đo, bảng `battles` có **60 dòng, 0 invited, 0 active**, và **0 trận được
tạo trong 7 ngày**. Tức là 4,4 triệu rows đọc để quét một bảng 60 dòng và
không tìm thấy gì.

---

## Tín hiệu sớm — đã đo, đã tốt

Khoảng một giờ sau khi áp dụng (17:45–24:00 UTC ngày 2026-09-04), trên lưu
lượng thật:

| câu lệnh | trước | sau | số lần gọi (1 giờ) |
|---|---|---|---|
| `UPDATE battles … status='expired'` | 51,9 rows/lần | **2,0** | 627 |
| `UPDATE battles … status='done'` | 52,0 rows/lần | **2,0** | 667 |

Giảm **~26 lần**, đúng như dự đoán. 2,0 là sàn: index tìm đúng chỗ rồi dừng.

Và như đã đoán, `ammoStatsFor` giờ leo lên đầu bảng: 9.312 rows / 776 lần gọi
= 12,0 rows/lần. Nó là việc tiếp theo (xem cuối file).

Vậy tại sao vẫn phải đo lại ngày 2026-09-06? Vì con số trên là một giờ buổi
tối, không phải một ngày học đầy đủ. Nó chứng minh index **đang chạy**; nó
chưa chứng minh **tổng ngày** giảm còn bao nhiêu phần trăm hạn mức.

---

## Vì sao phải đợi tới 2026-09-06

D1 gom số liệu theo **ngày UTC**, reset lúc nửa đêm UTC.

- `2026-09-04` UTC là ngày **lẫn lộn**: gần hết ngày chạy mã cũ, chỉ ~6 giờ
  cuối là có index. Đừng dùng ngày này để kết luận.
- **`2026-09-05` UTC là ngày sạch đầu tiên.** Nó kết thúc lúc **07:00 sáng
  2026-09-06 giờ GMT+7**.

Nên: đo từ sáng 2026-09-06 trở đi, và **đọc dòng `2026-09-05`**.

---

## Cách đo

Token nằm ở `~/.config/eng-pwa/cloudflare.env` (đã gitignore — đừng in ra,
đừng commit). Account id đã có sẵn trong `scripts/deploy.sh`.

### 1. Hai câu lệnh đó giờ đọc bao nhiêu dòng?

Đây là phép đo quan trọng nhất. `rows/lần` phải rơi từ ~49–50 xuống **gần 0**.

```bash
cd /Users/chuzon/go/src/learn-eng-pwa
set -a; . ~/.config/eng-pwa/cloudflare.env; set +a
ACC=f8b5c3e4cb22d163733b7ce29ecab97c
FROM=$(date -u -v-2d +%Y-%m-%dT00:00:00Z); TO=$(date -u +%Y-%m-%dT23:59:59Z)
curl -s -X POST https://api.cloudflare.com/client/v4/graphql \
 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
 -d "{\"query\":\"query{viewer{accounts(filter:{accountTag:\\\"$ACC\\\"}){d1QueriesAdaptiveGroups(limit:20,filter:{datetime_geq:\\\"$FROM\\\",datetime_leq:\\\"$TO\\\"},orderBy:[sum_rowsRead_DESC]){count dimensions{query} sum{rowsRead}}}}}\"}" \
 | python3 -c "
import sys,json
g=json.load(sys.stdin)['data']['viewer']['accounts'][0]['d1QueriesAdaptiveGroups']
for x in g[:8]:
    q=' '.join(x['dimensions']['query'].split()); s=x['sum']['rowsRead']; c=x['count']
    print(f'{s:>10,} rows | {c:>6,} calls | {s/max(1,c):>5.1f} rows/call')
    print('   ', q[:120])
"
```

### 2. Tổng rows read mỗi ngày

Dòng cần đọc là **`2026-09-05`**.

```bash
cd /Users/chuzon/go/src/learn-eng-pwa
set -a; . ~/.config/eng-pwa/cloudflare.env; set +a
ACC=f8b5c3e4cb22d163733b7ce29ecab97c
FROM=$(date -u -v-7d +%Y-%m-%d); TO=$(date -u +%Y-%m-%d)
curl -s -X POST https://api.cloudflare.com/client/v4/graphql \
 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
 -d "{\"query\":\"query{viewer{accounts(filter:{accountTag:\\\"$ACC\\\"}){d1AnalyticsAdaptiveGroups(limit:100,filter:{date_geq:\\\"$FROM\\\",date_leq:\\\"$TO\\\"},orderBy:[date_ASC]){dimensions{date} sum{rowsRead rowsWritten}}}}}\"}" \
 | python3 -c "
import sys,json
g=json.load(sys.stdin)['data']['viewer']['accounts'][0]['d1AnalyticsAdaptiveGroups']
for r in g:
    s=r['sum']
    print(f\"{r['dimensions']['date']}  read {s['rowsRead']:>10,} ({s['rowsRead']/5_000_000*100:5.2f}% cap)  write {s['rowsWritten']:>7,}\")
"
```

### 3. Số bé thật sự học ngày hôm đó

Rows read chỉ có nghĩa khi so với số bé đang dùng. Một ngày 300k rows mà chỉ
1 bé học thì **không** phải là thắng lợi.

```bash
cd /Users/chuzon/go/src/learn-eng-pwa
set -a; . ~/.config/eng-pwa/cloudflare.env; set +a
export CLOUDFLARE_ACCOUNT_ID=f8b5c3e4cb22d163733b7ce29ecab97c
npx wrangler@3 d1 execute eng_pwa_db --remote --json --command \
"SELECT substr(created_at,1,10) AS day, COUNT(DISTINCT user_id) AS be_hoc, COUNT(*) AS hoat_dong
 FROM activities WHERE created_at >= datetime('now','-8 days') GROUP BY day ORDER BY day" 2>/dev/null \
 | python3 -c "
import sys,re,json
t=sys.stdin.read(); m=re.search(r'\[\s*\{.*\}\s*\]',t,re.S)
for r in json.loads(m.group(0))[0]['results']:
    print(f\"  {r['day']}  {r['be_hoc']} bé học, {r['hoat_dong']} hoạt động\")"
```

Nền cũ (chính là 3–5 bé/ngày nói ở trên):

```
  2026-08-28  3 bé học, 29 hoạt động     2026-09-01  4 bé học, 38 hoạt động
  2026-08-29  4 bé học, 29 hoạt động     2026-09-02  4 bé học, 42 hoạt động
  2026-08-30  1 bé học,  1 hoạt động     2026-09-03  4 bé học, 31 hoạt động
  2026-08-31  4 bé học, 11 hoạt động     2026-09-04  5 bé học, 56 hoạt động
```

---

## Đọc kết quả thế nào

**Thành công** trông như thế này:

- hai câu `UPDATE battles …` rơi từ ~52 rows/lần xuống **~2 rows/lần**
  (đã xác nhận trong giờ đầu — xem "Tín hiệu sớm"; lần đo này chỉ cần thấy nó
  giữ nguyên qua trọn một ngày);
- tổng rows read ngày `2026-09-05` khoảng **1,2 triệu** thay vì 2,5 triệu,
  tức **~24% hạn mức** thay vì 51% — **với điều kiện** số bé học ngày đó
  tương đương (3–5 bé). Xem mục 3.
- `rowsWritten` **không** tăng đáng kể. Thêm index thì mỗi lần ghi phải cập
  nhật thêm chỉ mục, nhưng đây là *partial* index chỉ phủ các dòng
  invited/active (rất ít, sống rất ngắn), nên phải gần như không đổi. Nền cũ:
  đỉnh 8.920/ngày trên hạn mức 100.000 (9%).

**Nếu KHÔNG giảm**, kiểm theo thứ tự:

1. Index còn đó không?
   ```bash
   npx wrangler@3 d1 execute eng_pwa_db --remote --command \
     "SELECT name, partial FROM pragma_index_list('battles')"
   ```
   Phải thấy `idx_battles_invited_expires` và `idx_battles_active_turn`, cột
   `partial` = 1. Nếu mất, chạy lại:
   ```bash
   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/027-battle-reaper-index.sql
   ```
2. Query planner có dùng không?
   ```bash
   npx wrangler@3 d1 execute eng_pwa_db --remote --command \
     "EXPLAIN QUERY PLAN UPDATE battles SET status='expired' WHERE status='invited' AND expires_at IS NOT NULL AND expires_at < 1"
   ```
   Phải ra `SEARCH … USING INDEX …`, không được là `SCAN battles`.
3. `npm test` — `tests/battle-reaper.test.js` có 3 test ghim đúng việc này và
   sẽ đỏ nếu index biến mất.

---

## Việc tiếp theo, nếu lần đo này đúng như dự đoán

Mục lớn kế tiếp là **`ammoStatsFor`** ở `functions/api/_battle.js:171` —
**1.917.946 rows, 23%, 46.152 lần gọi** trong 7 ngày. Nó tính tổng học tập 3
ngày gần nhất của chính đứa bé đó, và tính lại từ đầu mỗi lần Đấu trường hỏi
trạng thái.

Đây là chỗ ý tưởng "đọc trên máy bé" của chủ dự án thật sự áp dụng được: dữ
liệu là của chính bé đó, máy đã có sẵn trong `appState`. Ba hướng, rẻ dần:

1. cache theo ngày ở server (một dòng trong `user_coin_snapshots` hoặc bảng
   tương tự) — chính xác tuyệt đối, không đổi giao diện;
2. để client gửi kèm và server chỉ kiểm lại khi tính tiền — **cẩn thận**: đây
   là đường tiền, và luật của dự án là server không bao giờ tin client về tiền;
3. giảm tần suất Đấu trường hỏi trạng thái.

Hướng 1 an toàn nhất. Đừng làm hướng 2 nếu chưa đọc `tests/money-*.test.js`.

**Đã cân nhắc và BỎ:** chặn bớt số lần gọi `reapStale()` (gate 30s/isolate).
`functions/api/battle/turn.js:35` gọi `reapStale()` **trước khi** kiểm tra một
lượt đánh; bỏ qua một lần quét có thể cho bé đánh tiếp trong trận lẽ ra đã
kết thúc. Đó là đổi hành vi trong mã có dính tiền, để tiết kiệm những truy vấn
mà index đã làm gần như miễn phí rồi. Không đáng.

---

## Những điều không được làm

- Không in, không commit `CLOUDFLARE_API_TOKEN`.
- Không kết luận từ ngày `2026-09-04` — ngày đó lẫn cũ và mới.
- Không kết luận từ rows read mà không xem số bé học ngày đó (mục 3).
- Không `git add -A`: nhiều phiên dùng chung repo này.
- Không cần deploy để đo, và `db/027` cũng đã không cần deploy — nó chỉ là
  index trên D1, không có mã nào đổi.
