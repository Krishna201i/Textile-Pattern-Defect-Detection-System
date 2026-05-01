import json, re

NB_PATH = "TextileGuard_train_v2_colab.ipynb"

with open(NB_PATH, "r", encoding="utf-8") as f:
    nb = json.load(f)

report = []

for i, cell in enumerate(nb["cells"]):
    if cell["cell_type"] != "code":
        continue
    src = "".join(cell["source"])

    changed = False

    # ── FIX 1: Config values ──────────────────────────────────────────────────
    if "BATCH_SIZE" in src and "PHASE1_EPOCHS" in src and "FINE_TUNE_AT" in src:
        new = src
        new = re.sub(r"(BATCH_SIZE\s*=\s*)\d+", r"\g<1>8", new)
        new = re.sub(r"(PHASE2_EPOCHS\s*=\s*)\d+[^\n]*", r"\g<1>10  # Reduced for CPU", new)
        new = re.sub(r"(FINE_TUNE_AT\s*=\s*)-\d+[^\n]*", r"\g<1>-20  # Reduced for CPU", new)
        if new != src:
            src = new
            changed = True
            report.append("FIX 1: Config values updated (BATCH=8, EPOCHS=10, FINE_TUNE=-20)")

    # ── FIX 2: Remove .cache() ────────────────────────────────────────────────
    if ".cache().prefetch" in src:
        src = src.replace(".cache().prefetch(AUTOTUNE)", ".prefetch(AUTOTUNE)  # cache() removed - prevents OOM")
        changed = True
        report.append("FIX 2: .cache() removed from dataset pipeline in cell " + str(i))

    # Also fix garbled syntax from previous attempt
    garbled = ".prefetch  # .cache() removed - prevents RAM OOM(AUTOTUNE)"
    if garbled in src:
        src = src.replace(garbled, ".prefetch(AUTOTUNE)  # cache() removed - prevents OOM")
        changed = True
        report.append("FIX 2b: Garbled prefetch syntax cleaned in cell " + str(i))

    # ── FIX 3: Simplify Dense head ────────────────────────────────────────────
    if "Dense(512" in src:
        # Replace the big 512->256->64 block with a simple 128 unit head
        pattern = re.compile(
            r"# Dense head.*?x = layers\.Dropout\(DROPOUT_RATE \* 0\.5\)\(x\)",
            re.DOTALL
        )
        replacement = (
            "# Simplified head for CPU (reduces RAM by ~90%)\n"
            "    x = layers.Dense(128, activation='relu', "
            "kernel_regularizer=keras.regularizers.l2(L2_WEIGHT), name='dense_head_1')(x)\n"
            "    x = layers.BatchNormalization()(x)\n"
            "    x = layers.Dropout(DROPOUT_RATE)(x)"
        )
        new = pattern.sub(replacement, src)
        if new != src:
            src = new
            changed = True
            report.append("FIX 3: Dense head simplified (512->256->64 -> 128) in cell " + str(i))
        else:
            # Fallback: line-by-line approach
            lines = src.split("\n")
            out = []
            skip_until = None
            for j, line in enumerate(lines):
                if "Dense(512" in line:
                    out.append("    # Simplified head for CPU (reduces RAM by ~90%)")
                    out.append("    x = layers.Dense(128, activation='relu', kernel_regularizer=keras.regularizers.l2(L2_WEIGHT), name='dense_head_1')(x)")
                    out.append("    x = layers.BatchNormalization()(x)")
                    out.append("    x = layers.Dropout(DROPOUT_RATE)(x)")
                    skip_until = "Dense(64"
                    continue
                if skip_until and skip_until in line:
                    # skip the Dense(64) line and the Dropout after it
                    skip_until = None
                    # also skip next dropout
                    if j + 1 < len(lines) and "Dropout(DROPOUT_RATE * 0.5)" in lines[j + 1]:
                        lines[j + 1] = "__SKIP__"
                    continue
                if line == "__SKIP__":
                    continue
                # skip Dense(256) block lines
                if any(x in line for x in ["Dense(256", "Dropout(DROPOUT_RATE * 0.8)", "dense_head_2", "dense_head_3"]):
                    continue
                out.append(line)
            new = "\n".join(out)
            if new != src:
                src = new
                changed = True
                report.append("FIX 3 (fallback): Dense head simplified in cell " + str(i))

    if changed:
        cell["source"] = src
        cell["outputs"] = []

with open(NB_PATH, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("\n========================================")
print("  PATCH REPORT")
print("========================================")
for r in report:
    print("  + " + r)
print("========================================")
print("Notebook saved: " + NB_PATH)
