package com.example.recordservice; // 套件名稱與其他類別一致

import org.springframework.http.HttpHeaders; // 用於設定回應標頭
import org.springframework.http.HttpStatus; // HTTP 狀態碼列舉
import org.springframework.http.MediaType; // MediaType 常數（用於 CSV 回應）
import org.springframework.http.ResponseEntity; // 用於產生完整的 HTTP 回應
import org.springframework.web.bind.annotation.*; // 匯入 REST 註解
import org.springframework.web.server.ResponseStatusException; // 拋出對應 HTTP 狀態碼的例外

import java.nio.charset.StandardCharsets; // 設定 CSV 編碼
import java.util.Comparator; // 排序用的比較器
import java.util.List; // List 容器
import java.util.stream.Collectors; // 用於串流處理

/**
 * REST 控制器：提供 CRUD 與 CSV 匯出 API。
 * 每個端點都加上詳細註解，協助理解流程。
 */
@RestController // 這個類別會處理 RESTful 請求並回傳 JSON
@RequestMapping("/records") // 所有路徑都以 /records 開頭
@CrossOrigin // 允許前端跨來源請求（開發階段方便存取）
public class ExperimentRecordController {

    private final ExperimentRecordRepository repository; // 注入 Repository 以存取資料庫

    /**
     * 透過建構子注入 Repository，Spring 會自動提供實例。
     * @param repository JPA Repository 實作
     */
    public ExperimentRecordController(ExperimentRecordRepository repository) {
        this.repository = repository; // 儲存到欄位以供後續方法使用
    }

    /**
     * GET /records：取得所有紀錄。
     * 這裡依 timestamp 由新到舊排序，方便前端顯示最新資料在前面。
     * @return JSON 陣列
     */
    @GetMapping
    public List<ExperimentRecord> findAll() {
        return repository.findAll()
                .stream()
                .sorted(Comparator.comparing(ExperimentRecord::getTimestamp).reversed())
                .collect(Collectors.toList()); // 排序後回傳
    }

    /**
     * POST /records：新增一筆紀錄。
     * 若前端未提供 id，會在伺服端產生 UUID；timestamp 也會自動補上。
     * @param record 前端送來的 JSON 資料
     * @return 儲存後的完整紀錄
     */
    @PostMapping
    public ExperimentRecord create(@RequestBody ExperimentRecord record) {
        ExperimentRecord readyRecord = record.buildNewRecord(); // 自動補 ID 與時間戳
        return repository.save(readyRecord); // 寫入資料庫並回傳
    }

    /**
     * PUT /records/{id}：更新既有紀錄。
     * 若找不到指定 ID，回傳 404。
     * @param id 路徑上的紀錄 ID
     * @param payload 前端送來的新資料
     * @return 更新後的紀錄
     */
    @PutMapping("/{id}")
    public ExperimentRecord update(@PathVariable String id, @RequestBody ExperimentRecord payload) {
        return repository.findById(id)
                .map(existing -> {
                    existing.setExperimentId(payload.getExperimentId()); // 更新實驗編號
                    existing.setDate(payload.getDate()); // 更新日期時間
                    existing.setMode(payload.getMode()); // 更新模式
                    existing.setVoltage(payload.getVoltage()); // 更新電壓
                    existing.setCurrent(payload.getCurrent()); // 更新電流
                    existing.setElectrolyte(payload.getElectrolyte()); // 更新電解液
                    existing.setAnodeInitial(payload.getAnodeInitial()); // 更新陽極初始
                    existing.setAnodeFinal(payload.getAnodeFinal()); // 更新陽極結束
                    existing.setCathodeInitial(payload.getCathodeInitial()); // 更新陰極初始
                    existing.setCathodeFinal(payload.getCathodeFinal()); // 更新陰極結束
                    existing.setNotes(payload.getNotes()); // 更新備註
                    existing.touchTimestamp(); // 重新紀錄最後修改時間
                    return repository.save(existing); // 儲存並回傳
                })
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found")); // 找不到時回傳 404
    }

    /**
     * DELETE /records/{id}：刪除指定紀錄。
     * 找不到資料時回傳 404。
     * @param id 紀錄 ID
     * @return 204 No Content 回應
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        return repository.findById(id)
                .map(record -> {
                    repository.delete(record); // 找到就刪除
                    return ResponseEntity.noContent().build(); // 回傳 204
                })
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found")); // 找不到回 404
    }

    /**
     * GET /records/export：將所有資料匯出為 CSV 字串。
     * 產生 UTF-8 帶 BOM 的檔案，避免 Excel 亂碼。
     * @return CSV 下載回應
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv() {
        String header = String.join(",",
                "id", "timestamp", "experimentId", "date", "mode", "voltage", "current",
                "electrolyte", "anodeInitial", "anodeFinal", "cathodeInitial", "cathodeFinal", "notes"); // CSV 標題

        String body = repository.findAll().stream()
                .map(r -> String.join(",",
                        wrap(r.getId()),
                        wrap(r.getTimestamp() != null ? r.getTimestamp().toString() : ""),
                        wrap(r.getExperimentId()),
                        wrap(r.getDate()),
                        wrap(r.getMode()),
                        wrap(r.getVoltage()),
                        wrap(r.getCurrent()),
                        wrap(r.getElectrolyte()),
                        wrap(r.getAnodeInitial()),
                        wrap(r.getAnodeFinal()),
                        wrap(r.getCathodeInitial()),
                        wrap(r.getCathodeFinal()),
                        wrap(r.getNotes())
                ))
                .collect(Collectors.joining("\n")); // 將每列用換行連接

        String csv = "\ufeff" + header + "\n" + body; // 加入 BOM 與標題
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8); // 轉成位元組陣列

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(new MediaType("text", "csv", StandardCharsets.UTF_8)); // 設定回應型態
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=experiment-records.csv"); // 讓瀏覽器下載檔案

        return new ResponseEntity<>(bytes, headers, HttpStatus.OK); // 回傳檔案內容
    }

    /**
     * 小工具：用雙引號包住字串並轉義內部的引號，避免 CSV 破版。
     */
    private String wrap(String value) {
        String safe = value == null ? "" : value.replace("\"", "\"\""); // 把 " 變成 ""
        return "\"" + safe + "\""; // 兩邊加上雙引號
    }
}
