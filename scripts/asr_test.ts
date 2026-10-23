import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function main() {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync('/home/z/my-project/scripts/tts_test_fa.wav').toString('base64');
  try {
    const res = await (zai as any).audio.asr.create({ file_base64: b64 });
    console.log('ASR RESULT:', JSON.stringify(res));
  } catch (e: unknown) {
    console.log('ASR ERROR:', e instanceof Error ? e.message : String(e));
  }
}
main();
