"""
Export all scan records from Firestore to a CSV file.

Usage:
  set FIREBASE_SERVICE_ACCOUNT_JSON to a service account JSON path
  python export_scans_csv.py

Optional:
  set FIREBASE_PROJECT_ID to override project id
  set EXPORT_CSV_PATH to override output file path
"""

import csv
import os
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore

DEFAULT_OUTPUT = "scan_records_export.csv"
COLLECTION = "scan_records"


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
  records = db.collection(COLLECTION).order_by("created_at", direction=firestore.Query.DESCENDING).stream()

  output_path = os.environ.get("EXPORT_CSV_PATH", DEFAULT_OUTPUT)
  fieldnames = [
    "id",
    "owner",
    "label",
    "confidence",
    "defect_probability",
    "cnn_defect_probability",
    "cv_defect_probability",
    "pipeline",
    "source",
    "filename",
    "image_url",
    "time",
    "admin_note",
    "request_id",
    "inference_ms",
  ]

  count = 0
  with open(output_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for doc_snap in records:
      data = doc_snap.to_dict() or {}
      row = {
        "id": doc_snap.id,
        "owner": data.get("owner", ""),
        "label": data.get("label", ""),
        "confidence": data.get("confidence", ""),
        "defect_probability": data.get("defect_probability", ""),
        "cnn_defect_probability": data.get("cnn_defect_probability", ""),
        "cv_defect_probability": data.get("cv_defect_probability", ""),
        "pipeline": data.get("pipeline", ""),
        "source": data.get("source", ""),
        "filename": data.get("filename", ""),
        "image_url": data.get("image_url", ""),
        "time": data.get("time", ""),
        "admin_note": data.get("admin_note", ""),
        "request_id": data.get("request_id", ""),
        "inference_ms": data.get("inference_ms", ""),
      }
      writer.writerow(row)
      count += 1

  stamp = datetime.utcnow().isoformat() + "Z"
  print(f"Exported {count} records to {output_path} at {stamp}")


if __name__ == "__main__":
  main()
