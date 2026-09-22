import { useState } from "react";

import { DatePicker } from "@/components/ui/DatePicker";
import { fromIso, monthGrid, toIso } from "@/lib/utils/calendar";
import { fireEvent, render, screen } from "@/test/test-utils";

function Harness({ initial = "", ...rest }: { initial?: string; min?: string }) {
  const [value, setValue] = useState(initial);
  return <DatePicker label="Placed from" value={value} onChange={setValue} {...rest} />;
}

const open = () => fireEvent.click(screen.getByRole("button", { name: /Placed from/ }));

describe("DatePicker", () => {
  it("shows the date in the shop's format, not the browser's", () => {
    render(<Harness initial="2026-09-20" />);

    expect(screen.getByRole("button", { name: /Placed from/ })).toHaveTextContent(
      "20 Sept 2026",
    );
  });

  it("picks a day and closes", () => {
    render(<Harness initial="2026-09-20" />);
    open();

    fireEvent.click(screen.getByRole("gridcell", { name: /^Friday, 4 September 2026$/ }));

    expect(screen.getByRole("button", { name: /Placed from/ })).toHaveTextContent(
      "04 Sept 2026",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("will not select a day before the minimum", () => {
    render(<Harness initial="2026-09-20" min="2026-09-10" />);
    open();

    const blocked = screen.getByRole("gridcell", {
      name: /^Friday, 4 September 2026$/,
    });

    expect(blocked).toBeDisabled();
  });

  it("moves a week with the arrow keys without committing a date", () => {
    render(<Harness initial="2026-09-20" />);
    open();

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown" });

    // The trigger still reads the old date: moving is not choosing.
    expect(screen.getByRole("button", { name: /Placed from/ })).toHaveTextContent(
      "20 Sept 2026",
    );
    expect(
      screen.getByRole("gridcell", { name: /^Sunday, 27 September 2026$/ }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("closes on Escape", () => {
    render(<Harness initial="2026-09-20" />);
    open();

    fireEvent.keyDown(screen.getByRole("grid"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clears the value", () => {
    render(<Harness initial="2026-09-20" />);
    open();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("button", { name: "Placed from" })).toHaveTextContent(
      "Pick a date",
    );
  });
});

describe("calendar maths", () => {
  it("round-trips a date without the UTC shift that breaks new Date(iso)", () => {
    // The bug this guards: new Date("2026-09-20") is midnight UTC, which is the
    // 19th anywhere west of Greenwich.
    expect(toIso(fromIso("2026-09-20")!)).toBe("2026-09-20");
  });

  it("rejects a day that does not exist", () => {
    expect(fromIso("2026-02-31")).toBeNull();
    expect(fromIso("not-a-date")).toBeNull();
    expect(fromIso("")).toBeNull();
  });

  it("always lays out six weeks, starting on a Monday", () => {
    const grid = monthGrid(new Date(2026, 8, 1));

    expect(grid).toHaveLength(42);
    expect(grid[0]!.getDay()).toBe(1);
  });
});
