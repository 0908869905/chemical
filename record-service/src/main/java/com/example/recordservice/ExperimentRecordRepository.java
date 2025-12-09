package com.example.recordservice; // 與其他類別同套件

import org.springframework.data.jpa.repository.JpaRepository; // JPA 介面，提供基本 CRUD
import org.springframework.stereotype.Repository; // 標註為 Spring Bean

/**
 * Repository 介面：繼承 JpaRepository 即可取得大部分 CRUD 方法。
 */
@Repository // 讓 Spring 產生此 Bean
public interface ExperimentRecordRepository extends JpaRepository<ExperimentRecord, String> {
    // 不需額外程式碼，JpaRepository 已內建 findAll/save/delete 等方法
}
