/* V1.0.0 registry engine verification — run with: bun scripts/test-registry-v100.ts
 * Covers: urban gift-to-legal-heir NEW flat stamp (no constructed addition),
 * rural gift-heir UNCHANGED (regression), normal conveyance (regression),
 * gift to non-heir (FBR applies), and share-validation skip for gh. */
import { calculateRegistry, type SrRegistryInput } from '../src/lib/punjab-registry-engine';

let failures = 0;
function check(label: string, got: number | boolean, want: number | boolean) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${got}${ok ? '' : `  want ${want}`}`);
}

function party(name: string, share: number, status: 'filer' | 'non' = 'filer') {
  return { name, share, status };
}

function base(over: Partial<SrRegistryInput>): SrRegistryInput {
  return {
    loc: 'urban', deed: 'conveyance', propType: 'nc', legalHeir: 'no',
    landValue: 5_000_000, constrValue: 0,
    buyers: [party('Buyer', 100)], sellers: [party('Seller', 100)],
    buyerTaxOn: false, sellerTaxOn: false,
    others: { reg: 0, fard: 0, photo: 0, misc: 0, stampVendor: 0 },
    ...over,
  };
}

// 1) URBAN + GIFT + legal heir = yes — NEW flat stamp, all other fees normal
{
  const r = calculateRegistry(base({ deed: 'gift', legalHeir: 'yes', buyers: [party('A', 30)] }));
  if (!r.ok) { console.log('FAIL case1 rejected:', r.error); failures++; }
  else {
    const x = r.result;
    console.log('--- case 1: urban gift-heir, Rs 50,00,000 ---');
    check('gh', x.gh, true); check('rgh', x.rgh, false); check('fbrOk', x.fbrOk, false);
    check('stamp (flat 1000)', x.stamp, 1000);
    check('committee (1%)', x.committee, 50_000);
    check('plra (3600+14x100)', x.plra, 5_000);
    check('borFee', x.borFee, 100); check('mutFee', x.mutFee, 300); check('plraMut', x.plraMut, 200);
    check('c32Tot', x.c32Tot, 56_600);
    check('fbrTot', x.fbrTot, 0);
    check('share validation skipped (30% shares still ok)', r.ok, true);
  }
}

// 2) URBAN + GIFT + legal heir = yes, CONSTRUCTED — no addition, stamp stays 1000
{
  const r = calculateRegistry(base({ deed: 'gift', legalHeir: 'yes', propType: 'c', landValue: 3_000_000, constrValue: 2_000_000 }));
  if (!r.ok) { console.log('FAIL case2 rejected:', r.error); failures++; }
  else {
    const x = r.result;
    console.log('--- case 2: urban gift-heir, constructed 30L+20L ---');
    check('stamp (flat 1000, no addition)', x.stamp, 1000);
    check('c32Tot', x.c32Tot, 56_600);
  }
}

// 3) RURAL + GIFT + legal heir = yes — UNCHANGED regression (old reduced fees)
{
  const r = calculateRegistry(base({ loc: 'rural', deed: 'gift', legalHeir: 'yes', buyers: [party('A', 30)] }));
  if (!r.ok) { console.log('FAIL case3 rejected:', r.error); failures++; }
  else {
    const x = r.result;
    console.log('--- case 3: rural gift-heir (must be unchanged) ---');
    check('gh', x.gh, true); check('rgh', x.rgh, true); check('fbrOk', x.fbrOk, false);
    check('stamp', x.stamp, 1000);
    check('committee (0)', x.committee, 0);
    check('plra (flat 3600)', x.plra, 3_600);
    check('borFee (0)', x.borFee, 0); check('mutFee (0)', x.mutFee, 0); check('plraMut (0)', x.plraMut, 0);
    check('c32Tot', x.c32Tot, 4_600);
  }
}

// 4) URBAN conveyance — normal rates regression + FBR filer taxes
{
  const r = calculateRegistry(base({ buyerTaxOn: true, sellerTaxOn: true }));
  if (!r.ok) { console.log('FAIL case4 rejected:', r.error); failures++; }
  else {
    const x = r.result;
    console.log('--- case 4: urban conveyance, filers ---');
    check('gh', x.gh, false); check('fbrOk', x.fbrOk, true);
    check('stamp (1% + 1000)', x.stamp, 51_000);
    check('committee', x.committee, 50_000);
    check('plra', x.plra, 5_000);
    check('buyer 236K filer 1.25%', x.btTot, 62_500);
    check('seller 236C filer 2.75%', x.stTot, 137_500);
    check('c32Tot', x.c32Tot, 106_600);
  }
}

// 5) GIFT urban, legal heir = NO — normal rates + FBR applies (regression)
{
  const r = calculateRegistry(base({ deed: 'gift', legalHeir: 'no', buyerTaxOn: true }));
  if (!r.ok) { console.log('FAIL case5 rejected:', r.error); failures++; }
  else {
    const x = r.result;
    console.log('--- case 5: urban gift to NON-heir ---');
    check('gh', x.gh, false); check('fbrOk', x.fbrOk, true);
    check('stamp (1% + 1000)', x.stamp, 51_000);
    check('buyer 236K applies', x.btTot, 62_500);
  }
}

// 6) RURAL conveyance small value — normal rates regression
{
  const r = calculateRegistry(base({ loc: 'rural', landValue: 800_000, buyers: [party('B', 100)] }));
  if (!r.ok) { console.log('FAIL case6 rejected:', r.error); failures++; }
  else {
    const x = r.result;
    console.log('--- case 6: rural conveyance Rs 8,00,000 ---');
    check('stamp (1% + 1000)', x.stamp, 9_000);
    check('committee', x.committee, 8_000);
    check('plra (base)', x.plra, 3_600);
    check('c32Tot', x.c32Tot, 21_200);
  }
}

// 7) share validation still enforced for non-gh deeds
{
  const r = calculateRegistry(base({ buyers: [party('A', 30)] }));
  console.log(`${!r.ok && r.error === 'buyerShares' ? 'PASS' : 'FAIL'}  case 7: buyerShares enforced for conveyance`);
  if (!(!r.ok && r.error === 'buyerShares')) failures++;
}

console.log(failures === 0 ? '\nALL REGISTRY TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
