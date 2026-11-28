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
  c[38] = c[11] / ((c.inductorCurrentDensity === undefined ? 6 : c.inductorCurrentDensity) * (3.14 * c[37] * c[37] / 4));
  c[39] = c[9] / c[25];
  return c;
}

