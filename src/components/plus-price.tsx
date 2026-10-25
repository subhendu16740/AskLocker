// The yearly Family Plus (or Pro, 064) price, shown as a discount: twelve months at the
// monthly price crossed out, then what a year costs — "₹1,188 ₹999 a year".
// The crossed-out price is worked out (plusTwelveMonths()), never typed in, so
// it is always one a family could really pay.
//
// A screen reader cannot see a line through text, so the crossed-out price is
// hidden from it, and the Text around it carries an accessibilityLabel that
// says "instead of" (plusYearlyOffer(), localPlusYearlyOffer()).

import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { localCurrency, plusPrice, plusTwelveMonths, type FamilyPlan, type PriceCurrency } from '../lib/plans';

interface PriceProps {
  /** Rupees or dollars; where this device is when left out. */
  currency?: PriceCurrency;
  /** On the dark Family Plus banner. */
  onDark?: boolean;
  /** Family Plus when left out. */
  plan?: FamilyPlan;
}

/** "₹1,188", crossed out: what a year costs by the month. */
export function TwelveMonthsPrice({ currency, onDark, plan, style }: PriceProps & { style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.was, onDark && styles.wasOnDark, style]} aria-hidden>
      {plusTwelveMonths(currency ?? localCurrency(), plan)}
    </Text>
  );
}

/** "₹1,188 ₹999 a year", the first crossed out, inside a sentence. */
export function YearlyPrice({ currency, onDark, plan }: PriceProps) {
  const c = currency ?? localCurrency();
  return (
    <Text>
      <TwelveMonthsPrice currency={c} onDark={onDark} plan={plan} />
      {` ${plusPrice(c, 'yearly', plan)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Regular weight even in a bold line, so the price after it reads first.
  was: { textDecorationLine: 'line-through', fontWeight: '400' },
  wasOnDark: { color: '#DCE3F0' },
});
