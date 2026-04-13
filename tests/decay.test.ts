import { describe, it, expect } from "vitest";
import { calculateDecayScore } from "../src/database.js";

describe("calculateDecayScore", () => {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  it("should return baseScore for fresh memory with zero access", () => {
    const createdAt = new Date(now).toISOString();
    const score = calculateDecayScore(createdAt, null, 0, 10, now);
    expect(score).toBe(10);
  });

  it("should apply access bonus up to 1.0", () => {
    const createdAt = new Date(now).toISOString();

    // 1 access: 1 * 0.05 = 0.05
    expect(calculateDecayScore(createdAt, null, 1, 0, now)).toBe(0.05);

    // 10 accesses: 10 * 0.05 = 0.5
    expect(calculateDecayScore(createdAt, null, 10, 0, now)).toBe(0.5);

    // 20 accesses: 20 * 0.05 = 1.0
    expect(calculateDecayScore(createdAt, null, 20, 0, now)).toBe(1.0);

    // 30 accesses: capped at 1.0
    expect(calculateDecayScore(createdAt, null, 30, 0, now)).toBe(1.0);
  });

  it("should apply decay penalty up to 5.0", () => {
    const createdAt = new Date(now).toISOString();

    // 1 day old: 1 * 0.1 = 0.1 penalty
    expect(calculateDecayScore(createdAt, null, 0, 0, now + oneDayMs)).toBe(-0.1);

    // 10 days old: 10 * 0.1 = 1.0 penalty
    expect(calculateDecayScore(createdAt, null, 0, 0, now + 10 * oneDayMs)).toBe(-1.0);

    // 50 days old: 50 * 0.1 = 5.0 penalty
    expect(calculateDecayScore(createdAt, null, 0, 0, now + 50 * oneDayMs)).toBe(-5.0);

    // 100 days old: capped at 5.0 penalty
    expect(calculateDecayScore(createdAt, null, 0, 0, now + 100 * oneDayMs)).toBe(-5.0);
  });

  it("should use accessedAt if provided", () => {
    const createdAt = new Date(now - 10 * oneDayMs).toISOString();
    const accessedAt = new Date(now - 2 * oneDayMs).toISOString();

    // Penalty should be based on 2 days, not 10 days
    // 2 days * 0.1 = 0.2 penalty
    expect(calculateDecayScore(createdAt, accessedAt, 0, 0, now)).toBe(-0.2);
  });

  it("should handle rounding to 3 decimal places", () => {
    const createdAt = new Date(now).toISOString();
    // 1 access = 0.05 bonus
    // 1/3 day old = (1/3) * 0.1 penalty = 0.033333... penalty
    // 0.05 - 0.033333... = 0.016666...
    // Rounded to 3 places: 0.017
    const score = calculateDecayScore(createdAt, null, 1, 0, now + oneDayMs / 3);
    expect(score).toBe(0.017);
  });

  it("should handle negative time diff (future dates) by treating as 0 decay", () => {
    const createdAt = new Date(now + oneDayMs).toISOString();
    expect(calculateDecayScore(createdAt, null, 0, 0, now)).toBe(0);
  });

  it("should combine bonus and penalty correctly", () => {
    const createdAt = new Date(now - 10 * oneDayMs).toISOString();
    // 10 days old: 1.0 penalty
    // 10 accesses: 0.5 bonus
    // Result: -0.5
    expect(calculateDecayScore(createdAt, null, 10, 0, now)).toBe(-0.5);
  });
});
