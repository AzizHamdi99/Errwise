import { describe, expect, it } from "vitest";
import { BoundedQueue } from "../src/queue";

describe("BoundedQueue", () => {
  it("drops the oldest items when it is full", () => {
    const queue = new BoundedQueue<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => queue.push(n));
    expect(queue.size).toBe(3);
    expect(queue.dropped).toBe(2);
    expect(queue.take(() => true)).toEqual([3, 4, 5]);
    expect(queue.size).toBe(0);
  });

  it("takes from the front while accept allows it", () => {
    const queue = new BoundedQueue<number>(10);
    [1, 2, 3, 4].forEach((n) => queue.push(n));
    expect(queue.take((_next, taken) => taken.length < 2)).toEqual([1, 2]);
    expect(queue.take((_next, taken) => taken.length < 2)).toEqual([3, 4]);
  });

  it("always takes at least one item", () => {
    const queue = new BoundedQueue<number>(10);
    queue.push(1);
    queue.push(2);
    expect(queue.take(() => false)).toEqual([1]);
    expect(queue.take(() => false)).toEqual([2]);
    expect(queue.take(() => true)).toEqual([]);
  });

  it("puts items back at the front, and trims the oldest if that overflows", () => {
    const queue = new BoundedQueue<number>(3);
    queue.push(4);
    queue.push(5);
    queue.requeueFront([1, 2, 3]);
    expect(queue.dropped).toBe(2);
    expect(queue.take(() => true)).toEqual([3, 4, 5]);
  });

  it("can be cleared", () => {
    const queue = new BoundedQueue<number>(3);
    queue.push(1);
    queue.clear();
    expect(queue.size).toBe(0);
  });
});
