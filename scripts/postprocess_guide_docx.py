#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""postprocess_guide_docx.py — پچ فوتر (ROMAN/arabic) + حذف pgNumType خالی"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

DOCX = Path("/home/z/my-project/download/FunnyCarIR-3D-Models-and-Sounds-Guide-FA.docx")
TMP = DOCX.with_suffix(".tmp.docx")


def main() -> int:
    with zipfile.ZipFile(DOCX, "r") as zin:
        names = zin.namelist()
        data = {n: zin.read(n) for n in names}

    doc_xml = data["word/document.xml"].decode("utf-8")

    # 1) حذف pgNumType خالی (سازگاری WPS)
    doc_xml, n_removed = re.subn(r"<w:pgNumType/>", "", doc_xml)

    # 2) نگاشت بخش‌ها → فوتر: ترتیب sectPrها = [جلد، فهرست(ROMAN)، بدنه(arabic)]
    sect_prs = re.findall(r"<w:sectPr[ >].*?</w:sectPr>", doc_xml, flags=re.S)
    footer_ids: list[str | None] = []
    for s in sect_prs:
        m = re.search(r'<w:footerReference w:type="default" r:id="(rId\d+)"', s)
        footer_ids.append(m.group(1) if m else None)
    print(f"sections={len(sect_prs)} footerRefs={footer_ids} emptyPgNumTypeRemoved={n_removed}")

    rels = data["word/_rels/document.xml.rels"].decode("utf-8")
    rid_to_target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))

    # فوترهای دارای رفرنس: اولین = ROMAN، دومی = arabic
    plan: list[tuple[str, str]] = []
    got = [fid for fid in footer_ids if fid]
    fmts = ["ROMAN", "arabic"]
    for i, fid in enumerate(got[:2]):
        target = rid_to_target.get(fid, "")
        plan.append((f"word/{target.lstrip('/')}", fmts[i]))
    if len(got) < 2:
        print("WARN: expected 2 footer refs, got", got)

    for fname, fmt in plan:
        xml = data[fname].decode("utf-8")
        patched, n = re.subn(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            rf"\1 PAGE \\* {fmt} \\* MERGEFORMAT \2",
            xml,
        )
        data[fname] = patched.encode("utf-8")
        print(f"patched {fname} → PAGE \\* {fmt} ({n} field)")

    data["word/document.xml"] = doc_xml.encode("utf-8")

    with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
    shutil.move(TMP, DOCX)
    print("OK:", DOCX.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
