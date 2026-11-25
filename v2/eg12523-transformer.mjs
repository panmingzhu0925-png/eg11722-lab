// Workbook: 变压器 sheet, column C. Values use the units shown in the original table.
export function calculate(input) {
  const c = {...input};
  c[8] = c[6] * Math.sqrt(2) * 0.9;
  c[9] = c[7] * Math.sqrt(2);
  c[17] = c[8] * c[16] * c[13] / (c[10] + c[14]);
  c[19] = c[10] * c[11] * 10 / (c[13] * 0.3 * 600 * c[18] * c[16] * c[12]);
  c[21] = c[8] * c[16] * 1000 / (c[18] * c[20] * c[12]);
  c[23] = c[22] / c[17];
  c[25] = c[22] / c[24];
  c[27] = (c[10] + c[14]) * c[25] / c[8] / c[13];
  c[26] = (c[8] / c[25] - c[10] - c[14]) * c[27] * 1000 / (c[12] * c[15] * c[11]);
  c[29] = c[11] * Math.sqrt(c[27] * (1 + c[15] * c[15] / 12));
  c[28] = c[29] / c[25];
  c[31] = c[28] / c[30];
  c[33] = c[31] / (3.14 * c[32] * c[32] / 4);
  c[34] = c[29] / c[30];
  c[36] = c[34] / (3.14 * c[35] * c[35] / 4);
  c[38] = c[11] / (6 * (3.14 * c[37] * c[37] / 4));
  c[39] = c[9] / c[25];
  return c;
}

if (typeof document !== 'undefined') {
  setup().catch(() => {
    document.querySelector('#status').textContent = '计算表加载失败，请刷新页面重试。';
  });
}

async function setup() {
  const response = await fetch('./eg12523-transformer-data.json');
  if (!response.ok) throw Error('Workbook data unavailable');
  const {rows, cores} = await response.json();
  const table = document.querySelector('#design-rows');
  const status = document.querySelector('#status');
  const inputs = new Map();
  const outputs = new Map();
  const fractionRows = new Set([13, 15, 16, 27]);
  const integerRows = new Set([22, 24]);
  const calculated = calculate({});
  const format = new Intl.NumberFormat('zh-CN', {maximumSignificantDigits: 6});

  function recalculate() {
    const input = Object.fromEntries([...inputs].map(([row, field]) => {
      const number = field.valueAsNumber;
      const valid = field.validity.valid && Number.isFinite(number) &&
        (number > 0 || (row === 14 && number === 0));
      field.setAttribute('aria-invalid', String(!valid));
      return [row, valid ? number / (fractionRows.has(row) ? 100 : 1) : NaN];
    }));
    const results = calculate(input);
    for (const [row, output] of outputs) {
      const value = results[row] * (fractionRows.has(row) ? 100 : 1);
      output.value = Number.isFinite(value) ? format.format(value) : '—';
    }
    const messages = [];
    if (Object.values(input).some(Number.isNaN)) messages.push('请输入有效数值，相关结果将在输入有效后显示。');
    if (input[6] > input[7]) messages.push('最低交流输入电压高于最高交流输入电压。');
    if (results[27] > input[16]) messages.push('实际最大占空比超过选定上限。');
    if (results[26] < 0) messages.push('当前匝比和输入电压无法满足设定输出。');
    status.textContent = messages.join(' ');
  }

  for (const row of rows) {
    const tr = table.insertRow();
    tr.insertCell().textContent = row.symbol ?? '';
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = row.label;
    tr.append(label);
    const value = tr.insertCell();
    if (Object.hasOwn(calculated, row.row)) {
      const output = document.createElement('output');
      output.id = 'result-' + row.row;
      outputs.set(row.row, output);
      value.append(output);
    } else {
      const field = document.createElement('input');
      field.type = 'number';
      field.id = 'input-' + row.row;
      field.required = true;
      field.min = integerRows.has(row.row) ? '1' : '0';
      field.step = integerRows.has(row.row) ? '1' : 'any';
      if (row.row === 13 || row.row === 16) field.max = '100';
      field.setAttribute('aria-label', row.label);
      field.addEventListener('input', recalculate);
      inputs.set(row.row, field);
      value.append(field);
    }
    tr.insertCell().textContent = fractionRows.has(row.row) ? '%' : (row.unit === 'T' ? '匝' : row.unit ?? '');
    tr.insertCell().textContent = row.note ?? '';
  }

  function reset() {
    for (const {row, initial} of rows) {
      if (inputs.has(row)) inputs.get(row).value = fractionRows.has(row) ? Number((initial * 100).toPrecision(12)) : initial;
    }
    recalculate();
  }
  document.querySelector('#reset').addEventListener('click', reset);
  reset();

  const catalog = document.querySelector('#core-rows');
  const filters = [];
  let section = '';
  for (const cells of cores) {
    if (!cells[1]) {
      section = cells[0];
      continue;
    }
    const tr = catalog.insertRow();
    for (const value of cells) tr.insertCell().textContent = typeof value === 'number' ? format.format(value) : value?.trim() ?? '';
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = '填入 Ae';
    action.setAttribute('aria-label', '填入 ' + cells[0].trim() + ' 的 Ae');
    action.disabled = !(Number(cells[4]) > 0);
    action.addEventListener('click', () => {
      const ae = inputs.get(20);
      ae.value = cells[4];
      recalculate();
      ae.focus();
    });
    tr.insertCell().append(action);
    filters.push({tr, text: [section, ...cells].join(' ').toLowerCase()});
  }
  const search = document.querySelector('#core-search');
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let matches = 0;
    for (const {tr, text} of filters) {
      tr.hidden = !text.includes(query);
      if (!tr.hidden) matches++;
    }
    document.querySelector('#core-empty').hidden = matches > 0;
  });
}
