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
  // Bản chuẩn Google Sheets ID gốc của ông
  const SHEET_ID = '1tm2Z6Tc7gsPEq99kn4TeEe-KNfWhnBW6eL6MfBlCNOI'; 
  
  const base = 'https://docs.google.com/spreadsheets/d/';
  const urlWorkshops = `${base}${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Xưởng`;
  const urlItems     = `${base}${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Item`;
  const urlMaterials = `${base}${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Nguyên liệu mặc định`;
  const urlNotes     = `${base}${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Note`;

  try {
    const [resWs, resIt, resMat, resNote] = await Promise.all([
      fetch(urlWorkshops).then(r => r.text()),
      fetch(urlItems).then(r => r.text()),
      fetch(urlMaterials).then(r => r.text()),
      fetch(urlNotes).then(r => r.text())
    ]);

    // Hàm parse dữ liệu thô từ Google Visualization API sang mảng hàng (rows)
    const parseGviz = (text) => {
      const data = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
      return data.table.rows;
    };

    const rowsWs   = parseGviz(resWs);
    const rowsIt   = parseGviz(resIt);
    const rowsMat  = parseGviz(resMat);
    const rowsNote = parseGviz(resNote);

    // 1. Parse Tab Xưởng (Dữ liệu dạng hàng dọc thông thường)
    const workshops = rowsWs.map(r => ({
      name: r.c[0]?.v || '',
      costPerHour: parseFloat(r.c[1]?.v) || 0,
      pointsPerHour: parseFloat(r.c[2]?.v) || 0
    })).filter(w => w.name);

    // 2. Parse Tab Item
    const items = rowsIt.map(r => ({
      name: r.c[0]?.v || '',
      materials: r.c[1] ? String(r.c[1].v) : '',
      pointsNeeded: parseFloat(r.c[2]?.v) || 0,
      note: r.c[3]?.v || '',
      isCustom: false
    })).filter(it => it.name);

    // 3. Parse Tab Nguyên liệu mặc định (Flexible Ma Trận Ngang)
    const defaultMaterials = [];
    if (rowsMat && rowsMat.length > 0) {
      // Đọc label từ cấu trúc cột của Google để lấy: Common, Uncommon, Rare...
      const columnsMeta = JSON.parse(resMat.substring(resMat.indexOf("{"), resMat.lastIndexOf("}") + 1)).table.cols;
      
      // Xác định hàng chứa số điểm (Nếu Google thu gọn còn 1 hàng thì lấy rowsMat[0], ngược lại lấy rowsMat[1])
      const valuesRow = rowsMat.length === 1 ? rowsMat[0].c : rowsMat[1]?.c;

      if (valuesRow) {
        for (let colIdx = 0; colIdx < valuesRow.length; colIdx++) {
          let rName = columnsMeta[colIdx]?.label || '';
          
          // Dự phòng nếu Google không tự biến dòng 1 thành meta label cột
          if (!rName && rowsMat.length > 1) {
            rName = rowsMat[0].c[colIdx]?.v || '';
          }

          const rPts = valuesRow[colIdx] ? parseFloat(valuesRow[colIdx].v) : 0;

          if (rName && String(rName).trim() !== "") {
            defaultMaterials.push({
              rarity: String(rName).trim(),
              points: rPts || 0
            });
          }
        }
      }
    }

    // 4. Parse Tab Note (Flexible Tiêu đề Động từ ô A1)
    let noteTitle = "SYSTEM LOGS"; // Giá trị mặc định nếu trống rỗng
    const noteLogs = [];

    if (rowsNote && rowsNote.length > 0) {
      const noteColumnsMeta = JSON.parse(resNote.substring(resNote.indexOf("{"), resNote.lastIndexOf("}") + 1)).table.cols;
      
      if (noteColumnsMeta && noteColumnsMeta[0] && noteColumnsMeta[0].label) {
        // Trường hợp Google nuốt ô A1 làm Label tiêu đề
        noteTitle = noteColumnsMeta[0].label.trim();
        rowsNote.forEach(r => {
          if (r.c && r.c[0] && r.c[0].v !== null) noteLogs.push(String(r.c[0].v).trim());
        });
      } else {
        // Trường hợp Google giữ ô A1 ở phần tử mảng đầu tiên
        if (rowsNote[0]?.c?.[0]?.v !== null) {
          noteTitle = String(rowsNote[0].c[0].v).trim();
        }
        for (let i = 1; i < rowsNote.length; i++) {
          if (rowsNote[i]?.c?.[0]?.v !== null) {
            noteLogs.push(String(rowsNote[i].c[0].v).trim());
          }
        }
      }
    }

    // Trả về gói dữ liệu hoàn chỉnh sạch sẽ
    return {
      workshops,
      items,
      defaultMaterials,
      systemNotes: {
        title: noteTitle,
        logs: noteLogs
      }
    };

  } catch (error) {
    console.error("Lỗi đồng bộ dữ liệu Google Sheets:", error);
    throw error;
  }
}