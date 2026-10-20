---
title: How credit cards work
level: starter
summary: Statement balance, due date, grace period, and minimum payment. Pay the full statement balance on time and a credit card costs you nothing.
tool: card-payoff
---

A **credit card** lets you buy now and pay the card company later. Each card has a **credit limit**, the most you can owe at once. Unlike a debit card, the money is not coming out of your bank account. You are borrowing it, and the bill comes once a month.

Ava got her first card with a $500 limit. Here is her first month.

```ledger Ava's first statement
~ Statement closing date | October 5
~ Payment due date | October 30
Gas | $40.00
+ Groceries | $65.50
+ Concert ticket | $89.99
= Statement balance | $195.49
~ Minimum payment due | $25.00
```

## The parts of a statement

- The **statement balance** is what you owed when the billing month closed.
- The **due date** is the last day to pay without a late fee. By law your statement must be sent at least 21 days before it.
- The **minimum payment** is the smallest amount you can pay and still count as on time.
- The **APR** is the interest rate charged on any balance you leave unpaid.

## The grace period

Most cards have a **grace period**: the time between the statement and the due date. If you pay the full statement balance by the due date, you pay no interest on your purchases at all. That is how people use credit cards for free and build credit at the same time.

If Ava pays $195.49 by October 30, her concert ticket costs exactly $89.99.

```table What Ava's choice costs
| If Ava pays | Interest charged | Effect on her credit |
| Full $195.49 by Oct 30 | $0 | Good: on time, low balance |
| Minimum $25.00 by Oct 30 | Yes, on what is left | On time, but debt grows |
| Nothing, or late | Yes, plus a late fee | A late payment can hurt for years |
```

## What carrying a balance costs

If you pay less than the full statement balance, the card charges interest on what is left, and you usually lose the grace period on new purchases until you pay in full again. At a 24% APR, interest is about 2% a month.

```ledger One month of interest on a carried balance
~ APR | 24%, or 2% a month
Balance carried | $1,000.00
+ Interest for one month | $20.00
= New balance before payment | $1,020.00
```

That $20 buys nothing. It is the cost of not paying in full.

> [!warning] A **cash advance** (taking cash out with a credit card) usually has a fee, a higher APR, and no grace period. Interest starts the same day.

## How to use a card well

Treat your card like a debit card: only charge what you already have in your checking account. Set up autopay for at least the minimum so you are never late, then pay the full statement balance yourself each month. The [CFPB's credit card guide](https://www.consumerfinance.gov/consumer-tools/credit-cards/) explains your rights.

Try the payoff calculator beside this lesson with your own numbers to see what carrying a balance costs.

```takeaways
- Pay the full statement balance by the due date and you pay no interest.
- The minimum payment keeps you on time but leaves a balance that grows with interest.
- At a 24% APR, a carried balance costs about 2% a month.
- Set up autopay so you are never late.
```

```quiz
? Ava's statement balance is $195.49 and the minimum is $25. What should she pay to owe no interest?
- $25.00
+ $195.49
- Whatever she can, any time this month
> Paying the full statement balance by the due date keeps the grace period, so purchases cost no interest.

? What is a grace period?
- Extra time after the due date with no late fee
- A month with no payment required
+ The time between the statement and the due date when purchases charge no interest if paid in full
> If you pay the full statement balance by the due date, the grace period means you never pay interest on purchases.

? Which usually starts charging interest the same day?
+ A cash advance
- A purchase paid in full by the due date
- A refund
> Cash advances usually have no grace period, carry a fee, and often a higher APR.
```
