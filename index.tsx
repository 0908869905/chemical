import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// ----------------------
// 1. 定義資料結構
// ----------------------

interface ExperimentRecord {
  id: string; // 用於程式內部識別的唯一 ID
  timestamp: string; // 紀錄建立/修改的時間戳記
  experimentId: string; // 使用者輸入的實驗編號
  date: string; // 實驗日期時間
  mode: "CV" | "CC";
  voltage: string;
  current: string;
  electrolyte: string;
  anodeInitial: string;
  anodeFinal: string;
  cathodeInitial: string;
  cathodeFinal: string;
  notes: string;
}

// ----------------------
// 2. 主應用程式元件
// ----------------------

const App = () => {
  // --- State 管理 ---
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 表單初始狀態
  const initialFormState = {
    experimentId: "",
    date: new Date().toISOString().slice(0, 16), // 預設為現在時間 YYYY-MM-DDTHH:mm
    mode: "CV" as "CV" | "CC",
    voltage: "",
    current: "",
    electrolyte: "",
    anodeInitial: "",
    anodeFinal: "",
    cathodeInitial: "",
    cathodeFinal: "",
    notes: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- useEffect: 載入與儲存 ---

  // 1. 初始化時從 localStorage 讀取
  useEffect(() => {
    const savedData = localStorage.getItem("carbon_experiment_data");
    if (savedData) {
      try {
        setRecords(JSON.parse(savedData));
      } catch (e) {
        console.error("無法解析儲存的資料", e);
      }
    }
  }, []);

  // 2. 當 records 變動時，寫入 localStorage
  useEffect(() => {
    localStorage.setItem("carbon_experiment_data", JSON.stringify(records));
  }, [records]);

  // --- 輔助函式 ---

  // 計算質量變化 (結束 - 初始)
  const calculateDelta = (initial: string, final: string) => {
    const i = parseFloat(initial);
    const f = parseFloat(final);
    if (isNaN(i) || isNaN(f)) return "-";
    const delta = f - i;
    // 顯示正號
    return (delta > 0 ? "+" : "") + delta.toFixed(2);
  };

  // 處理表單輸入
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- 功能實作 ---

  // 新增或更新紀錄
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 簡單驗證必填
    if (!formData.experimentId || !formData.date) {
      alert("請填寫實驗編號與日期");
      return;
    }

    if (editingId) {
      // 更新現有紀錄
      setRecords((prev) =>
        prev.map((rec) =>
          rec.id === editingId
            ? { ...rec, ...formData, timestamp: new Date().toISOString() }
            : rec
        )
      );
      setEditingId(null);
      alert("紀錄已更新");
    } else {
      // 新增紀錄
      const newRecord: ExperimentRecord = {
        id: crypto.randomUUID(), // 生成唯一 ID
        timestamp: new Date().toISOString(),
        ...formData,
      };
      setRecords((prev) => [newRecord, ...prev]); // 新的在最上面
    }

    // 重置表單，保留日期為當下
    setFormData({
      ...initialFormState,
      date: new Date().toISOString().slice(0, 16),
    });
  };

  // 編輯模式
  const handleEdit = (record: ExperimentRecord) => {
    setFormData({
      experimentId: record.experimentId,
      date: record.date,
      mode: record.mode,
      voltage: record.voltage,
      current: record.current,
      electrolyte: record.electrolyte,
      anodeInitial: record.anodeInitial,
      anodeFinal: record.anodeFinal,
      cathodeInitial: record.cathodeInitial,
      cathodeFinal: record.cathodeFinal,
      notes: record.notes,
    });
    setEditingId(record.id);
    // 捲動到上方
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 刪除單筆
  const handleDelete = (id: string) => {
    if (confirm("確定要刪除這筆紀錄嗎？")) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // 清除全部
  const handleClearAll = () => {
    if (confirm("警告：這將刪除所有實驗數據且無法復原！確定要繼續嗎？")) {
      setRecords([]);
      localStorage.removeItem("carbon_experiment_data");
    }
  };

  // 匯出 CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      alert("目前沒有資料可匯出");
      return;
    }

    // 定義 CSV 標頭
    const headers = [
      "日期時間",
      "實驗編號",
      "模式",
      "設定電壓(V)",
      "設定電流(A)",
      "電解液",
      "陽極初始(g)",
      "陽極結束(g)",
      "陽極變化(g)",
      "陰極初始(g)",
      "陰極結束(g)",
      "陰極變化(g)",
      "備註",
    ];

    // 轉換資料為 CSV 格式的字串陣列
    const csvContent = records.map((r) => {
      const anodeDelta = calculateDelta(r.anodeInitial, r.anodeFinal);
      const cathodeDelta = calculateDelta(r.cathodeInitial, r.cathodeFinal);

      return [
        r.date,
        `"${r.experimentId}"`, // 防止編號中有逗號
        r.mode,
        r.voltage,
        r.current,
        `"${r.electrolyte}"`,
        r.anodeInitial,
        r.anodeFinal,
        anodeDelta,
        r.cathodeInitial,
        r.cathodeFinal,
        cathodeDelta,
        `"${r.notes.replace(/"/g, '""')}"`, // 處理備註中的引號
      ].join(",");
    });

    // 組合 BOM (讓 Excel 正確讀取 UTF-8) + 標頭 + 內容
    const csvString = "\ufeff" + [headers.join(","), ...csvContent].join("\n");

    // 建立下載連結
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `碳棒實驗紀錄_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      ...initialFormState,
      date: new Date().toISOString().slice(0, 16),
    });
  };

  return (
    <div>
      <div className="header-actions">
        <h1>碳棒剝落實驗紀錄系統</h1>
        <div>
          <button className="btn-success" onClick={handleExportCSV} style={{marginRight: '10px'}}>
            匯出 CSV
          </button>
          <button className="btn-danger" onClick={handleClearAll}>
            清除全部
          </button>
        </div>
      </div>

      {/* --- 輸入表單區 --- */}
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>日期時間</label>
              <input
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>實驗編號</label>
              <input
                type="text"
                name="experimentId"
                placeholder="例如: E001"
                value={formData.experimentId}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>模式</label>
              <select
                name="mode"
                value={formData.mode}
                onChange={handleInputChange}
              >
                <option value="CV">C.V. 恆電壓</option>
                <option value="CC">C.C. 恆電流</option>
              </select>
            </div>
            <div className="form-group">
              <label>設定電壓 (V)</label>
              <input
                type="number"
                step="0.01"
                name="voltage"
                placeholder="僅 C.V."
                value={formData.voltage}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>設定電流 (A)</label>
              <input
                type="number"
                step="0.01"
                name="current"
                placeholder="僅 C.C."
                value={formData.current}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>電解液</label>
              <input
                type="text"
                name="electrolyte"
                placeholder="例如: 0.1M K2CO3"
                value={formData.electrolyte}
                onChange={handleInputChange}
              />
            </div>

            {/* 質量輸入區 */}
            <div className="form-group">
              <label>陽極初始質量 (g)</label>
              <input
                type="number"
                step="0.0001"
                name="anodeInitial"
                value={formData.anodeInitial}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>陽極結束質量 (g)</label>
              <input
                type="number"
                step="0.0001"
                name="anodeFinal"
                value={formData.anodeFinal}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>陰極初始質量 (g)</label>
              <input
                type="number"
                step="0.0001"
                name="cathodeInitial"
                value={formData.cathodeInitial}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>陰極結束質量 (g)</label>
              <input
                type="number"
                step="0.0001"
                name="cathodeFinal"
                value={formData.cathodeFinal}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group full-width">
              <label>備註</label>
              <textarea
                name="notes"
                rows={2}
                placeholder="觀察現象、顏色變化、剝落情況..."
                value={formData.notes}
                onChange={handleInputChange}
              ></textarea>
            </div>
          </div>

          <div className="btn-group">
            {editingId && (
              <button
                type="button"
                className="btn-outline"
                onClick={handleCancelEdit}
              >
                取消編輯
              </button>
            )}
            <button type="submit" className="btn-primary">
              {editingId ? "儲存更新" : "新增紀錄"}
            </button>
          </div>
        </form>
      </div>

      {/* --- 資料列表區 --- */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>日期時間</th>
              <th>編號</th>
              <th>模式</th>
              <th>電壓 V</th>
              <th>電流 A</th>
              <th>電解液</th>
              <th>陽極 Δm⁺</th>
              <th>陰極 Δm⁻</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center">
                  目前沒有資料，請由上方新增。
                </td>
              </tr>
            ) : (
              records.map((rec) => {
                const anodeDelta = calculateDelta(
                  rec.anodeInitial,
                  rec.anodeFinal
                );
                const cathodeDelta = calculateDelta(
                  rec.cathodeInitial,
                  rec.cathodeFinal
                );

                return (
                  <tr key={rec.id}>
                    <td>{rec.date.replace("T", " ")}</td>
                    <td>{rec.experimentId}</td>
                    <td>{rec.mode}</td>
                    <td>{rec.voltage}</td>
                    <td>{rec.current}</td>
                    <td>{rec.electrolyte}</td>
                    <td
                      className={
                        parseFloat(anodeDelta) < 0
                          ? "delta-negative"
                          : "delta-positive"
                      }
                    >
                      {anodeDelta}
                      <div style={{ fontSize: "0.8em", color: "#666", fontWeight: "normal" }}>
                        ({rec.anodeInitial} → {rec.anodeFinal})
                      </div>
                    </td>
                    <td
                      className={
                        parseFloat(cathodeDelta) < 0
                          ? "delta-negative"
                          : "delta-positive"
                      }
                    >
                      {cathodeDelta}
                       <div style={{ fontSize: "0.8em", color: "#666", fontWeight: "normal" }}>
                        ({rec.cathodeInitial} → {rec.cathodeFinal})
                      </div>
                    </td>
                    <td style={{ maxWidth: "200px", whiteSpace: "normal" }}>
                      {rec.notes}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleEdit(rec)}
                        >
                          編輯
                        </button>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => handleDelete(rec.id)}
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
