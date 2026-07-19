#!/usr/bin/env python3
"""Gera o .mcaddon do NeuroMobs a partir de dist/.

Uso:  python3 tools/build.py
Saída: build/NeuroMobs_v<versão>.mcaddon  (versão lida do manifest do BP)

Um .mcaddon é só um zip com as pastas dos packs na raiz (o Minecraft
importa BP e RP juntos). Sanidade antes de empacotar: JSONs válidos e
todo import relativo dos scripts resolvendo para um arquivo existente.
"""
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
PACKS = ["NeuroMobs_BP", "NeuroMobs_RP"]


def check_json():
    for dirpath, _, files in os.walk(DIST):
        for f in files:
            if f.endswith(".json"):
                path = os.path.join(dirpath, f)
                try:
                    json.load(open(path, encoding="utf-8"))
                except Exception as e:
                    sys.exit(f"JSON inválido: {path}: {e}")


def check_imports():
    scripts = os.path.join(DIST, "NeuroMobs_BP", "scripts")
    for dirpath, _, files in os.walk(scripts):
        for f in files:
            if not f.endswith(".js"):
                continue
            path = os.path.join(dirpath, f)
            src = open(path, encoding="utf-8").read()
            for spec in re.findall(r'from\s+"(\.\.?/[^"]+)"', src):
                resolved = os.path.normpath(os.path.join(dirpath, spec))
                if not os.path.exists(resolved):
                    sys.exit(f"Import quebrado em {path}: {spec}")


def version():
    manifest = json.load(
        open(os.path.join(DIST, "NeuroMobs_BP", "manifest.json"), encoding="utf-8")
    )
    return ".".join(str(n) for n in manifest["header"]["version"])


def main():
    check_json()
    check_imports()
    ver = version()
    out_dir = os.path.join(ROOT, "build")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"NeuroMobs_v{ver}.mcaddon")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for pack in PACKS:
            base = os.path.join(DIST, pack)
            for dirpath, _, files in os.walk(base):
                for f in sorted(files):
                    full = os.path.join(dirpath, f)
                    arc = os.path.join(pack, os.path.relpath(full, base))
                    z.write(full, arc)
    size = os.path.getsize(out)
    print(f"OK: {out} ({size/1024:.1f} KiB)")


if __name__ == "__main__":
    main()
