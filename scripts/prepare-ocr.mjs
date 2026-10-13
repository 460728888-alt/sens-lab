import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public/ocr");
await mkdir(`${output}/core`, { recursive: true });
await mkdir(`${output}/lang`, { recursive: true });
for (const file of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
]) {
  await copyFile(
    resolve(root, "node_modules/tesseract.js-core", file),
    `${output}/core/${file}`,
  );
}
await copyFile(
  resolve(root, "node_modules/tesseract.js/dist/worker.min.js"),
  `${output}/worker.min.js`,
);
for (const lang of ["chi_sim", "eng"])
  await copyFile(
    resolve(
      root,
      `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
    ),
    `${output}/lang/${lang}.traineddata.gz`,
  );
await copyFile(
  resolve(root, "node_modules/tesseract.js-core/LICENSE"),
  `${output}/LICENSE-tesseract.txt`,
);
await writeFile(
  `${output}/NOTICE.txt`,
  "Local OCR uses Tesseract.js 6.0.1 and Tesseract.js-core (Apache-2.0). Models: @tesseract.js-data/chi_sim and eng 1.0.0, 4.0.0_best_int. No screenshots are sent to a server.\n",
);
console.log("本机截图识别资源已准备");
