import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTextLayer } from '../assets/textlayer-check.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesDir = `${root}/tests/fixtures`;

function pdfStringLiteral(value) {
  return value.replace(/([\\()])/g, '\\$1');
}

function makePdf({ text }) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  ];
  const resources = text ? '/Resources << /Font << /F1 4 0 R >> >> ' : '';
  objects.push(`<< /Type /Page /Parent 2 0 R ${resources}/MediaBox [0 0 612 792] /Contents ${text ? 5 : 4} 0 R >>`);
  if (text) objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const stream = text
    ? `BT /F1 18 Tf 72 720 Td (${pdfStringLiteral(text)}) Tj ET`
    : '0.85 g 72 612 468 96 re f 0.2 g 72 580 360 12 re f';
  objects.push(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return body;
}

async function writeFixtures() {
  await mkdir(fixturesDir, { recursive: true });
  await writeFile(`${fixturesDir}/text.pdf`, makePdf({
    text: 'This PDF has a real searchable text layer for automated extraction checks.',
  }));
  await writeFile(`${fixturesDir}/scan.pdf`, makePdf({ text: '' }));
}

async function checkFixture(name, expectedOk) {
  const bytes = await readFile(`${fixturesDir}/${name}`);
  const result = await checkTextLayer(new Blob([bytes]), { maxPages: 5, minChars: 40 });
  console.log(`${name}: ${JSON.stringify(result)}`);
  if (result.ok !== expectedOk) {
    throw new Error(`${name} expected ok=${expectedOk}, got ok=${result.ok}`);
  }
}

await writeFixtures();
await checkFixture('text.pdf', true);
await checkFixture('scan.pdf', false);
