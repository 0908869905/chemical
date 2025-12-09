import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

type SortKey = keyof ExperimentRecord | "anodeDelta" | "cathodeDelta";
type SortDirection = "asc" | "desc";

// ----------------------
// 2. 試藥計算器相關資料與元件
// ----------------------

interface Chemical {
  name: string;
  formula: string;
  mw: number;
  type: 'solid' | 'liquid';
  density?: number; // g/mL, for liquid
  purity?: number;  // 0-1, for liquid
}

const CHEMICALS: Chemical[] = [
  { name: "K₂CO₃ (碳酸鉀)", formula: "K₂CO₃", mw: 138.21, type: "solid" },
  { name: "Na₂CO₃ (碳酸鈉)", formula: "Na₂CO₃", mw: 105.99, type: "solid" },
  { name: "Na₂CO₃·10H₂O (碳酸鈉十水合物)", formula: "Na₂CO₃·10H₂O", mw: 286.14, type: "solid" },
  { name: "KNO₃ (硝酸鉀)", formula: "KNO₃", mw: 101.10, type: "solid" },
  { name: "Sr(NO₃)₂ (硝酸鍶)", formula: "Sr(NO₃)₂", mw: 211.63, type: "solid" },
  { name: "Mg(NO₃)₂ (硝酸鎂)", formula: "Mg(NO₃)₂", mw: 148.31, type: "solid" },
  { name: "Mg(NO₃)₂·6H₂O (硝酸鎂六水合物)", formula: "Mg(NO₃)₂·6H₂O", mw: 256.41, type: "solid" },
  { name: "Na₂SO₄ (硫酸鈉)", formula: "Na₂SO₄", mw: 142.04, type: "solid" },
  { name: "Na₂SO₄·10H₂O (硫酸鈉十水合物)", formula: "Na₂SO₄·10H₂O", mw: 322.20, type: "solid" },
  { name: "H₂SO₄ (濃硫酸 98%)", formula: "H₂SO₄", mw: 98.08, type: "liquid", density: 1.84, purity: 0.98 },
];

const ReagentCalculator = () => {
  // 使用名稱與 MW 作為 state，允許使用者自訂
  const [chemName, setChemName] = useState(CHEMICALS[0].name);
  const [mw, setMw] = useState(CHEMICALS[0].mw.toString());
  const [volume, setVolume] = useState("500");
  const [concentration, setConcentration] = useState("0.10");
  const [result, setResult] = useState<any>(null);

  // AI 搜尋狀態
  const [isSearching, setIsSearching] = useState(false);
  const [sources, setSources] = useState<{uri: string, title: string}[]>([]);

  // 當使用者輸入或選擇名稱時
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChemName(val);
    setResult(null);
    setSources([]); // 清除舊的來源

    // 嘗試從預設清單中尋找是否有符合的化合物，若有則自動填入 MW
    const found = CHEMICALS.find(c => c.name === val);
    if (found) {
      setMw(found.mw.toString());
    }
  };

  const handleAiSearch = async () => {
    if (!chemName.trim()) {
      alert("請先輸入化合物名稱");
      return;
    }
    
    setIsSearching(true);
    setSources([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `What is the molar mass (molecular weight) of ${chemName}? Please provide only the numeric value in g/mol. Do not include any text explanation.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text;
      if (text) {
        // Simple heuristic: extract the first number found (e.g., 58.44 from "58.44 g/mol")
        const match = text.match(/(\d+(\.\d+)?)/);
        if (match) {
          setMw(match[0]);
          setResult(null); // Reset calculation
        }
      }

      // Extract grounding sources
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
         const uniqueSources = new Map();
         chunks.forEach((c: any) => {
           if (c.web) {
             uniqueSources.set(c.web.uri, c.web);
           }
         });
         setSources(Array.from(uniqueSources.values()));
      }

    } catch (error) {
      console.error("AI Search Error", error);
      alert("自動搜尋失敗，請檢查網路連線或稍後再試。");
    } finally {
      setIsSearching(false);
    }
  };

  const calculate = () => {
    const v = parseFloat(volume);
    const c = parseFloat(concentration);
    const mVal = parseFloat(mw);
    
    // 基本驗證
    if (isNaN(v) || isNaN(c) || isNaN(mVal) || v <= 0 || c <= 0 || mVal <= 0) {
      alert("請輸入有效的正數：體積、濃度與摩爾質量");
      return;
    }

    // 判斷是否為預設清單中的特殊液體 (濃硫酸)
    // 只有名稱完全匹配清單中的濃硫酸時，才啟用液體計算邏輯
    const presetChem = CHEMICALS.find(c => c.name === chemName);
    const isLiquidPreset = presetChem?.type === 'liquid';

    const liters = v / 1000;
    const moles = liters * c;

    let res: any = {
      name: chemName,
      mw: mVal,
      moles,
      v,
      c,
      type: isLiquidPreset ? 'liquid' : 'solid'
    };

    if (isLiquidPreset && presetChem) {
      // 液體 (濃硫酸) 計算 - 需要密度與純度資訊 (來自 preset)
      const massPure = moles * mVal; // 純質量
      const massSol = massPure / (presetChem.purity || 1); // 溶液質量
      const volSol = massSol / (presetChem.density || 1); // 溶液體積
      
      res.massPure = massPure;
      res.massSol = massSol;
      res.volSol = volSol;
    } else {
      // 一般固體或自訂化合物計算：質量 = 莫耳數 * MW
      res.mass = moles * mVal;
    }
    
    setResult(res);
  };

  return (
    <div className="card" style={{ marginTop: '30px', borderTop: '4px solid #10b981' }}>
      <h3 style={{ marginTop: 0 }}>試藥配製計算器</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>化合物名稱 (可自訂)</label>
          <input 
            list="chem-list" 
            value={chemName} 
            onChange={handleNameChange} 
            placeholder="例如: NaCl, 或輸入中文名稱"
            style={{ width: '100%' }}
          />
          
          {sources.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.8rem', backgroundColor: '#f0f9ff', padding: '8px', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: '4px' }}>資料來源 (Google Search)：</div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#4b5563' }}>
                {sources.map((s, idx) => (
                  <li key={idx}>
                    <a href={s.uri} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'none' }}>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <datalist id="chem-list">
            {CHEMICALS.map((c, i) => (
              <option key={i} value={c.name} />
            ))}
          </datalist>
        </div>
        
        <div className="form-group">
          <label>摩爾質量 MW (g/mol)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleAiSearch}
              disabled={isSearching}
              title="使用 AI 自動查找 MW"
              style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
            >
              {isSearching ? '⏳' : '✨'}
            </button>
            <input 
              type="number" 
              step="0.01"
              value={mw} 
              onChange={(e) => {
                setMw(e.target.value);
                setResult(null);
              }} 
              placeholder="MW"
              style={{ flex: 1 }}
            />
          </div>
        </div>

        <div className="form-group">
          <label>目標體積 (mL)</label>
          <input 
            type="number" 
            value={volume} 
            onChange={(e) => setVolume(e.target.value)} 
          />
        </div>
        <div className="form-group">
          <label>目標濃度 (M)</label>
          <input 
            type="number" 
            step="0.01" 
            value={concentration} 
            onChange={(e) => setConcentration(e.target.value)} 
          />
        </div>
        
        <div className="form-group full-width">
           <button 
            type="button" 
            className="btn-success" 
            onClick={calculate} 
            style={{ width: '100%' }}
          >
            開始計算
          </button>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #6ee7b7' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#065f46' }}>計算結果</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
               <div style={{ color: '#4b5563', fontSize: '0.9rem' }}>化合物資料</div>
               <div style={{ fontWeight: 'bold' }}>{result.name}</div>
               <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>MW: {result.mw} g/mol</div>
            </div>
            <div>
               <div style={{ color: '#4b5563', fontSize: '0.9rem' }}>配製目標</div>
               <div>{result.c} M, {result.v} mL</div>
               <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>需 {result.moles.toFixed(4)} mol</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #d1fae5', paddingTop: '12px' }}>
            {result.type === 'solid' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>所需秤取質量：</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
                  {result.mass.toFixed(2)} g
                </span>
              </div>
            ) : (
              // 液體 (H2SO4) 專用顯示
              <div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                   <span>所需純 H₂SO₄ 質量：</span>
                   <span>{result.massPure.toFixed(2)} g</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span>所需 98% 濃硫酸質量：</span>
                   <span>{result.massSol.toFixed(2)} g</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: '8px', padding: '8px', backgroundColor: '#fee2e2', borderRadius: '6px' }}>
                   <span style={{ color: '#991b1b', fontWeight: 'bold' }}>實際量取濃硫酸體積：</span>
                   <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
                     {result.volSol.toFixed(2)} mL
                   </span>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', fontSize: '0.85rem', color: '#666', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
        <p style={{ margin: '4px 0' }}>⚠️ <strong>安全提示：</strong>濃硫酸稀釋時請嚴格遵守『酸入水』原則（將濃硫酸緩慢加入水中並同時攪拌），以免發生噴濺危險。</p>
        <p style={{ margin: '4px 0' }}>※ 本工具僅供教學與實驗預估使用，實際操作須遵守實驗室安全規範。</p>
      </div>
    </div>
  );
};

// ----------------------
// 3. 主應用程式元件
// ----------------------

const App = () => {
  // --- State 管理 ---
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // 進階功能 State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 表單初始狀態
  const initialFormState = {
    experimentId: "",
    date: new Date().toISOString().slice(0, 16), // 預設為現在時間 YYYY-MM-DDTHH:mm
    mode: "CV" as "CV" | "CC",
    voltage: "",
    current: "",
    electrolyte: "0.10 M K₂CO₃", // 根據新需求更新範例
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
    if (isNaN(i) || isNaN(f)) return NaN;
    return f - i;
  };

  const formatDelta = (val: number) => {
    if (isNaN(val)) return "-";
    return (val > 0 ? "+" : "") + val.toFixed(2);
  };

  // 驗證欄位
  const validateField = (name: string, value: string) => {
    let error = "";
    const numVal = parseFloat(value);

    if (name === "experimentId" && !value.trim()) {
      error = "實驗編號為必填";
    }
    
    // 數值不能為負
    if (["voltage", "current", "anodeInitial", "anodeFinal", "cathodeInitial", "cathodeFinal"].includes(name)) {
      if (value && !isNaN(numVal) && numVal < 0) {
        error = "數值不能為負";
      }
    }

    setErrors((prev) => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[name] = error;
      } else {
        delete newErrors[name];
      }
      return newErrors;
    });
  };

  // 處理表單輸入
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  // --- 排序與過濾邏輯 (使用 useMemo) ---

  const processedRecords = useMemo(() => {
    let data = [...records];

    // 1. 搜尋過濾
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          r.experimentId.toLowerCase().includes(q) ||
          r.electrolyte.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
      );
    }

    // 2. 排序
    if (sortConfig) {
      data.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof ExperimentRecord];
        let valB: any = b[sortConfig.key as keyof ExperimentRecord];

        // 處理特殊計算欄位
        if (sortConfig.key === "anodeDelta") {
          valA = calculateDelta(a.anodeInitial, a.anodeFinal) || -9999;
          valB = calculateDelta(b.anodeInitial, b.anodeFinal) || -9999;
        } else if (sortConfig.key === "cathodeDelta") {
          valA = calculateDelta(a.cathodeInitial, a.cathodeFinal) || -9999;
          valB = calculateDelta(b.cathodeInitial, b.cathodeFinal) || -9999;
        } else {
           // 字串比較時轉小寫，數字則轉浮點數
           const numA = parseFloat(valA);
           const numB = parseFloat(valB);
           if (!isNaN(numA) && !isNaN(numB)) {
             valA = numA;
             valB = numB;
           } else {
             valA = String(valA).toLowerCase();
             valB = String(valB).toLowerCase();
           }
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [records, searchQuery, sortConfig]);

  // 準備圖表資料 (根據篩選後的結果，但依時間排序)
  const chartData = useMemo(() => {
    // 複製並依時間排序，確保圖表趨勢正確
    const sortedForChart = [...processedRecords].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return sortedForChart.map(r => ({
      name: r.experimentId,
      anode: calculateDelta(r.anodeInitial, r.anodeFinal) || 0,
      cathode: calculateDelta(r.cathodeInitial, r.cathodeFinal) || 0,
    }));
  }, [processedRecords]);

  // --- 功能實作 ---

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" }; // 預設降序 (最新的或最大的在前面)
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  // 新增或更新紀錄
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 檢查是否有錯誤
    if (Object.keys(errors).length > 0) {
      alert("表單有錯誤，請修正後再提交");
      return;
    }

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

    // 重置表單
    setFormData({
      ...initialFormState,
      date: new Date().toISOString().slice(0, 16),
    });
    setErrors({});
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
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 刪除單筆
  const handleDelete = (id: string) => {
    if (confirm("確定要刪除這筆紀錄嗎？")) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // 批次選取
  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = processedRecords.map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 批次刪除
  const handleBulkDelete = () => {
    if (confirm(`確定要刪除選取的 ${selectedIds.size} 筆紀錄嗎？`)) {
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    }
  };

  // 匯出功能 (支援全部或選取)
  const handleExportCSV = (onlySelected = false) => {
    const targets = onlySelected 
      ? records.filter(r => selectedIds.has(r.id))
      : records;

    if (targets.length === 0) {
      alert("沒有資料可匯出");
      return;
    }

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

    const csvContent = targets.map((r) => {
      const anodeDelta = formatDelta(calculateDelta(r.anodeInitial, r.anodeFinal));
      const cathodeDelta = formatDelta(calculateDelta(r.cathodeInitial, r.cathodeFinal));

      return [
        r.date,
        `"${r.experimentId}"`,
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
        `"${r.notes.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvString = "\ufeff" + [headers.join(","), ...csvContent].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `碳棒實驗紀錄_${onlySelected ? 'Selected' : 'All'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (confirm("警告：這將刪除所有實驗數據且無法復原！確定要繼續嗎？")) {
      setRecords([]);
      setSelectedIds(new Set());
      localStorage.removeItem("carbon_experiment_data");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      ...initialFormState,
      date: new Date().toISOString().slice(0, 16),
    });
    setErrors({});
  };

  return (
    <div>
      <div className="header-actions">
        <h1>碳棒剝落實驗紀錄系統</h1>
        <div>
          <button className="btn-success" onClick={() => handleExportCSV(false)} style={{marginRight: '10px'}}>
            匯出全部 CSV
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
              <label>實驗編號 *</label>
              <input
                type="text"
                name="experimentId"
                placeholder="例如: E001"
                value={formData.experimentId}
                onChange={handleInputChange}
                className={errors.experimentId ? "invalid" : ""}
                required
              />
              {errors.experimentId && <span className="error-msg">{errors.experimentId}</span>}
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
                className={errors.voltage ? "invalid" : ""}
              />
              {errors.voltage && <span className="error-msg">{errors.voltage}</span>}
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
                className={errors.current ? "invalid" : ""}
              />
              {errors.current && <span className="error-msg">{errors.current}</span>}
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
                className={errors.anodeInitial ? "invalid" : ""}
              />
              {errors.anodeInitial && <span className="error-msg">{errors.anodeInitial}</span>}
            </div>
            <div className="form-group">
              <label>陽極結束質量 (g)</label>
              <input
                type="number"
                step="0.0001"
                name="anodeFinal"
                value={formData.anodeFinal}
                onChange={handleInputChange}
                className={errors.anodeFinal ? "invalid" : ""}
              />
              {errors.anodeFinal && <span className="error-msg">{errors.anodeFinal}</span>}
            </div>
            <div className="form-group">
              <label>陰極初始質量 (g)</label>
              <input
                type="number"
                step="0.0001"
                name="cathodeInitial"
                value={formData.cathodeInitial}
                onChange={handleInputChange}
                className={errors.cathodeInitial ? "invalid" : ""}
              />
              {errors.cathodeInitial && <span className="error-msg">{errors.cathodeInitial}</span>}
            </div>
            <div className="form-group">
              <label>陰極結束質量 (g)</label>
              <input
                type="number"
                step="0.0001"
                name="cathodeFinal"
                value={formData.cathodeFinal}
                onChange={handleInputChange}
                className={errors.cathodeFinal ? "invalid" : ""}
              />
              {errors.cathodeFinal && <span className="error-msg">{errors.cathodeFinal}</span>}
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
            <button type="submit" className="btn-primary" disabled={Object.keys(errors).length > 0}>
              {editingId ? "儲存更新" : "新增紀錄"}
            </button>
          </div>
        </form>
      </div>

      {/* --- 圖表視覺化區 --- */}
      {records.length > 0 && (
        <div className="card">
          <h3 style={{marginTop: 0, marginBottom: '20px'}}>質量變化趨勢圖 (Δm)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: 'g', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="anode" name="陽極變化 (Anode)" stroke="#dc2626" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="cathode" name="陰極變化 (Cathode)" stroke="#16a34a" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* --- 工具列與搜尋 --- */}
      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="搜尋編號、電解液或備註..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {selectedIds.size > 0 && (
          <div className="bulk-actions">
            <span>已選取 {selectedIds.size} 筆</span>
            <button className="btn-success btn-sm" onClick={() => handleExportCSV(true)}>
              匯出選取
            </button>
            <button className="btn-danger btn-sm" onClick={handleBulkDelete}>
              刪除選取
            </button>
          </div>
        )}
      </div>

      {/* --- 資料列表區 --- */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th className="checkbox-col">
                <input 
                  type="checkbox" 
                  checked={processedRecords.length > 0 && selectedIds.size === processedRecords.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th onClick={() => handleSort('date')}>
                日期時間 <span className="sort-indicator">{getSortIcon('date')}</span>
              </th>
              <th onClick={() => handleSort('experimentId')}>
                編號 <span className="sort-indicator">{getSortIcon('experimentId')}</span>
              </th>
              <th>模式</th>
              <th>電壓 V</th>
              <th>電流 A</th>
              <th>電解液</th>
              <th onClick={() => handleSort('anodeDelta')}>
                陽極 Δm⁺ <span className="sort-indicator">{getSortIcon('anodeDelta')}</span>
              </th>
              <th onClick={() => handleSort('cathodeDelta')}>
                陰極 Δm⁻ <span className="sort-indicator">{getSortIcon('cathodeDelta')}</span>
              </th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {processedRecords.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center">
                  {searchQuery ? "沒有符合搜尋條件的資料。" : "目前沒有資料，請由上方新增。"}
                </td>
              </tr>
            ) : (
              processedRecords.map((rec) => {
                const anodeVal = calculateDelta(rec.anodeInitial, rec.anodeFinal);
                const cathodeVal = calculateDelta(rec.cathodeInitial, rec.cathodeFinal);
                const anodeDelta = formatDelta(anodeVal);
                const cathodeDelta = formatDelta(cathodeVal);
                const isSelected = selectedIds.has(rec.id);

                return (
                  <tr key={rec.id} className={isSelected ? 'selected' : ''}>
                    <td className="checkbox-col">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleSelectOne(rec.id)}
                      />
                    </td>
                    <td>{rec.date.replace("T", " ")}</td>
                    <td>{rec.experimentId}</td>
                    <td>{rec.mode}</td>
                    <td>{rec.voltage}</td>
                    <td>{rec.current}</td>
                    <td>{rec.electrolyte}</td>
                    <td className={anodeVal < 0 ? "delta-negative" : "delta-positive"}>
                      {anodeDelta}
                      <div style={{ fontSize: "0.8em", color: "#666", fontWeight: "normal" }}>
                        ({rec.anodeInitial} → {rec.anodeFinal})
                      </div>
                    </td>
                    <td className={cathodeVal < 0 ? "delta-negative" : "delta-positive"}>
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

      {/* --- 試藥配製計算器區塊 --- */}
      <ReagentCalculator />
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
