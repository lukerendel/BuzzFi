import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "examples", "statements");

const chase = [
  ["2025-06-01", "PAYROLL ACME CORP", 420000],
  ["2025-06-02", "RENT PAYMENT", -180000],
  ["2025-06-03", "WHOLE FOODS MARKET 1042", -8420],
  ["2025-06-08", "TRADER JOE'S #512", -4615],
  ["2025-06-12", "STARBUCKS STORE 1182", -645],
  ["2025-06-18", "CHIPOTLE 0921", -1480],
  ["2025-06-21", "SHELL OIL 5748211", -5200],
  ["2025-06-28", "PAYMENT THANK YOU", -50000],
  ["2026-04-01", "PAYROLL ACME CORP", 440000],
  ["2026-04-02", "RENT PAYMENT", -185000],
  ["2026-04-03", "TRANSFER TO VENMO", -20000],
  ["2026-04-06", "WHOLE FOODS MARKET 1042", -9100],
  ["2026-04-11", "KROGER #448", -3210],
  ["2026-04-14", "STARBUCKS STORE 1182", -575],
  ["2026-04-19", "SHELL OIL 5748211", -4800],
  ["2026-04-25", "SPOTIFY USA", -1099],
  ["2026-05-01", "PAYROLL ACME CORP", 440000],
  ["2026-05-02", "RENT PAYMENT", -185000],
  ["2026-05-04", "WHOLE FOODS MARKET 1042", -7640],
  ["2026-05-06", "CON ED BILL", -9400],
  ["2026-05-20", "KROGER #448", -2890],
  ["2026-05-22", "SHELL OIL 5748211", -5100],
  ["2026-05-28", "PAYMENT THANK YOU", -90000],
  ["2026-06-01", "PAYROLL ACME CORP", 450000],
  ["2026-06-02", "RENT PAYMENT", -190000],
  ["2026-06-04", "WHOLE FOODS MARKET 1042", -9640],
  ["2026-06-09", "KROGER #448", -3822],
  ["2026-06-11", "STARBUCKS STORE 1182", -715],
  ["2026-06-20", "NETFLIX.COM", -1599],
  ["2026-06-25", "SHELL OIL 5748211", -4800],
  ["2026-06-27", "PAYMENT THANK YOU", -60000],
  ["2026-08-01", "PAYROLL ACME CORP", 450000],
  ["2026-08-02", "RENT PAYMENT", -190000],
  ["2026-08-15", "WHOLE FOODS MARKET 1042", -8800],
  ["2026-08-18", "TRADER JOE'S #512", -4020],
  ["2026-08-21", "SHELL OIL 5748211", -4700],
  ["2026-09-01", "PAYROLL ACME CORP", 450000],
  ["2026-09-02", "RENT PAYMENT", -190000],
  ["2026-09-08", "WHOLE FOODS MARKET 1042", -10110],
  ["2026-09-14", "STARBUCKS STORE 1182", -690],
  ["2026-09-19", "SHELL OIL 5748211", -5300],
  ["2026-10-01", "PAYROLL ACME CORP", 460000],
  ["2026-10-02", "RENT PAYMENT", -190000],
  ["2026-10-07", "WHOLE FOODS MARKET 1042", -9320],
  ["2026-10-16", "KROGER #448", -2740],
  ["2026-10-24", "SHELL OIL 5748211", -4950],
  ["2026-10-28", "NETFLIX.COM", -1599],
  ["2026-11-01", "PAYROLL ACME CORP", 460000],
  ["2026-11-01", "WHOLE FOODS MARKET 1042", -5420],
];

const amex = [
  ["2026-03-02", "UNITED AIRLINES HOUSTON", -48000],
  ["2026-03-20", "PAYMENT RECEIVED", 50000],
  ["2026-04-09", "CHIPOTLE 0921", -1320],
  ["2026-04-17", "DOORDASH THAI PLACE", -2240],
  ["2026-05-11", "HOTEL LISBON BAIXA", -64000],
  ["2026-05-12", "PASTEIS BELEM", -1860],
  ["2026-05-13", "TIME OUT MARKET", -3420],
  ["2026-05-16", "TABERNA LISBOA", -4120],
  ["2026-06-15", "DOORDASH SWEETGREEN", -2840],
  ["2026-06-22", "CHIPOTLE 0921", -1605],
  ["2026-07-01", "DELTA AIR LINES", -31000],
  ["2026-08-08", "THE STANDARD NYC", -42000],
  ["2026-08-09", "JOE COFFEE NYC", -840],
  ["2026-08-10", "SWEETGREEN NYC", -1680],
  ["2026-08-11", "DIG INN NYC", -2140],
  ["2026-09-03", "SPOTIFY USA", -1199],
  ["2026-10-05", "UBER TRIP", -1840],
  ["2026-10-18", "PAYMENT RECEIVED", 20000],
];

const venmo = [
  ["2026-04-03T09:12:00", "Transfer from bank", 20000],
  ["2026-05-14T21:05:00", "Dinner with Ana", -3200],
  ["2026-06-18T18:40:00", "Concert tickets", -4500],
  ["2026-08-10T22:15:00", "Drinks in NYC", -2400],
  ["2026-10-12T11:02:00", "Alex paid rent split", 75000],
];

function money(cents) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}${(Math.abs(cents) / 100).toFixed(2)}`;
}

function mdy(iso) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${month}/${day}/${year}`;
}

function writeFile(relative, lines) {
  const full = path.join(root, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${lines.join("\n")}\n`);
}

function byMonth(rows) {
  const groups = new Map();
  for (const row of rows) {
    const month = row[0].slice(0, 7);
    const list = groups.get(month) ?? [];
    list.push(row);
    groups.set(month, list);
  }
  return groups;
}

function writeRunning(folder, rows, header, lineFor) {
  let balance = folder === "chase-checking" ? 800000 : 15000;
  const stamped = rows.map((row) => {
    balance += row[2];
    return { row, balance };
  });
  for (const [month, group] of byMonth(stamped.map((item) => item.row))) {
    const lines = [header];
    for (const row of group) {
      const stampedRow = stamped.find((item) => item.row === row);
      lines.push(lineFor(row, stampedRow.balance));
    }
    writeFile(`${folder}/${month}.csv`, lines);
  }
  return stamped;
}

const chaseStamped = writeRunning(
  "chase-checking",
  chase,
  "Transaction Date,Description,Amount,Balance",
  (row, balance) => `${mdy(row[0])},${csvEscape(row[1])},${money(row[2])},${money(balance)}`,
);

const june = fs.readFileSync(path.join(root, "chase-checking/2026-06.csv"));
fs.writeFileSync(path.join(root, "chase-checking/2026-06-duplicate.csv"), june);

const juneRows = chaseStamped.filter((item) => item.row[0].startsWith("2026-06"));
const lastJune = juneRows[juneRows.length - 1].balance;
const farmers = -2200;
const overlap = [
  "Transaction Date,Description,Amount,Balance",
  ...juneRows.map(
    (item) =>
      `${mdy(item.row[0])},${csvEscape(item.row[1])},${money(item.row[2])},${money(item.balance)}`,
  ),
  `06/30/2026,FARMERS MARKET,${money(farmers)},${money(lastJune + farmers)}`,
];
writeFile("chase-checking/2026-06-overlap.csv", overlap);

for (const [month, group] of byMonth(amex)) {
  const lines = ["Date,Description,Amount"];
  for (const row of group) {
    lines.push(`${mdy(row[0])},${csvEscape(row[1])},${money(-row[2])}`);
  }
  writeFile(`amex/${month}.csv`, lines);
}

let venmoBalance = 15000;
const venmoStamped = venmo.map((row) => {
  venmoBalance += row[2];
  return { row, balance: venmoBalance };
});
for (const [month, group] of byMonth(venmoStamped.map((item) => item.row))) {
  const lines = ["Datetime,Note,Amount (total),Balance"];
  for (const row of group) {
    const stamped = venmoStamped.find((item) => item.row === row);
    lines.push(`${row[0]},${csvEscape(row[1])},${money(row[2])},${money(stamped.balance)}`);
  }
  writeFile(`venmo/${month}.csv`, lines);
}

writeFile("citi/2026-11.csv", [
  "Posted,Details,Debit,Credit",
  "11/01/2026,BLUE BOTTLE COFFEE,6.75,",
  "11/01/2026,PAYMENT THANK YOU,,40.00",
]);

function csvEscape(value) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

console.log(`Wrote sample statements to ${root}`);
