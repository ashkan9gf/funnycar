import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import { execSync } from 'child_process';

async function main() {
  const zai = await ZAI.create();

  // کنترل: انگلیسی — ASR باید همان متن را برگرداند
  const en = await zai.audio.tts.create({
    input: 'Hello, this is a voice test',
    voice: 'tongtong',
    speed: 1.0,
    response_format: 'wav',
    stream: false,
  });
  fs.writeFileSync('/home/z/my-project/scripts/tts_test_en.wav', Buffer.from(new Uint8Array(await en.arrayBuffer())));

  // تست عدد فارسی — موتور باید اعداد را هم بخواند
  const faNum = await zai.audio.tts.create({
    input: 'یک، دو، سه، چهار، پنج. فانی کار بهترین بازی است!',
    voice: 'tongtong',
    speed: 1.05,
    response_format: 'wav',
    stream: false,
  });
  fs.writeFileSync('/home/z/my-project/scripts/tts_test_fa2.wav', Buffer.from(new Uint8Array(await faNum.arrayBuffer())));

  for (const f of ['tts_test_en.wav', 'tts_test_fa2.wav']) {
    const d = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 /home/z/my-project/scripts/${f}`).toString().trim();
    console.log(f, 'duration:', d);
  }

  // ASR روی انگلیسی (کنترل صحت پایپ‌لاین)
  const b64 = fs.readFileSync('/home/z/my-project/scripts/tts_test_en.wav').toString('base64');
  const asr = await (zai as any).audio.asr.create({ file_base64: b64 });
  console.log('ASR EN CONTROL:', JSON.stringify(asr.text));
}
main().catch((e) => { console.error(e); process.exit(1); });
