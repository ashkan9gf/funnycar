import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * api/files — مرور و دانلود امن فایل‌های پروژه برای «کنسول تست فانی‌کار»
 * ============================================================
 * - op=list  ?root=src&sub=game  → لیست پوشه با حجم
 * - op=get   ?root=models&sub=vehicles/player.glb[&dl=1] → محتوای فایل
 * - ریشه‌ها سفید‌لیست شده‌اند و خروج path.resolve داخل همان ریشه محدود می‌شود
 */

export const dynamic = "force-dynamic";

const ROOTS: Record<string, string> = {
  models: "/home/z/my-project/public/assets/models",
  src: "/home/z/my-project/src",
  docs: "/home/z/my-project/docs",
  android: "/home/z/my-project/android-build",
  download: "/home/z/my-project/download",
};

const MIME: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".tsx": "text/plain; charset=utf-8",
  ".js": "text/plain; charset=utf-8",
  ".mjs": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".css": "text/plain; charset=utf-8",
  ".sh": "text/plain; charset=utf-8",
  ".java": "text/plain; charset=utf-8",
  ".xml": "text/plain; charset=utf-8",
  ".prisma": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".apk": "application/vnd.android.package-archive",
  ".zip": "application/zip",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff2": "font/woff2",
};

function safeJoin(base: string, sub: string): string | null {
  const abs = path.resolve(base, sub || ".");
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const op = sp.get("op") ?? "list";
  const rootKey = sp.get("root") ?? "models";
  const base = ROOTS[rootKey];
  if (!base) {
    return NextResponse.json({ error: "ریشه نامعتبر است" }, { status: 400 });
  }
  const abs = safeJoin(base, sp.get("sub") ?? "");
  if (!abs) {
    return NextResponse.json({ error: "مسیر نامعتبر است" }, { status: 400 });
  }

  if (op === "list") {
    try {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const out: { name: string; dir: boolean; size: number }[] = [];
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        try {
          const st = await fs.stat(path.join(abs, e.name));
          out.push({ name: e.name, dir: e.isDirectory(), size: st.size });
        } catch {
          /* فایل ناپدیدشده — رد شو */
        }
      }
      out.sort((a, b) =>
        a.dir === b.dir ? a.name.localeCompare(b.name, "fa") : a.dir ? -1 : 1,
      );
      return NextResponse.json(
        { root: rootKey, sub: sp.get("sub") ?? "", entries: out },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return NextResponse.json({ error: "پوشه خوانده نشد" }, { status: 404 });
    }
  }

  if (op === "get") {
    try {
      const st = await fs.stat(abs);
      if (!st.isFile()) {
        return NextResponse.json({ error: "این یک فایل نیست" }, { status: 400 });
      }
      const buf = await fs.readFile(abs);
      const ext = path.extname(abs).toLowerCase();
      const dl = sp.get("dl") === "1";
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Content-Length": String(st.size),
          "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}`,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "op نامعتبر" }, { status: 400 });
}
