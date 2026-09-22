import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { MAX_QUANTITY_PER_LINE } from "@/lib/features/cart/cartSlice";
import { fireEvent, render, screen } from "@/test/test-utils";

describe("QuantityStepper", () => {
  it("steps up and down", () => {
    const onChange = jest.fn();
    render(<QuantityStepper quantity={2} label="Glow Serum" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /increase quantity/i }));
    expect(onChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: /decrease quantity/i }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("stops at zero", () => {
    render(<QuantityStepper quantity={0} label="Glow Serum" onChange={jest.fn()} />);

    expect(screen.getByRole("button", { name: /decrease quantity/i })).toBeDisabled();
  });

  it("stops at the per-line maximum", () => {
    render(
      <QuantityStepper
        quantity={MAX_QUANTITY_PER_LINE}
        label="Glow Serum"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /increase quantity/i })).toBeDisabled();
  });

  it("clamps a typed value above the maximum", () => {
    const onChange = jest.fn();
    render(<QuantityStepper quantity={1} label="Glow Serum" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/quantity for glow serum/i), {
      target: { value: "5000" },
    });

    expect(onChange).toHaveBeenCalledWith(MAX_QUANTITY_PER_LINE);
  });

  it("ignores an empty field rather than treating it as zero", () => {
    const onChange = jest.fn();
    render(<QuantityStepper quantity={3} label="Glow Serum" onChange={onChange} />);

    // Clearing the box mid-edit must not silently remove the line.
    fireEvent.change(screen.getByLabelText(/quantity for glow serum/i), {
      target: { value: "" },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects a stock-limited maximum", () => {
    render(
      <QuantityStepper quantity={3} max={3} label="Glow Serum" onChange={jest.fn()} />,
    );

    expect(screen.getByRole("button", { name: /increase quantity/i })).toBeDisabled();
  });

  it("disables every control while a sync is in flight", () => {
    render(
      <QuantityStepper quantity={2} label="Glow Serum" disabled onChange={jest.fn()} />,
    );

    expect(screen.getByRole("button", { name: /increase quantity/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /decrease quantity/i })).toBeDisabled();
    expect(screen.getByLabelText(/quantity for glow serum/i)).toBeDisabled();
  });
});
