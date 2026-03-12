"""
Migrate local scan_records.json to Firestore.

Usage:
  set FIREBASE_SERVICE_ACCOUNT_JSON to a service account JSON path
  python migrate_scan_records.py

Optional:
  set FIREBASE_PROJECT_ID to override project id
"""

import json
import os
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECORDS_PATH = os.path.join(BASE_DIR, "saved_model", "scan_records.json")
COLLECTION = "scan_records"


def _load_records():
  if not os.path.exists(RECORDS_PATH):
    raise FileNotFoundError(f"scan_records.json not found at {RECORDS_PATH}")
  with open(RECORDS_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)
  if not isinstance(data, list):
    raise ValueError("scan_records.json is not a list")
  return data


def _parse_time(value):
  if not value:
    return None
  try:
    return datetime.fromisoformat(value)
  except Exception:
    return None


def main():
  sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
  if not sa_path or not os.path.exists(sa_path):
    raise SystemExit(
      "Set FIREBASE_SERVICE_ACCOUNT_JSON to a valid service account JSON path."
    )

  project_id = os.environ.get("FIREBASE_PROJECT_ID")
  cred = credentials.Certificate(sa_path)
  firebase_admin.initialize_app(cred, {"projectId": project_id} if project_id else None)

  db = firestore.client()
  records = _load_records()

  migrated = 0
  for record in records:
    if not isinstance(record, dict):
      continue

    record_id = record.get("id") or record.get("request_id")
    if not record_id:
      continue

    created_at = _parse_time(record.get("time"))

    payload = {
      "owner": record.get("owner", "local"),
      "label": record.get("label", "unknown"),
      "confidence": float(record.get("confidence", 0.0)),
      "defect_probability": float(record.get("defect_probability", 0.0)),
      "source": record.get("source", "upload"),
      "pipeline": record.get("pipeline", "cnn_cv_hybrid"),
      "cnn_defect_probability": float(record.get("cnn_defect_probability", 0.0)),
      "cv_defect_probability": float(record.get("cv_defect_probability", 0.0)),
      "filename": record.get("filename", "image"),
      "admin_note": record.get("admin_note", ""),
      "time": record.get("time"),
      "image_url": record.get("image_url"),
      "inference_ms": float(record.get("inference_ms", 0.0)),
      "request_id": record.get("request_id"),
      "created_at": created_at or firestore.SERVER_TIMESTAMP,
    }

    db.collection(COLLECTION).document(record_id).set(payload, merge=True)
    migrated += 1

  print(f"Migrated {migrated} scan records to Firestore collection '{COLLECTION}'.")


if __name__ == "__main__":
  main()
