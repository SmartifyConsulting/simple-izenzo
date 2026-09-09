/** A starter list of common traded commodities, shown alongside whatever's already been used on
 * the platform (see CommoditySearch) — so the suggestion list isn't empty before any real
 * transactions exist. Not tied to any table; picking one (or typing a new one) just sets free
 * text on the `commodity` column. */
export const COMMODITIES = [
  "Copper cathode", "Copper concentrate", "Aluminium", "Steel billet", "Iron ore",
  "Gold", "Silver", "Platinum", "Lithium", "Cobalt", "Nickel", "Zinc", "Tin",
  "Crude oil", "Diesel", "LPG", "Natural gas", "Coal",
  "Cashew nuts", "Coffee beans", "Cocoa beans", "Cotton", "Soybeans", "Maize", "Wheat", "Rice",
  "Sugar", "Palm oil", "Hemp fibre", "Timber",
  "Solar panels", "Solar inverters", "Batteries", "Fertiliser", "Cement",
] as const;
