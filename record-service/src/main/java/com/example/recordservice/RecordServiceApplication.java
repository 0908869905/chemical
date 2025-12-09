package com.example.recordservice; // 定義套件名稱，方便管理與匯入

import org.springframework.boot.SpringApplication; // 匯入 SpringApplication 用於啟動 Spring Boot
import org.springframework.boot.autoconfigure.SpringBootApplication; // 匯入啟動註解，啟用自動設定

/**
 * 應用程式進入點：啟動 Spring Boot 服務。
 * 每個類別或欄位下方都會有註解解釋用途，方便初學者理解。
 */
@SpringBootApplication // 告訴 Spring 這是主要的組態類別，啟用元件掃描與自動設定
public class RecordServiceApplication {

    /**
     * Java 程式的主方法，執行後會啟動內嵌的伺服器（預設為 8080 port）。
     * @param args 啟動參數，通常維持預設即可。
     */
    public static void main(String[] args) {
        SpringApplication.run(RecordServiceApplication.class, args); // 透過 SpringApplication 啟動整個應用
    }
}
