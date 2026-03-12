"""
Grant admin access by creating admins/{uid} in Firestore.

Usage:
  set FIREBASE_SERVICE_ACCOUNT_JSON to a service account JSON path
  python grant_admin.py <FIREBASE_UID>

Optional:
  set FIREBASE_PROJECT_ID to override project id
"""

import os
import sys
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore


def main():
  if len(sys.argv) < 2:
    raise SystemExit("Usage: python grant_admin.py <FIREBASE_UID>")

  uid = sys.argv[1].strip()
  if not uid:
    raise SystemExit("UID cannot be empty")

  sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
  if not sa_path or not os.path.exists(sa_path):
    raise SystemExit(
      "Set FIREBASE_SERVICE_ACCOUNT_JSON to a valid service account JSON path."
    )

  project_id = os.environ.get("FIREBASE_PROJECT_ID")
  cred = credentials.Certificate(sa_path)
  firebase_admin.initialize_app(cred, {"projectId": project_id} if project_id else None)

  db = firestore.client()
  db.collection("admins").document(uid).set({
    "uid": uid,
    "granted_at": datetime.utcnow().isoformat() + "Z",
  }, merge=True)

  print(f"Granted admin access to UID: {uid}")


if __name__ == "__main__":
  main()
