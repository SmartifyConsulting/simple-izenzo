import { describe, expect, it } from "vitest";
import { groupUsageRows, type AiUsageByTransaction } from "./integrations.functions";

/** Builds a transaction row with one event at the given time — the shape getAiUsageReport returns. */
function row(id: string, iso: string, costUsd = 1): AiUsageByTransaction {
  return {
    transactionId: id,
    reference: `BID${id}`,
    title: `Deal ${id}`,
    costUsd,
    count: 1,
    events: [
      { provider: "openai", operation: "chat", model: "gpt-5-mini", totalTokens: 10, costUsd, createdAt: iso },
    ],
  };
}

/** A date the given number of days before today, so the test does not depend on when it runs. */
function daysAgo(n: number, hour = 12): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe("groupUsageRows", () => {
  it("returns nothing for no rows", () => {
    expect(groupUsageRows([])).toEqual([]);
  });

  it("rolls a row into a day inside a week inside a month", () => {
    const months = groupUsageRows([row("1", daysAgo(0))]);
    expect(months).toHaveLength(1);
    expect(months[0]!.weeks).toHaveLength(1);
    expect(months[0]!.weeks[0]!.days).toHaveLength(1);
  });

  it("labels today's bucket as Today and marks it open-by-default", () => {
    const day = groupUsageRows([row("1", daysAgo(0))])[0]!.weeks[0]!.days[0]!;
    expect(day.label).toBe("Today");
    expect(day.isToday).toBe(true);
  });

  it("does not mark an earlier day as today", () => {
    const days = groupUsageRows([row("1", daysAgo(2)), row("2", daysAgo(3))])[0]!.weeks[0]!.days;
    expect(days.every((d) => !d.isToday)).toBe(true);
    expect(days.every((d) => d.label !== "Today")).toBe(true);
  });

  it("groups rows charged on the same day together", () => {
    const day = groupUsageRows([row("1", daysAgo(0, 9)), row("2", daysAgo(0, 15))])[0]!.weeks[0]!.days[0]!;
    expect(day.rows).toHaveLength(2);
    expect(day.count).toBe(2);
    expect(day.costUsd).toBe(2);
  });

  it("totals each level from its children", () => {
    const month = groupUsageRows([row("1", daysAgo(0)), row("2", daysAgo(1))])[0]!;
    expect(month.count).toBe(2);
    expect(month.costUsd).toBe(2);
    expect(month.weeks.reduce((n, w) => n + w.count, 0)).toBe(2);
  });

  it("puts the current month first and marks it", () => {
    // A row ~70 days back is a different month, whatever today is.
    const months = groupUsageRows([row("old", daysAgo(70)), row("new", daysAgo(0))]);
    expect(months[0]!.isCurrentMonth).toBe(true);
    expect(months[0]!.key > months[1]!.key).toBe(true);
  });

  it("puts the newest week and day first within a month", () => {
    const month = groupUsageRows([row("1", daysAgo(0)), row("2", daysAgo(1))])[0]!;
    expect(month.weeks[0]!.key >= month.weeks[month.weeks.length - 1]!.key).toBe(true);
    const days = month.weeks[0]!.days;
    expect(days[0]!.key >= days[days.length - 1]!.key).toBe(true);
  });

  it("skips a row with no events rather than crashing", () => {
    const empty: AiUsageByTransaction = {
      transactionId: "x",
      reference: null,
      title: null,
      costUsd: 0,
      count: 0,
      events: [],
    };
    expect(groupUsageRows([empty])).toEqual([]);
  });

  it("uses a row's most recent event as its date", () => {
    const spanning: AiUsageByTransaction = {
      transactionId: "1",
      reference: "BID1",
      title: "Deal",
      costUsd: 3,
      count: 2,
      events: [
        { provider: "openai", operation: "a", model: null, totalTokens: null, costUsd: 1, createdAt: daysAgo(40) },
        { provider: "openai", operation: "b", model: null, totalTokens: null, costUsd: 2, createdAt: daysAgo(0) },
      ],
    };
    const months = groupUsageRows([spanning]);
    expect(months[0]!.isCurrentMonth).toBe(true);
    expect(months[0]!.weeks[0]!.days[0]!.isToday).toBe(true);
  });
});
