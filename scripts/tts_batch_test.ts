import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import { execSync } from 'child_process';

const OUT = '/home/z/my-project/scripts/tts_batch';
fs.mkdirSync(OUT, { recursive: true });

const tests: Array<{ name: string; voice: string; text: string; speed: number }> = [
  { name: 'a_tongtong_short', voice: 'tongtong', text: 'فانی کار بهترین بازی است', speed: 1.0 },
  { name: 'b_chuichui_short', voice: 'chuichui', text: 'فانی کار بهترین بازی است', speed: 1.0 },
  { name: 'c_xiaochen_short', voice: 'xiaochen', text: 'فانی کار بهترین بازی است', speed: 1.0 },
  { name: 'd_tongtong_sentence', voice: 'tongtong', text: 'جدول یک صفر ما، بیمه خوشحال شد تو ناراحت نشو', speed: 1.0 },
  { name: 'e_douji_sentence', voice: 'douji', text: 'جدول یک صفر ما، بیمه خوشحال شد تو ناراحت نشو', speed: 1.0 },
  { name: 'f_kazi_numbers', voice: 'kazi', text: 'یک دو سه چهار پنج', speed: 1.0 },
];

async function main() {
  const zai = await ZAI.create();
  for (const t of tests) {
    try {
      const res = await zai.audio.tts.create({
        input: t.text, voice: t.voice, speed: t.speed, response_format: 'wav', stream: false,
      });
      const p = `${OUT}/${t.name}.wav`;
      fs.writeFileSync(p, Buffer.from(new Uint8Array(await res.arrayBuffer())));
      const d = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${p}`).toString().trim());
      const cps = (t.text.length / d).toFixed(1);
      console.log(`${t.name}: ${d.toFixed(2)}s | ${cps} chars/s | ${t.text.length} chars`);
    } catch (e) {
      console.log(`${t.name}: ERROR ${e.message}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
