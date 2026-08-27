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

export function rollPlushie({ rarities, plushies }) {
  const available = plushies.filter((p) => rarities.some((r) => r.id === p.rarity));
  if (available.length === 0) return null;

  const weighted = rarities.filter((r) => available.some((p) => p.rarity === r.id));
  const rarity = rollRarity(weighted);
  if (!rarity) return null;

  const pool = available.filter((p) => p.rarity === rarity.id);
  const plushie = pool[Math.floor(Math.random() * pool.length)];
  return { plushie, rarity };
}
