import { dayNumber } from './dates.js';
import { compareText } from '../artifacts/canonical.js';

export function groupKey(...values) {
  return JSON.stringify(values);
}

function append(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function lowerBound(items, day) {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (items[middle].day < day) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function buildIndexes(claims) {
  const duplicates = new Map();
  const memberHistory = new Map();
  const cohorts = new Map();
  const providerDays = new Map();
  const providerHistory = new Map();
  for (const claim of claims) {
    const day = dayNumber(claim.claim_date);
    append(
      duplicates,
      groupKey(
        claim.member_id,
        claim.provider_id,
        claim.claim_date,
        claim.diagnosis_code,
      ),
      claim,
    );
    append(memberHistory, groupKey(claim.member_id, claim.diagnosis_code), {
      claim,
      day,
    });
    const dailyKey = groupKey(claim.provider_id, claim.claim_date);
    providerDays.set(dailyKey, (providerDays.get(dailyKey) ?? 0) + 1);
    append(providerHistory, claim.provider_id, {
      day,
      weekend: claim.is_weekend,
    });
    for (const procedure of claim.procedure_codes) {
      const moments = cohorts.get(procedure) ?? { count: 0, mean: 0, m2: 0 };
      moments.count++;
      const delta = claim.submitted_amount - moments.mean;
      moments.mean += delta / moments.count;
      moments.m2 += delta * (claim.submitted_amount - moments.mean);
      cohorts.set(procedure, moments);
    }
  }
  for (const entries of memberHistory.values())
    entries.sort(
      (a, b) =>
        a.day - b.day || compareText(a.claim.claim_id, b.claim.claim_id),
    );
  for (const moments of cohorts.values())
    moments.sd = Math.sqrt(Math.max(0, moments.m2 / moments.count));
  for (const entries of providerHistory.values()) {
    entries.sort((a, b) => a.day - b.day);
    let weekend = 0;
    for (const entry of entries) {
      weekend += Number(entry.weekend);
      entry.weekendTotal = weekend;
    }
  }
  return {
    duplicates,
    cohorts,
    providerDays,
    recentClaims(claim) {
      const entries = memberHistory.get(
        groupKey(claim.member_id, claim.diagnosis_code),
      );
      const day = dayNumber(claim.claim_date);
      const matches = [];
      for (
        let index = lowerBound(entries, day - 7);
        index < entries.length && entries[index].day <= day;
        index++
      ) {
        if (entries[index].claim.claim_id !== claim.claim_id)
          matches.push({
            claim_id: entries[index].claim.claim_id,
            elapsed: day - entries[index].day,
          });
      }
      return matches.sort((a, b) => compareText(a.claim_id, b.claim_id));
    },
    earlierProviderHistory(claim) {
      const entries = providerHistory.get(claim.provider_id);
      const total = lowerBound(entries, dayNumber(claim.claim_date));
      return { total, weekend: total ? entries[total - 1].weekendTotal : 0 };
    },
  };
}
