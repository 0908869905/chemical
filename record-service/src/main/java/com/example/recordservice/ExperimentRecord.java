package com.example.recordservice; // 同一個套件下方便與其他類別互相呼叫

import jakarta.persistence.Column; // JPA 註解，用來設定欄位細節
import jakarta.persistence.Entity; // 標示此類別為資料庫實體
import jakarta.persistence.Id; // 指定主鍵欄位
import jakarta.persistence.Table; // 指定資料表名稱
import java.time.Instant; // 使用 Instant 存時間戳，避免時區誤差
import java.util.UUID; // 用來產生唯一的字串 ID

/**
 * ExperimentRecord 實體：對應資料庫中的紀錄表。
 * 每個欄位都對應前端傳遞的 JSON 欄位名稱，方便直接序列化/反序列化。
 */
@Entity // 告訴 JPA 這個類別要轉成資料表
@Table(name = "experiment_records") // 指定資料表名稱
public class ExperimentRecord {

    @Id // 主鍵
    @Column(length = 64) // 設定欄位長度，容納 UUID 字串
    private String id; // 紀錄的唯一識別碼（與前端共用）

    @Column(nullable = false) // 不允許空值
    private String experimentId; // 實驗編號

    @Column(nullable = false)
    private String date; // 日期時間字串 (前端傳來的 datetime-local 格式)

    @Column(nullable = false)
    private String mode; // 模式：CV 或 CC

    @Column
    private String voltage; // 設定電壓

    @Column
    private String current; // 設定電流

    @Column
    private String electrolyte; // 電解液描述

    @Column
    private String anodeInitial; // 陽極初始質量

    @Column
    private String anodeFinal; // 陽極結束質量

    @Column
    private String cathodeInitial; // 陰極初始質量

    @Column
    private String cathodeFinal; // 陰極結束質量

    @Column(length = 2000) // 備註欄位較長，預留 2000 字符
    private String notes; // 備註

    @Column(nullable = false)
    private Instant timestamp; // 建立或最後修改時間

    /**
     * 預設建構子供 JPA 使用。
     */
    public ExperimentRecord() {
        // JPA 需要空建構子，實際邏輯在 buildNewRecord 方法處理
    }

    /**
     * 工具方法：在新增資料時自動補齊 ID 與時間戳。
     * @return 填滿必要欄位的實體
     */
    public ExperimentRecord buildNewRecord() {
        if (this.id == null || this.id.isBlank()) { // 若前端未提供 ID 就產生 UUID
            this.id = UUID.randomUUID().toString();
        }
        this.timestamp = Instant.now(); // 紀錄當下時間
        return this;
    }

    /**
     * 在更新資料時刷新時間戳。
     */
    public void touchTimestamp() {
        this.timestamp = Instant.now(); // 更新為目前時間
    }

    // 以下為標準的 Getter/Setter，每個方法都附上註解方便閱讀

    public String getId() {
        return id; // 回傳紀錄 ID
    }

    public void setId(String id) {
        this.id = id; // 設定紀錄 ID
    }

    public String getExperimentId() {
        return experimentId; // 回傳實驗編號
    }

    public void setExperimentId(String experimentId) {
        this.experimentId = experimentId; // 設定實驗編號
    }

    public String getDate() {
        return date; // 回傳日期時間
    }

    public void setDate(String date) {
        this.date = date; // 設定日期時間
    }

    public String getMode() {
        return mode; // 回傳模式
    }

    public void setMode(String mode) {
        this.mode = mode; // 設定模式
    }

    public String getVoltage() {
        return voltage; // 回傳電壓
    }

    public void setVoltage(String voltage) {
        this.voltage = voltage; // 設定電壓
    }

    public String getCurrent() {
        return current; // 回傳電流
    }

    public void setCurrent(String current) {
        this.current = current; // 設定電流
    }

    public String getElectrolyte() {
        return electrolyte; // 回傳電解液資訊
    }

    public void setElectrolyte(String electrolyte) {
        this.electrolyte = electrolyte; // 設定電解液資訊
    }

    public String getAnodeInitial() {
        return anodeInitial; // 回傳陽極初始質量
    }

    public void setAnodeInitial(String anodeInitial) {
        this.anodeInitial = anodeInitial; // 設定陽極初始質量
    }

    public String getAnodeFinal() {
        return anodeFinal; // 回傳陽極結束質量
    }

    public void setAnodeFinal(String anodeFinal) {
        this.anodeFinal = anodeFinal; // 設定陽極結束質量
    }

    public String getCathodeInitial() {
        return cathodeInitial; // 回傳陰極初始質量
    }

    public void setCathodeInitial(String cathodeInitial) {
        this.cathodeInitial = cathodeInitial; // 設定陰極初始質量
    }

    public String getCathodeFinal() {
        return cathodeFinal; // 回傳陰極結束質量
    }

    public void setCathodeFinal(String cathodeFinal) {
        this.cathodeFinal = cathodeFinal; // 設定陰極結束質量
    }

    public String getNotes() {
        return notes; // 回傳備註
    }

    public void setNotes(String notes) {
        this.notes = notes; // 設定備註
    }

    public Instant getTimestamp() {
        return timestamp; // 回傳時間戳
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp; // 設定時間戳
    }
}
