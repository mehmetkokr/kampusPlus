// Uygulama simgelerini (src/components/icons.jsx) üretir.
// Kaynak: Phosphor Icons (MIT). Paket her simgenin altı ağırlığını birden
// getirdiği için yalnızca kullanılan iki ağırlık (duotone ve fill) SVG
// içeriği olarak dosyaya yazılır; çalışma anında paket gerekmez.
// Kullanım: node scripts/gen-icons.mjs  (eşleme: scripts/icon-map.txt,
// her satır "eskiAd PhosphorAdı").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as P from '@phosphor-icons/react';

const dir = path.dirname(fileURLToPath(import.meta.url));
const rows = fs
  .readFileSync(path.join(dir, 'icon-map.txt'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((l) => l.trim().split(/\s+/));

const inner = (Comp, weight) =>
  renderToStaticMarkup(React.createElement(Comp, { weight })).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

const shapes = {};
for (const [, ph] of rows) {
  if (shapes[ph]) continue;
  const Comp = P[`${ph}Icon`];
  if (!Comp) throw new Error(`Phosphor'da yok: ${ph}`);
  shapes[ph] = [inner(Comp, 'duotone'), inner(Comp, 'fill')];
}

const out = `// Bu dosya scripts/gen-icons.mjs ile üretilir; elle düzenleme.
// Uygulamanın simge seti: Phosphor Icons (MIT), çift tonlu. Bileşenler eski
// adlarla (Heart, Settings, ...) kullanılmaya devam eder.
//
// Ağırlık: varsayılan çift ton (çizgi + yarı saydam dolgu). fill="currentColor"
// ya da weight="fill" verilirse dolu çizilir.
import React, { forwardRef } from 'react';

const SHAPES = ${JSON.stringify(shapes, null, 0).replace(/\],"/g, '],\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, '\n}')};

function icon(shape, name) {
  const Icon = forwardRef(function Icon(
    { size = 24, color = 'currentColor', fill, weight, strokeWidth: _s, absoluteStrokeWidth: _a, ...rest },
    ref
  ) {
    const solid = weight === 'fill' || (weight === undefined && fill !== undefined && fill !== 'none');
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        width={size}
        height={size}
        fill={color}
        aria-hidden={rest['aria-label'] ? undefined : true}
        focusable="false"
        {...rest}
        // Sabit, bu dosyada üretilmiş SVG şekilleri (kullanıcı verisi değil)
        dangerouslySetInnerHTML={{ __html: SHAPES[shape][solid ? 1 : 0] }}
      />
    );
  });
  Icon.displayName = name;
  return Icon;
}

${rows.map(([name, ph]) => `export const ${name} = icon('${ph}', '${name}');`).join('\n')}
`;
fs.writeFileSync(path.join(dir, '..', 'src', 'components', 'icons.jsx'), out);
console.log(`${rows.length} simge, ${Object.keys(shapes).length} şekil, ${(out.length / 1024).toFixed(0)} KB`);
