#!/usr/bin/env python3
"""Fix horn section: tap=preview sound, buy/select=inner chip (line-precise)."""
path = "/home/z/my-project/src/components/game/GameShell.tsx"
lines = open(path, encoding="utf-8").read().split("\n")

# پیدا کردن بلوک بوق‌ها بر اساس انکرهای یگانه
start = end = None
for i, l in enumerate(lines):
    if "بوق‌ها (فاز ۷) — امضای صوتی راننده" in l:
        start = i
    if start is not None and l.strip().startswith("{/* جمله طنز بوق انتخاب‌شده */}"):
        end = i
        break
assert start is not None and end is not None, f"anchors not found: {start},{end}"

new_block = '''            {/* بوق‌ها — بزن بشنوی، بعد بخر! (v0.2.39: کلیک = صدا، خرید = دکمه) */}
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white/80">
              <Megaphone className="h-4 w-4" /> بوق‌ها — روی هر بوق بزن تا صداش رو بشنوی، بعد خرید کن:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {garage.horns.map((h) => (
                <div
                  key={h.id}
                  role="button"
                  tabIndex={0}
                  title={`${h.desc} — بزن بشنوی`}
                  className={`fc-btn flex cursor-pointer items-center gap-2 rounded-2xl p-2.5 text-right ${
                    h.selected ? "bg-[#8AC926]" : previewHornId === h.id ? "bg-[#F2B705]" : "bg-[#FFF9EC]"
                  }`}
                  onClick={() => {
                    setPreviewHornId(h.id);
                    gameRef.current?.previewHorn(h.id);
                  }}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      h.selected ? "bg-[#3a2e2a] text-[#8AC926]" : "bg-[#FFF3D6] text-[#3a2e2a]"
                    }`}
                  >
                    {HORN_ICON[h.id] ?? <Megaphone className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-[#3a2e2a]">
                      {h.name}
                    </span>
                    <span className="block text-[10px] font-bold leading-3.5 text-[#3a2e2a]/60">
                      {h.owned ? (h.selected ? "وصل شد ✓" : "خریده‌شده") : `${fa(h.price)} سکه`}
                    </span>
                    {!h.selected && (
                      <button
                        type="button"
                        className={`fc-btn mt-1 w-full rounded-lg py-1 text-[10px] font-extrabold ${
                          h.owned ? "bg-[#8AC926] text-[#3a2e2a]" : "bg-[#FFF3D6] text-[#3a2e2a]"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          purchase(() => h.owned ? gameRef.current!.selectHorn(h.id) : gameRef.current!.buyHorn(h.id));
                        }}
                      >
                        {h.owned ? "وصل کن ✓" : "خرید"}
                      </button>
                    )}
                  </span>
                  {!h.owned && <Lock className="h-4 w-4 shrink-0 text-[#3a2e2a]/40" />}
                </div>
              ))}
            </div>'''

lines[start:end] = new_block.split("\n")
open(path, "w", encoding="utf-8").write("\n".join(lines))
print(f"replaced lines {start+1}..{end} with {len(new_block.split(chr(10)))} lines")
