// Generates the binary test fixtures used by tests/lib/extract-document.test.ts.
// Zero dependencies on purpose (we don't want a PDF/DOCX *writer* in the tree just
// to make fixtures). Run once with `node tests/fixtures/generate.mjs`; the produced
// sample.pdf / sample.docx are committed alongside this script.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Tokens the test asserts on, so a real extraction round-trip is proven.
const PDF_TOKEN_ONE = "STAGEFIXTUREPAGEONE";
const PDF_TOKEN_TWO = "STAGEFIXTUREPAGETWO";
const DOCX_TOKEN = "STAGEFIXTUREDOCX";

// ---------------------------------------------------------------------------
// Minimal, valid multi-page PDF. Byte offsets for the xref table are computed
// from the assembled buffer so the file is well-formed (no reliance on pdf.js
// recovery).
// ---------------------------------------------------------------------------
// Each page is a list of lines, drawn top-down, so a fixture can carry a table.
function buildPdf(pages) {
  const content = (lines) =>
    lines.map((line, i) => `BT /F1 12 Tf 72 ${700 - i * 20} Td (${line}) Tj ET`).join("\n");
  const font = 3 + pages.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    ...pages.flatMap((lines, i) => {
      const c = content(lines);
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`,
        `<< /Length ${c.length} >>\nstream\n${c}\nendstream`,
      ];
    }),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets[i] = body.length;
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, "latin1");
}

// ---------------------------------------------------------------------------
// Minimal DOCX = a ZIP (STORED / no compression) of the three OOXML parts
// mammoth needs. CRC32 + zip headers are built by hand to stay dependency-free.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildDocx() {
  return zipParts([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Beoordelingsfixture ${DOCX_TOKEN} regel een.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tweede alinea met inhoud.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
    },
  ]);
}

/** A STORED zip of `{ name, data }` parts (data: string or Buffer). */
function zipParts(parts) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const part of parts) {
    const nameBuf = Buffer.from(part.name, "utf8");
    const dataBuf = Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data, "utf8");
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method 0 = stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18); // compressed size
    local.writeUInt32LE(dataBuf.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, nameBuf, dataBuf);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central dir signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10); // method stored
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + dataBuf.length;
  }

  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(parts.length, 8);
  eocd.writeUInt16LE(parts.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

// A valid one-page PDF with no text show operators — stands in for a scanned /
// image-only report, where extraction yields no text and we must tell the teacher
// to paste instead.
function buildEmptyPdf() {
  const content = "q 1 0 0 1 0 0 cm Q"; // graphics state ops only, no text
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets[i] = body.length;
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, "latin1");
}

// ---------------------------------------------------------------------------
// Fixtures with images (stage-assessment figures): a DOCX with a figure, a tiny
// icon and an EMF drawing, and a PDF with a figure page and a logo-only page.
// ---------------------------------------------------------------------------
const PNG_CRC = (type, data) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])), 0);
  return b;
};

/** A solid-colour RGB PNG of `width` × `height`, built with node:zlib only. */
function buildPng(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, PNG_CRC(type, data)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildDocxWithImages() {
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const drawing = (rid, name) => `<w:p><w:r><w:drawing>
      <wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="1905000" cy="1428750"/>
        <wp:docPr id="1" name="${name}" descr="${name}"/>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>
              <pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing></w:r></w:p>`;
  // A Word chart or SmartArt diagram: drawn by Word itself, no image inside.
  const officeDrawing = (uri, content) => `<w:p><w:r><w:drawing>
      <wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="5486400" cy="3200400"/>
        <wp:docPr id="2" name="Grafiek"/>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="${uri}">${content}</a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing></w:r></w:p>`;
  return zipParts([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="emf" ContentType="image/x-emf"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: "word/_rels/document.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure.png"/>
  <Relationship Id="rIdIcon" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/icon.png"/>
  <Relationship Id="rIdEmf" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/diagram.emf"/>
</Relationships>`,
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="${R}">
  <w:body>
    <w:p><w:r><w:t>Verslag met figuren ${DOCX_TOKEN}.</w:t></w:r></w:p>
    ${drawing("rIdIcon", "Pictogram")}
    ${drawing("rIdFig", "Architectuurschets")}
    ${drawing("rIdEmf", "Visio-tekening")}
    ${officeDrawing("http://schemas.openxmlformats.org/drawingml/2006/chart", '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart"/>')}
    ${officeDrawing("http://schemas.openxmlformats.org/drawingml/2006/diagram", '<dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rIdDm" r:lo="rIdLo" r:qs="rIdQs" r:cs="rIdCs"/>')}
  </w:body>
</w:document>`,
    },
    { name: "word/media/figure.png", data: buildPng(200, 150, [40, 120, 200]) },
    { name: "word/media/icon.png", data: buildPng(16, 16, [200, 40, 40]) },
    { name: "word/media/diagram.emf", data: Buffer.from("not really an emf", "latin1") },
  ]);
}

/**
 * A three-page PDF: page 1 text only, page 2 a figure (300 × 200 pt image), page 3
 * only a small logo (40 × 20 pt). Only page 2 is worth offering as a figure.
 */
function buildPdfWithImages() {
  return buildPdfWithImagePages([
    "BT /F1 12 Tf 72 700 Td (Inleiding zonder figuur) Tj ET",
    "BT /F1 12 Tf 72 700 Td (Figuur 1 Architectuur) Tj ET\nq 300 0 0 200 72 400 cm /Im1 Do Q",
    "q 40 0 0 20 500 750 cm /Im1 Do Q\nBT /F1 12 Tf 72 700 Td (Alleen een logo) Tj ET",
  ]);
}

/**
 * A four-page report full of images that are not figures, as a real thesis PDF has:
 * - every page carries the same 200 × 80 pt header banner at the same spot;
 * - page 1 is a scanned page: one image covering the whole page, with text over it;
 * - page 2 is plain text;
 * - page 3 has one figure (300 × 200 pt at 72, 300) drawn as two stacked tiles;
 * - page 4 has two separate figures (200 × 150 pt at 72, 100 and at 340, 450).
 * Only the figures on pages 3 and 4 are worth offering, each cut out on its own.
 */
function buildPdfWithFigureNoise() {
  const banner = "q 200 0 0 80 206 690 cm /Im1 Do Q";
  const text = (t) => `BT /F1 12 Tf 72 650 Td (${t}) Tj ET`;
  return buildPdfWithImagePages([
    `q 612 0 0 792 0 0 cm /Im1 Do Q\n${banner}\n${text("Gescande pagina")}`,
    `${banner}\n${text("Alleen tekst")}`,
    `${banner}\n${text("Figuur 1")}\nq 300 0 0 100 72 300 cm /Im1 Do Q\nq 300 0 0 100 72 400 cm /Im1 Do Q`,
    `${banner}\n${text("Figuur 2 en 3")}\nq 200 0 0 150 72 100 cm /Im1 Do Q\nq 200 0 0 150 340 450 cm /Im1 Do Q`,
  ]);
}

/**
 * A three-page report whose figures are vector drawings, as Word, Excel, PowerPoint,
 * draw.io and Visio export them: paths and text, no image.
 * - every page: a header rule and a vector logo (90 × 70 pt) at the same spot;
 * - page 1: a bar chart (axes, four bars, labels below the axis) at 100–400 × 462–650,
 *   and a table drawn as grid lines with text in the cells;
 * - page 2: a border around the whole page, a framed text box, and a flowchart of three
 *   boxes joined by lines at 72–472 × 300–350;
 * - page 3: a line chart (axes, one polyline, an axis label) at 100–400 × 185–400.
 * Only the three charts and diagrams are worth offering.
 */
function buildPdfWithVectorFigures() {
  const text = (x, y, t) => `BT /F1 10 Tf ${x} ${y} Td (${t}) Tj ET`;
  const furniture = [
    "0.5 w 72 760 m 540 760 l S",
    text(72, 765, "Stageverslag"),
    "q 0 0 1 rg 470 680 90 70 re f 1 1 1 rg 515 715 m 535 715 535 735 515 735 c 495 735 495 715 515 715 c f Q",
  ].join("\n");
  const barChart = [
    "1 w 100 480 m 100 650 l S 100 480 m 400 480 l S",
    "q 0 0 1 rg 120 480 40 100 re f 190 480 40 150 re f 260 480 40 60 re f 330 480 40 120 re f Q",
    ...["Q1", "Q2", "Q3", "Q4"].map((q, i) => text(132 + i * 70, 464, q)),
    text(200, 640, "Omzet"),
  ];
  const table = [
    ...[300, 320, 340, 360].map((y) => `0.5 w 72 ${y} m 400 ${y} l S`),
    ...[72, 200, 400].map((x) => `0.5 w ${x} 300 m ${x} 360 l S`),
    text(80, 345, "Week"),
    text(210, 345, "Taak"),
    text(80, 325, "1"),
    text(210, 325, "Programmeren"),
    text(80, 305, "2"),
    text(210, 305, "Testen"),
  ];
  const flowchart = [
    ...[72, 222, 372].map((x) => `1 w ${x} 300 100 50 re S`),
    "172 325 m 222 325 l S 322 325 m 372 325 l S",
    text(100, 322, "Client"),
    text(255, 322, "API"),
    text(395, 322, "Database"),
  ];
  const lineChart = [
    "1 w 100 200 m 100 400 l S 100 200 m 400 200 l S",
    "1 0 0 RG 100 250 m 160 300 l 220 280 l 280 350 l 340 330 l 400 380 l S",
    text(230, 187, "Tijd"),
  ];
  return buildPdfWithImagePages([
    [furniture, text(72, 720, "Inleiding van het verslag"), ...barChart, ...table].join("\n"),
    [
      furniture,
      "1 w 20 20 572 752 re S",
      "1 w 72 600 300 80 re S",
      text(80, 640, "Let op de deadline van week 6"),
      ...flowchart,
    ].join("\n"),
    [furniture, ...lineChart, text(72, 150, "Conclusie")].join("\n"),
  ]);
}

/** A PDF whose pages draw text (/F1) and one 4 × 4 grey image (/Im1) as their content says. */
function buildPdfWithImagePages(pageContents) {
  const pixels = Buffer.alloc(4 * 4 * 3, 0x80);
  const n = pageContents.length;
  const font = 3 + n * 2;
  const image = font + 1;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageContents.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${n} >>`,
    ...pageContents.flatMap((c, i) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im1 ${image} 0 R >> >> >>`,
      `<< /Length ${c.length} >>\nstream\n${c}\nendstream`,
    ]),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n${pixels.toString("latin1")}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets[i] = body.length;
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, "latin1");
}

writeFileSync(
  join(here, "sample.pdf"),
  buildPdf([[`Pagina tekst ${PDF_TOKEN_ONE}`], [`Pagina tekst ${PDF_TOKEN_TWO}`]]),
);
// An OER-like course table: rows must stay rows after extraction.
writeFileSync(
  join(here, "sample-table.pdf"),
  buildPdf([
    [
      "Code Naam EC Toetscode Toetswijze Weging",
      "INHELWO Hello World 10 TOETS-01 Schriftelijk 1",
      "INDATFI Data First 10 TOETS-01 Andere wijze 1",
    ],
    ["Leeruitkomst 1 De student ontwerpt een webapplicatie."],
  ]),
);
writeFileSync(join(here, "sample.docx"), buildDocx());
writeFileSync(join(here, "sample-empty.pdf"), buildEmptyPdf());
writeFileSync(join(here, "sample-images.docx"), buildDocxWithImages());
writeFileSync(join(here, "sample-images.pdf"), buildPdfWithImages());
writeFileSync(join(here, "sample-figure-noise.pdf"), buildPdfWithFigureNoise());
writeFileSync(join(here, "sample-vector-figures.pdf"), buildPdfWithVectorFigures());
console.log("Wrote sample.pdf, sample.docx, sample-empty.pdf and the sample-images fixtures");
console.log({ PDF_TOKEN_ONE, PDF_TOKEN_TWO, DOCX_TOKEN });
