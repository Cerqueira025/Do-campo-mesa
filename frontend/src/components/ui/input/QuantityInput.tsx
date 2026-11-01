import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRef, useState } from "react";
import {
  initialPurchaseQuantity,
  maximumPurchaseQuantity,
  quantityRestriction,
  quantityRules,
  validPurchaseQuantity,
} from "../../../features/products/purchaseQuantity";
import IconButton from "../IconButton";
import Input from "./Input";
import "./QuantityInput.scss";

interface QuantityInputProps {
  id: string;
  value: string | number;
  onValueChange: (value: string) => void;
  unit: string;
  max?: number;
  disabled?: boolean;
}

export default function QuantityInput({
  id,
  value,
  onValueChange,
  unit,
  max = Infinity,
  disabled = false,
}: QuantityInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const lastValid = useRef<number | null>(
    validPurchaseQuantity(Number(value), unit, max) ? Number(value) : null,
  );
  const rule = quantityRules[unit];
  const maximum = maximumPurchaseQuantity(max, unit);
  const unavailable = maximum === 0;
  const displayedValue = draft ?? value;
  const quantity = Number(displayedValue);
  const valid = validPurchaseQuantity(quantity, unit, max);
  const inactive = disabled || unavailable;
  const canDecrease = !inactive && (!valid || quantity > rule.min);
  const canIncrease = !inactive && (!valid || quantity < maximum);
  const showError = error || (draft === null && !valid && !unavailable);
  const restriction =
    quantity > maximum
      ? `Máximo disponível: ${maximum.toLocaleString("pt-PT")} ${unit}.`
      : quantityRestriction(unit);

  function commit(next: number) {
    lastValid.current = next;
    setDraft(null);
    onValueChange(String(next));
  }

  function changeBy(direction: -1 | 1) {
    if (direction === -1 ? !canDecrease : !canIncrease) return;
    setError(false);
    const next = valid
      ? Math.min(maximum, Math.max(rule.min, quantity + direction * rule.step))
      : initialPurchaseQuantity(unit, max);
    commit(next);
  }

  function finishEditing() {
    if (draft === null) return;
    if (valid) {
      commit(quantity);
      return;
    }
    const previous = validPurchaseQuantity(Number(value), unit, max)
      ? Number(value)
      : lastValid.current;
    const restored =
      previous !== null && validPurchaseQuantity(previous, unit, max)
        ? previous
        : initialPurchaseQuantity(unit, max);
    setError(true);
    commit(restored);
  }

  return (
    <div className="quantity-input-field">
      <div className="quantity-input">
        <IconButton
          variant="plain"
          aria-label="Diminuir quantidade"
          aria-controls={id}
          disabled={!canDecrease}
          onClick={() => changeBy(-1)}
          icon={<FontAwesomeIcon icon={faMinus} aria-hidden="true" />}
        />
        <Input
          className="quantity-input__value"
          id={id}
          type="number"
          inputMode={unit === "unidade" || unit === "g" ? "numeric" : "decimal"}
          min={rule?.min}
          max={Number.isFinite(maximum) ? maximum : undefined}
          step={rule?.step}
          required
          disabled={inactive}
          aria-invalid={!valid && !unavailable}
          aria-describedby={
            showError || unavailable ? `${id}-restriction` : undefined
          }
          value={displayedValue}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            setError(false);
            if (validPurchaseQuantity(Number(text), unit, max))
              lastValid.current = Number(text);
            onValueChange(text);
          }}
          onBlur={finishEditing}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              changeBy(event.key === "ArrowUp" ? 1 : -1);
            }
          }}
        />
        <IconButton
          variant="plain"
          aria-label="Aumentar quantidade"
          aria-controls={id}
          disabled={!canIncrease}
          onClick={() => changeBy(1)}
          icon={<FontAwesomeIcon icon={faPlus} aria-hidden="true" />}
        />
      </div>
      {(showError || unavailable) && (
        <small
          id={`${id}-restriction`}
          className="quantity-input-field__message"
          role="status"
        >
          {unavailable
            ? "Não existe quantidade suficiente disponível."
            : restriction}
        </small>
      )}
    </div>
  );
}
