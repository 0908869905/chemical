"""LLM helper functions for summarizing experiments and drafting reports."""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Iterable, List

import requests

from . import config
from .analyzer import experiments_to_dataframe
from .models import Anomaly, Experiment


class AIExperimentAssistant:
    """Helper to call an LLM for experiment summaries and report drafts."""

    def __init__(self, api_key: str | None = None, model: str | None = None, api_base: str | None = None):
        self.api_key = api_key or config.OPENAI_API_KEY
        self.model = model or config.OPENAI_MODEL
        self.api_base = api_base or config.OPENAI_API_BASE

    def _call_llm(self, prompt: str) -> str:
        if not self.api_key:
            return "未設定 OPENAI_API_KEY，無法呼叫 LLM。請在環境變數中設定後重試。"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是一位碳棒化學剝離實驗助手，請用中文回答。"},
                {"role": "user", "content": prompt},
            ],
        }
        response = requests.post(self.api_base, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        data = response.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    def summarize_experiments(self, experiments: Iterable[Experiment]) -> str:
        df = experiments_to_dataframe(experiments)
        if df.empty:
            return "沒有可用的實驗資料。"
        summary_lines = []
        summary_lines.append(
            f"共 {len(df)} 筆紀錄，陽極 Δm 平均 {df['delta_mass_positive_g'].mean():.4f} g，"
            f"陰極 Δm 平均 {df['delta_mass_negative_g'].mean():.4f} g。"
        )
        summary_lines.append(
            f"陽/陰 Δm 絕對值平均比值為 "
            f"{(df['delta_mass_positive_g'].abs() / df['delta_mass_negative_g'].abs().replace(0, float('nan'))).mean():.2f}。"
        )
        grouped = df.groupby(["electrolyte", "mode"])
        for (electrolyte, mode), group in grouped:
            summary_lines.append(
                f"條件 {electrolyte} - {mode}：陽極 Δm 平均 {group['delta_mass_positive_g'].mean():.4f} g，"
                f"陰極 Δm 平均 {group['delta_mass_negative_g'].mean():.4f} g。"
            )
        prompt = "\n".join(summary_lines) + "\n請用條列式說明結果重點並評估是否符合陽極剝落為主的預期。"
        return self._call_llm(prompt)

    def explain_anomalies(self, anomalies: Iterable[Anomaly], experiments: Iterable[Experiment]) -> str:
        anomalies = list(anomalies)
        if not anomalies:
            return "未偵測到異常。"
        df = experiments_to_dataframe(experiments)
        detail = "\n".join([f"{a.experiment_id}: {a.message}" for a in anomalies])
        prompt = (
            "以下為異常清單，請分析可能原因並提供改善建議（中文）。\n" + detail + "\n" +
            "若需要可引用下方摘要資料：\n" + df.to_string(index=False)
        )
        return self._call_llm(prompt)

    def draft_report_section(self, experiments: Iterable[Experiment], analysis: dict) -> str:
        experiments = list(experiments)
        if not experiments:
            return "沒有可用的實驗資料。"
        df = experiments_to_dataframe(experiments)
        anomalies = analysis.get("anomalies", [])
        prompt = f"請根據以下數據撰寫結果與討論草稿（中文）：\n統計：{analysis}\n資料表：\n{df.to_string(index=False)}\n"
        if anomalies:
            prompt += "異常：" + "; ".join([a.get("message", "") for a in anomalies])
        prompt += "\n請包含實驗目的、主要趨勢、陽極/陰極差異、異常原因與改善建議。"
        return self._call_llm(prompt)


def save_report(content: str, output_dir: Path | None = None) -> Path:
    """Save report content to the reports directory with a timestamped filename."""
    output_dir = output_dir or config.REPORTS_DIR
    output_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"report_{timestamp}.md"
    output_path.write_text(content, encoding="utf-8")
    return output_path
