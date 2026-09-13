export function rollRarity(rarities) {
  const total = rarities.reduce((sum, r) => sum + Number(r.weight || 0), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const rarity of rarities) {
    roll -= Number(rarity.weight || 0);
    if (roll <= 0) return rarity;
  }
  return rarities[rarities.length - 1];
}

export function rollPlushie({ rarities, plushies }, boost = null) {
  const available = plushies.filter((p) => rarities.some((r) => r.id === p.rarity));
  if (available.length === 0) return null;

  // Compute effective weights. A boost adds weight to every "superior" tier
  // (weight lower than the source tier's weight). When superiorOnly is set,
  // tiers with weight >= sourceWeight are excluded entirely.
  const candidates = rarities
    .filter((r) => available.some((p) => p.rarity === r.id))
    .filter((r) => {
      if (!boost || !boost.superiorOnly) return true;
      return Number(r.weight || 0) < boost.sourceWeight;
    })
    .map((r) => {
      let weight = Number(r.weight || 0);
      if (boost && Number(r.weight || 0) < boost.sourceWeight) {
        weight += Number(boost.bonusWeight || 0);
      }
      return { rarity: r, weight };
    });

  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return null;

  let roll = Math.random() * total;
  let chosen = candidates[candidates.length - 1].rarity;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) { chosen = c.rarity; break; }
  }

  const pool = available.filter((p) => p.rarity === chosen.id);
  const plushie = pool[Math.floor(Math.random() * pool.length)];
  return { plushie, rarity: chosen };
}
