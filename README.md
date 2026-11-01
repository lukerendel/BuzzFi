# BuzzFi

A local personal finance app. Bank, card, and Venmo statements stay in a folder on your computer. BuzzFi reads the CSVs into a local SQLite database so you can categorize purchases, compare spending, budget, and group trips.

Balances are as of the last statement ending balance, or a balance you type in. Nothing here talks to a bank.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On the Import page, **Load sample statements** copies example CSVs into `statements/` and imports the ones with a known layout. The sample Citi file is left unmapped so you can try the column mapper.

Your own files follow the same shape:

```text
statements/
  chase-checking/2026-06.csv
  amex/2026-06.csv
  venmo/2026-06.csv
```

The folder name matches the account’s statement folder. The first time a CSV’s headers are new, map the date, description, and amount (or debit and credit). That mapping is reused. Outflows are stored as negative cents. Check “charges are positive” for card exports that show purchases as positive numbers.

`data/buzzfi.db` and `statements/` are local and gitignored.

## What you can do

- Review new charges with the keyboard: `j`/`k` move, number keys pick a recent category, Enter confirms, `s` skips. Confirming remembers the merchant. You can also save a rule.
- See spending by category for a month, quarter, year, or custom range, compared with the previous period or a year earlier. Food in June 2026 versus June 2025 is one of the sample links.
- Fill a future month’s budget from the average of the three previous months, then edit it.
- Create a trip, start from the charges inside its dates, uncheck the ones that are not travel, and add flights booked earlier. Compare trips by total, per day, and category.
- See cash, Venmo, and credit cards with the date each balance is as of.

Transfers between your own accounts, such as a card payment or a move to Venmo, are kept out of spending once they are categorized as transfers.
