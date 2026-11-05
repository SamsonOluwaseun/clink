import { getLocales } from 'expo-localization';
import { Fragment, useEffect, type ReactNode } from 'react';

import { getCurrency, setCurrency } from './db';
import { useDb, useQuery, useRefresh } from './data';
import { currencyForRegion, setActiveCurrency } from './money';

/*
 * Holds the family's currency. On first launch it is guessed from the phone's
 * region (UK, US, Canada, Nigeria) and saved quietly, so a choice made on a paired
 * phone always wins. When it changes, every screen is redrawn with the new symbol.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const refresh = useRefresh();
  const code = useQuery(getCurrency);

  useEffect(() => {
    if (code !== null) return;
    const region = getLocales()[0]?.regionCode;
    setCurrency(db, currencyForRegion(region), true).then(refresh);
  }, [code, db, refresh]);

  if (!code) return null;
  setActiveCurrency(code);
  return <Fragment key={code}>{children}</Fragment>;
}
