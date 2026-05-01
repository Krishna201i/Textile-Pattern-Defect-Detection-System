import json, re

with open("TextileGuard_train_v2_colab.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

checks = []

for i, cell in enumerate(nb["cells"]):
    if cell["cell_type"] != "code":
        continue
    src = "".join(cell["source"])

    # Check config values
    if "BATCH_SIZE" in src and "PHASE1_EPOCHS" in src and "FINE_TUNE_AT" in src:
        bs = re.search(r"^BATCH_SIZE\s*=\s*(\d+)", src, re.M)
        p2 = re.search(r"^PHASE2_EPOCHS\s*=\s*(\d+)", src, re.M)
        ft = re.search(r"^FINE_TUNE_AT\s*=\s*(-\d+)", src, re.M)
        checks.append(("BATCH_SIZE = 8",     bs and bs.group(1) == "8",  "Got: " + (bs.group(1) if bs else "NOT FOUND")))
        checks.append(("PHASE2_EPOCHS = 10", p2 and p2.group(1) == "10", "Got: " + (p2.group(1) if p2 else "NOT FOUND")))
        checks.append(("FINE_TUNE_AT = -20", ft and ft.group(1) == "-20","Got: " + (ft.group(1) if ft else "NOT FOUND")))

    # Check no .cache()
    if ".cache()" in src:
        checks.append((".cache() removed", False, "Still present in cell " + str(i)))

    # Check Dense head
    if "dense_head_1" in src:
        has512 = "Dense(512" in src
        has128 = "Dense(128" in src
        checks.append(("Dense head = 128", has128 and not has512,
                       "OK: Dense(128) confirmed" if (has128 and not has512) else
                       ("Dense(512) still present" if has512 else "Dense(128) not found")))

    # Check prefetch syntax clean
    if "val_ds.prefetch" in src or "test_ds.prefetch" in src:
        garbled = "prefetch  #" in src
        checks.append(("prefetch() syntax valid", not garbled,
                       "GARBLED" if garbled else "OK"))

# Add global cache check
all_src = "".join("".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code")
if ".cache()" not in all_src:
    checks.append((".cache() removed (global)", True, "No .cache() found anywhere in notebook"))

print()
print("=" * 50)
print("  FINAL VERIFICATION REPORT")
print("=" * 50)
all_ok = True
for name, ok, detail in checks:
    marker = "PASS" if ok else "FAIL"
    if not ok:
        all_ok = False
    print(marker + "  |  " + name + "  [" + detail + "]")
print("-" * 50)
print("RESULT: " + ("ALL CHECKS PASSED - Notebook is ready!" if all_ok else "SOME CHECKS FAILED"))
print("=" * 50)
