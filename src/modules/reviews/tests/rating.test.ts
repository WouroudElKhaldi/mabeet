import { describe, expect, it } from "vitest";
import { averageRating, filledStars } from "../rating";

// What a place's ratings add up to, and how many stars that fills.

describe("the average rating", () => {
  it("is the mean, to one decimal", () => {
    expect(averageRating([5, 4, 5, 5])).toBe(4.8);
    expect(averageRating([4, 5])).toBe(4.5);
  });

  it("rounds, so a long run of ratings still reads as one number", () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([1, 2])).toBe(1.5);
  });

  it("is null until someone has rated, so the page can say so instead of showing 0", () => {
    expect(averageRating([])).toBeNull();
  });

  it("is the rating itself when only one guest has rated", () => {
    expect(averageRating([3])).toBe(3);
  });
});

describe("the stars a rating fills", () => {
  it("rounds to whole stars", () => {
    expect(filledStars(4.8)).toBe(5);
    expect(filledStars(4.4)).toBe(4);
    expect(filledStars(1)).toBe(1);
  });
});
