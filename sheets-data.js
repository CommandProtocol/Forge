/**
 * sheets-data.js
 * Fetch & parse 3 sheet tabs từ Google Sheets published URL
 *
 * ── CẤU HÌNH ───────────────────────────────────────────────────────────────
 *  Điền đúng gid cho từng tab (xem URL khi click tab trong Google Sheets)
 *  Ví dụ: https://docs.google.com/spreadsheets/d/...#gid=123456789
 * ──────────────────────────────────────────────────────────────────────────
 */

const SHEET_BASE =
  "https://docs.google.com/spreadsheets/d/e/" +
  "2PACX-1vTxEFCO9o2340JFLjeSEC5p-o8MS32ziCC-qQbh2OAKXbNlihfPJX1sn_xjarXVRBPiUNlarUvaf4X-" +
  "/pub?single=true&output=tsv";

// ⬇ Thay đúng gid của từng tab tại đây
export const GID = {
  xuong:             0,         // tab "Xưởng"
  item:              785672322, // tab "Item"
  nguyenLieuMacDinh: 191328776, // tab "Nguyên liệu mặc định"
};

// ──────────────────────────────────────────────────────────────────────────
// Nội bộ: fetch + parse TSV
// ──────────────────────────────────────────────────────────────────────────

function sheetUrl(gid) {
  return `${SHEET_BASE}&gid=${gid}`;
}

async function fetchTSV(gid) {
  const res = await fetch(sheetUrl(gid));
  if (!res.ok) throw new Error(`Fetch gid=${gid} thất bại: HTTP ${res.status}`);
  return res.text();
}

/**
 * Parse TSV text → { headers: string[], rows: Record<string,string>[] }
 * Hàng đầu tiên luôn là title (header).
 */
function parseTSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split("\t").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.split("\t").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

function toNum(str) {
  if (str === undefined || str === null || str === "") return 0;
  return parseFloat(String(str).replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

/**
 * fetchWorkshops()
 * @returns {Promise<Array<{ name:string, costPerHour:number, pointsPerHour:number }>>}
 *
 * Sheet "Xưởng":
 *   Cột A = Xưởng | Cột B = Chi phí/giờ | Cột C = Điểm/giờ
 */
export async function fetchWorkshops() {
  const tsv = await fetchTSV(GID.xuong);
  const { rows } = parseTSV(tsv);
  return rows
    .filter(r => r["Xưởng"])
    .map(r => ({
      name:          r["Xưởng"],
      costPerHour:   toNum(r["Chi phí/giờ"]),
      pointsPerHour: toNum(r["Điểm/giờ"]),
    }));
}

/**
 * fetchItems()
 * @returns {Promise<Array<{ name:string, materials:string, pointsNeeded:number, note:string }>>}
 *
 * Sheet "Item":
 *   Cột A = Item | Cột B = Nguyên liệu | Cột C = Điểm cần | Cột D = Note
 */
export async function fetchItems() {
  const tsv = await fetchTSV(GID.item);
  const { rows } = parseTSV(tsv);
  return rows
    .filter(r => r["Item"])
    .map(r => ({
      name:         r["Item"],
      materials:    r["Nguyên liệu"] || "",
      pointsNeeded: toNum(r["Điểm cần"]),
      note:         r["Note"] || "",
    }));
}

/**
 * fetchDefaultMaterials()
 * @returns {Promise<Array<{ rarity:string, points:number }>>}
 *
 * Sheet "Nguyên liệu mặc định":
 *   Cột A = Common(10) | B = Uncommon(20) | C = Rare(40) | D = Very Rare(60) | E = Legendary(100)
 *   Hàng 1 = tên độ hiếm (title), Hàng 2 = điểm tương ứng
 */
export async function fetchDefaultMaterials() {
  const tsv = await fetchTSV(GID.nguyenLieuMacDinh);
  const { headers, rows } = parseTSV(tsv);
  // headers = ["Common","Uncommon","Rare","Very Rare","Legendary"]
  // rows[0]  = { Common: "10", Uncommon: "20", ... }
  if (!rows.length) return [];
  const valRow = rows[0];
  return headers.map(h => ({
    rarity: h,
    points: toNum(valRow[h]),
  }));
}

/**
 * fetchAll() – tải cả 3 sheet song song
 * @returns {Promise<{ workshops, items, defaultMaterials }>}
 */
export async function fetchAll() {
  const [workshops, items, defaultMaterials] = await Promise.all([
    fetchWorkshops(),
    fetchItems(),
    fetchDefaultMaterials(),
  ]);
  return { workshops, items, defaultMaterials };
}