"""Command-line interface entrypoints for the experiment assistant."""
from __future__ import annotations

from datetime import datetime
from typing import List

import pandas as pd

from . import analyzer, config
from .ai_helper import AIExperimentAssistant, save_report
from .recorder import ValidationError, add_experiment, delete_experiment, edit_experiment, query_experiments
from .reagent_calc import MOLAR_MASSES, calc_h2so4_volume, calc_solid_mass
from .storage import export_to_csv, init_db


init_db()


def prompt_date(prompt: str) -> datetime | None:
    value = input(prompt).strip()
    if not value:
        return None
    return datetime.fromisoformat(value)


def display_experiments(experiments) -> None:
    if not experiments:
        print("沒有符合條件的實驗紀錄。")
        return
    df = analyzer.experiments_to_dataframe(experiments)
    print(df.to_string(index=False))


def handle_add_experiment():
    print("新增實驗紀錄：")
    try:
        experiment = add_experiment(
            date_time=input("日期時間 (YYYY-MM-DD HH:MM, 空白則為現在): ").strip() or datetime.now().isoformat(),
            experiment_id=input("實驗編號: ").strip(),
            mode=input("模式 (CV/CC): ").strip(),
            voltage_V=input("設定電壓(V，可空白): ").strip() or None,
            current_A=input("設定電流(A，可空白): ").strip() or None,
            electrolyte=input("電解液: ").strip(),
            duration_min=input("電解時間(分鐘，可空白): ").strip() or None,
            initial_mass_positive_g=input("陽極初始質量(g): ").strip(),
            final_mass_positive_g=input("陽極終點質量(g): ").strip(),
            initial_mass_negative_g=input("陰極初始質量(g): ").strip(),
            final_mass_negative_g=input("陰極終點質量(g): ").strip(),
            notes=input("備註: ").strip(),
        )
        print(f"已新增: {experiment}")
    except ValidationError as e:
        print(f"輸入錯誤：{e}")


def handle_edit_experiment():
    exp_id = input("要編輯的實驗編號: ").strip()
    field = input("欄位名稱: ").strip()
    value = input("新值: ").strip()
    try:
        updated = edit_experiment(exp_id, **{field: value})
        print(f"已更新: {updated}")
    except ValidationError as e:
        print(f"錯誤：{e}")


def handle_delete_experiment():
    exp_id = input("要刪除的實驗編號: ").strip()
    try:
        delete_experiment(exp_id)
        print("已刪除。")
    except ValidationError as e:
        print(f"錯誤：{e}")


def handle_view_experiments():
    start = prompt_date("開始日期 (YYYY-MM-DD，可空白): ")
    end = prompt_date("結束日期 (YYYY-MM-DD，可空白): ")
    mode = input("模式篩選(CV/CC，可空白): ").strip() or None
    electrolyte = input("電解液篩選(可空白): ").strip() or None
    search = input("關鍵字搜尋(備註/編號，可空白): ").strip() or None
    experiments = query_experiments(start_date=start, end_date=end, mode=mode, electrolyte=electrolyte, search=search)
    display_experiments(experiments)


def handle_analysis_and_plots():
    experiments = query_experiments()
    if not experiments:
        print("目前沒有資料")
        return
    df = analyzer.experiments_to_dataframe(experiments)
    stats = analyzer.basic_statistics(df)
    grouped = analyzer.grouped_statistics(df)
    anomalies = analyzer.detect_anomalies(experiments)
    print("=== 整體統計 ===")
    print(stats)
    print("=== 依條件分組 ===")
    print(grouped)
    if anomalies:
        print("=== 異常 ===")
        for a in anomalies:
            print(f"{a.experiment_id}: {a.message}")

    choice = input("要產生哪種圖？1) Δm vs 編號 2) Δm vs 時間 其他跳過: ").strip()
    if choice == "1":
        output = analyzer.plot_deltas(df, "Δm vs Experiment", config.PLOTS_DIR / "deltas.png")
        print(f"已輸出 {output}")
    elif choice == "2":
        output = analyzer.plot_time_trend(df, "Δm vs Date", config.PLOTS_DIR / "deltas_time.png")
        print(f"已輸出 {output}")


def handle_reagent_calc():
    print("可用化合物：", ", ".join(MOLAR_MASSES.keys()))
    formula = input("輸入化學式: ").strip()
    volume_ml = float(input("溶液體積 mL (預設 500): ") or 500)
    molarity = float(input("目標濃度 M (預設 0.10): ") or 0.10)
    if formula == "H2SO4":
        volume = calc_h2so4_volume(volume_ml, molarity)
        print(f"需加入濃硫酸 {volume:.2f} mL")
    else:
        mass = calc_solid_mass(formula, volume_ml, molarity)
        print(f"需固體質量 {mass:.2f} g")


def handle_export():
    path = export_to_csv()
    print(f"已匯出 CSV: {path}")


def handle_ai_helper():
    assistant = AIExperimentAssistant()
    experiments = query_experiments()
    if not experiments:
        print("目前沒有實驗資料。")
        return
    print("1) 總結最近 N 次實驗")
    print("2) 說明最近 N 次實驗的異常")
    print("3) 生成報告草稿")
    choice = input("選擇: ").strip()
    n = int(input("N = ").strip() or 5)
    recent = experiments[:n]
    if choice == "1":
        print(assistant.summarize_experiments(recent))
    elif choice == "2":
        anomalies = analyzer.detect_anomalies(recent)
        print(assistant.explain_anomalies(anomalies, recent))
    elif choice == "3":
        analysis = analyzer.summarize_analysis(recent)
        report = assistant.draft_report_section(recent, analysis)
        path = save_report(report)
        print(f"已儲存報告草稿：{path}")


def run_cli():
    menu = {
        "1": handle_add_experiment,
        "2": handle_view_experiments,
        "3": handle_analysis_and_plots,
        "4": handle_reagent_calc,
        "5": handle_ai_helper,
        "6": handle_export,
    }
    while True:
        print("""
=== 碳棒化學剝離實驗助手 ===
1. 新增實驗紀錄
2. 檢視實驗紀錄（可篩選、排序）
3. 數據分析與圖表
4. 試藥配製計算器
5. AI 助手：自動解讀數據與寫報告草稿
6. 匯出資料（CSV / 圖表）
7. 離開
        """)
        choice = input("請選擇: ").strip()
        if choice == "7":
            print("再見！")
            break
        action = menu.get(choice)
        if action:
            action()
        else:
            print("無效的選項，請重試。")
