---
title: How interest works
level: next-step
summary: Simple interest versus compound interest, and why starting early matters more than starting big.
tool: compound-growth
---

When you keep money in a savings account, the bank pays you **interest**: a percentage of your balance, paid for letting the bank use your money. The **interest rate** is that percentage, given per year.

There are two ways interest can work, and the difference grows bigger every year.

## Simple interest

With **simple interest**, you earn interest only on the money you put in. $1,000 at 4% a year earns $40 every year, no more, no less.

## Compound interest

With **compound interest**, the interest you earn is added to your balance, and then it earns interest too. Your interest earns interest. Most savings accounts compound, often daily or monthly.

```ledger $1,000 at 4% for 3 years, compounded once a year
Starting deposit | $1,000.00
+ Year 1 interest, 4% of $1,000.00 | $40.00
+ Year 2 interest, 4% of $1,040.00 | $41.60
+ Year 3 interest, 4% of $1,081.60 | $43.26
= Balance after 3 years | $1,124.86
# With simple interest, it would be $1,120.00: $40 a year for 3 years.
```

After 3 years the gap is only $4.86. Give it more time and the gap gets large, because each year's interest is figured on a bigger balance.

```table $1,000 at 4%, nothing added
| After | Simple interest | Compound interest, monthly |
| 1 year | $1,040.00 | $1,040.74 |
| 10 years | $1,400.00 | $1,490.83 |
| 30 years | $2,200.00 | $3,313.50 |
```

The compound column assumes 4% a year compounded monthly the whole time. Real savings rates go up and down, so treat these as an illustration of how compounding works, not a promise.

## Time beats size

Because compounding needs time, starting early helps more than starting big. Regular deposits add to it.

```ledger Adding $50 a month for 10 years at 4%
~ Compounded monthly, deposit at the end of each month
Your deposits, $50 × 120 months | $6,000.00
+ Interest earned | $1,362.49
= Balance after 10 years | $7,362.49
```

Of the $7,362.49, $1,362.49 is money you did not have to earn by working. Try the calculator to see what your own amount, rate, and time do.

## Interest works against you, too

Compounding is the same math on a credit card or loan, except you pay it. A balance you do not pay off grows the same way. That is one more reason to save for things instead of borrowing.

Interest you earn counts as income for taxes. Your bank may send you a Form 1099-INT in January showing how much you earned.

```takeaways
- Simple interest is paid only on what you put in; compound interest is paid on interest too.
- Compounding grows slowly at first and faster over time, so starting early matters.
- The same math makes debt grow when you are the one paying interest.
```

```quiz
? $500 earns 4% simple interest for 2 years. How much interest is that?
+ $40
- $40.80
- $20
> Simple interest is 4% of $500, or $20, each year. Two years makes $40. Compound interest would give $40.80.

? Why does compound interest grow faster over time?
- The bank raises your rate every year
+ Each period's interest is added to the balance and then earns interest too
- You are required to add deposits
> Interest on interest makes the balance grow a little faster each year.

? Which helps compound growth the most?
- Starting with a big amount later
- Checking your balance every day
+ Starting early and giving it time
> Compounding depends on time. Even small, early deposits have more years to grow.
```
