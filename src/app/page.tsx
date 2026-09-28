import GameShell from "@/components/game/GameShell";

/**
 * page.tsx — تنها route بازی (پوسته رابط)
 * منطق بازی در src/game است و اینجا فقط mount می‌شود.
 */
export default function Home() {
  return <GameShell />;
}
