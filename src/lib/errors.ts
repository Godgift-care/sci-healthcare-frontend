import { config } from './config';

/**
 * Contract error codes, mirrored from the Rust `#[contracterror]` enums.
 *
 * Keeping these in step with the contracts is manual. If a code is added
 * there and not here the UI degrades to "Error #N" rather than lying, which
 * is the intended failure mode.
 */
export const VOUCHER_ERRORS: Record<number, string> = {
  1: 'This contract has already been set up.',
  2: 'This contract has not been set up yet.',
  3: 'You are not authorised to do that.',
  4: 'That voucher does not exist.',
  5: 'This clinic is not currently active.',
  6: 'This clinic does not offer that service.',
  7: 'The amount is below the listed price for this service.',
  8: 'The amount must be greater than zero.',
  9: 'The expiry date must be in the future.',
  10: 'This voucher is not in the right state for that action.',
  11: 'This voucher has expired.',
  12: 'This voucher cannot be refunded yet.',
  13: 'The dispute window is still open. Settlement unlocks once it closes.',
  14: 'The dispute window has closed.',
  15: 'That fee is not allowed.',
  16: 'The calculation overflowed.',
  17: 'No admin handover is pending.',
  18: 'The clinic has paused this service.',
  19: 'This attester has reached today’s attestation limit.',
  20: 'The attestation cap must be at least one.',
  21: 'The attester share cannot exceed the protocol fee.',
  22: 'The new amount is not lower than the escrowed amount.',
  23: 'The contract holds less USDC than this voucher escrows.',
  24: 'The token refused the payment. Nothing moved; try again later.',
  25: 'This clinic is at capacity and is not accepting new vouchers. Try again once some of its open vouchers settle or refund.',
  26: 'This clinic has reached its escrow limit for now.',
  27: 'The escrow limit cannot be negative.',
  28: 'This voucher needs the code the patient brought. Ask for it at the desk and enter it before claiming.',
  29: 'That code does not match this voucher.',
  30: 'This voucher was not funded with a presence code.',
  31: 'That dispute window is outside the allowed range.',
};

export const REGISTRY_ERRORS: Record<number, string> = {
  1: 'This registry has already been set up.',
  2: 'This registry has not been set up yet.',
  3: 'You are not authorised to do that.',
  4: 'That clinic is not registered.',
  5: 'That clinic is already registered.',
  6: 'This clinic is not active yet.',
  7: 'That service is not listed.',
  8: 'The price must be greater than zero.',
  9: 'The country code must be two letters.',
  10: 'A name is required.',
  11: 'No admin handover is pending.',
  12: 'A price change must give at least 24 hours’ notice.',
  13: 'A price increase needs notice. Schedule it instead of setting it immediately.',
  14: 'That status change is not allowed.',
};

export const SPONSOR_ERRORS: Record<number, string> = {
  1: 'This sponsor desk has already been set up.',
  2: 'This sponsor desk has not been set up yet.',
  3: 'You are not authorised to do that.',
  4: 'The amount must be greater than zero.',
  5: 'These rules are outside what the desk accepts.',
  6: 'Set your matching rules before matching a voucher.',
  7: 'That voucher does not exist.',
  8: 'That voucher is not funded, so it cannot be matched.',
  9: 'That voucher has expired.',
  10: 'That voucher has already been matched.',
  11: 'A sponsor cannot match its own voucher.',
  12: 'The clinic is not in one of your eligible countries.',
  13: 'The service is not one you match.',
  14: 'The voucher is too new to qualify.',
  15: 'The voucher is below your minimum amount.',
  16: 'The match is below the price of the care.',
  17: 'Your budget cannot cover this match.',
  18: 'You cannot withdraw more than your unused budget.',
  19: 'You already have the maximum number of open matches.',
  20: 'The sponsor desk is paused.',
  21: 'The voucher contract refused the matching voucher.',
  22: 'The clinic is not active, so it cannot be paid.',
  23: 'The clinic has paused this service.',
  24: 'The match works out to nothing.',
  25: 'The calculation overflowed.',
  26: 'No admin handover is pending.',
};

export const FAUCET_ERRORS: Record<number, string> = {
  2: 'The test USDC faucet is not set up on this network.',
  3: 'You are not authorised to do that.',
  4: 'The faucet amount must be greater than zero.',
  5: 'You have already had test USDC today. Try again later.',
};

export const VOUCHER_ERRORS_I18N: Record<string, Record<number, string>> = {
  en: VOUCHER_ERRORS,
  fr: {
    1: 'Ce contrat a déjà été configuré.',
    2: "Ce contrat n'a pas encore été configuré.",
    3: "Vous n'êtes pas autorisé à faire cela.",
    4: "Ce bon d'achat n'existe pas.",
    5: "Cette clinique n'est pas active actuellement.",
    6: 'Cette clinique ne propose pas ce service.',
    7: 'Le montant est inférieur au prix affiché pour ce service.',
    8: 'Le montant doit être supérieur à zéro.',
    9: "La date d'expiration doit être dans le futur.",
    10: "Ce bon d'achat n'est pas dans le bon état pour cette action.",
    11: "Ce bon d'achat a expiré.",
    12: "Ce bon d'achat ne peut pas encore être remboursé.",
    13: 'La période de contestation est toujours ouverte. Le règlement se débloquera à sa clôture.',
    14: 'La période de contestation est clôturée.',
    15: 'Ces frais ne sont pas autorisés.',
    16: 'Le calcul a dépassé la capacité.',
    17: "Aucun transfert d'administration n'est en attente.",
    18: 'La clinique a suspendu ce service.',
    25: "Cette clinique est à capacité et n'accepte pas de nouveaux bons. Réessayez lorsque certains bons en cours seront réglés ou remboursés.",
    28: "Ce bon nécessite le code apporté par le patient. Demandez-le à l'accueil et saisissez-le avant de réclamer.",
    29: 'Ce code ne correspond pas à ce bon.',
    30: 'Ce bon n’a pas été financé avec un code de présence.',
  },
  sw: {
    1: 'Mkataba huu tayari umewekwa.',
    2: 'Mkataba huu bado haujawekwa.',
    3: 'Huna mamlaka ya kufanya hivyo.',
    4: 'Vocha hiyo haipo.',
    5: 'Kliniki hii haifanyi kazi kwa sasa.',
    6: 'Kliniki hii haitoi huduma hiyo.',
    7: 'Kiasi kiko chini ya bei iliyoorodheshwa kwa huduma hii.',
    8: 'Kiasi lazima kiwe zaidi ya sifuri.',
    9: 'Tarehe ya mwisho wa matumizi lazima iwe siku zijazo.',
    10: 'Vocha hii haiko katika hali sahihi ya hatua hiyo.',
    11: 'Vocha hii imeisha muda wake.',
    12: 'Vocha hii haiwezi kurejeshwa bado.',
    13: 'Muda wa mzozo bado uko wazi. Malipo hufunguka mara tu unapofungwa.',
    14: 'Muda wa mzozo umefungwa.',
    15: 'Ada hiyo hairuhusiwi.',
    16: 'Hesabu imezidi uwezo.',
    17: 'Hakuna makabidhiano ya usimamizi yanayosubiriwa.',
    18: 'Kliniki imesimamisha huduma hii.',
    25: 'Kliniki hii imefikia uwezo wake na haipokei vocha mpya kwa sasa. Jaribu tena baadhi ya vocha zake zikitolewa au kurejeshwa.',
    28: 'Vocha hii inahitaji msimbo alioletea mgonjwa. Mwombe apokeee na uuweke kabla ya kudai.',
    29: 'Msimbo huo haulingani na vocha hii.',
    30: 'Vocha hii haikufadhiliwa kwa msimbo wa uwepo.',
  },
};

export const REGISTRY_ERRORS_I18N: Record<string, Record<number, string>> = {
  en: REGISTRY_ERRORS,
  fr: {
    1: 'Ce registre a déjà été configuré.',
    2: "Ce registre n'a pas encore été configuré.",
    3: "Vous n'êtes pas autorisé à faire cela.",
    4: "Cette clinique n'est pas enregistrée.",
    5: 'Cette clinique est déjà enregistrée.',
    6: "Cette clinique n'est pas encore active.",
    7: "Ce service n'est pas répertorié.",
    8: 'Le prix doit être supérieur à zéro.',
    9: 'Le code pays doit comporter deux lettres.',
    10: 'Un nom est requis.',
    11: "Aucun transfert d'administration n'est en attente.",
    12: 'Un changement de prix doit être annoncé au moins 24 heures à l’avance.',
    13: 'Une hausse de prix doit être planifiée, pas appliquée immédiatement.',
    14: 'Ce changement de statut n’est pas autorisé.',
  },
  sw: {
    1: 'Rejesta hii tayari imewekwa.',
    2: 'Rejesta hii bado haijawekwa.',
    3: 'Huna mamlaka ya kufanya hivyo.',
    4: 'Kliniki hiyo haijasajiliwa.',
    5: 'Kliniki hiyo tayari imesajiliwa.',
    6: 'Kliniki hii bado haifanyi kazi.',
    7: 'Huduma hiyo haijaorodheshwa.',
    8: 'Bei lazima iwe zaidi ya sifuri.',
    9: 'Msimbo wa nchi lazima uwe na herufi mbili.',
    10: 'Jina linahitajika.',
    11: 'Hakuna makabidhiano ya usimamizi yanayosubiriwa.',
    12: 'Mabadiliko ya bei lazima yatangazwe angalau saa 24 kabla.',
    13: 'Ongezeko la bei linapaswa kupangwa, si kuwekwa papo hapo.',
    14: 'Mabadiliko hayo ya hali hayaruhusiwi.',
  },
};

export const SPONSOR_ERRORS_I18N: Record<string, Record<number, string>> = {
  en: SPONSOR_ERRORS,
  fr: {
    3: "Vous n'êtes pas autorisé à faire cela.",
    4: 'Le montant doit être supérieur à zéro.',
    5: 'Ces règles sont hors de ce que le guichet accepte.',
    6: 'Définissez vos règles de contrepartie avant de jumeler un bon.',
    9: 'Ce bon a expiré.',
    10: 'Ce bon a déjà été jumelé.',
    12: "La clinique n'est pas dans l'un de vos pays éligibles.",
    13: 'Ce service ne fait pas partie de ceux que vous jumelez.',
    15: 'Le bon est inférieur à votre montant minimum.',
    17: 'Votre budget ne couvre pas cette contrepartie.',
    18: 'Vous ne pouvez pas retirer plus que votre budget inutilisé.',
    20: 'Le guichet des sponsors est en pause.',
  },
  sw: {
    3: 'Huna mamlaka ya kufanya hivyo.',
    4: 'Kiasi lazima kiwe zaidi ya sifuri.',
    5: 'Sheria hizi ziko nje ya kile dawati linakubali.',
    6: 'Weka sheria zako za ulinganishaji kabla ya kulinganisha vocha.',
    9: 'Vocha hii imeisha muda wake.',
    10: 'Vocha hii tayari imelinganishwa.',
    12: 'Kliniki haiko katika moja ya nchi zako zinazostahiki.',
    13: 'Huduma hii si moja unayolinganisha.',
    15: 'Vocha iko chini ya kiasi chako cha chini.',
    17: 'Bajeti yako haiwezi kufidia ulinganishaji huu.',
    18: 'Huwezi kutoa zaidi ya bajeti yako isiyotumika.',
    20: 'Dawati la wadhamini limesimamishwa.',
  },
};

export const FAUCET_ERRORS_I18N: Record<string, Record<number, string>> = {
  en: FAUCET_ERRORS,
  fr: {
    2: "Le robinet USDC de test n'est pas configuré sur ce réseau.",
    3: "Vous n'êtes pas autorisé à faire cela.",
    4: 'Le montant du robinet doit être supérieur à zéro.',
    5: "Vous avez déjà reçu des USDC de test aujourd'hui. Réessayez plus tard.",
  },
  sw: {
    2: 'Bomba la majaribio la USDC halijawekwa kwenye mtandao huu.',
    3: 'Huna mamlaka ya kufanya hivyo.',
    4: 'Kiasi cha bomba lazima kiwe zaidi ya sifuri.',
    5: 'Tayari umepokea USDC ya majaribio leo. Jaribu tena baadaye.',
  },
};

/** Pulls `Error(Contract, #N)` out of a Soroban host error string. */
export function contractErrorCode(message: string): number | null {
  const m = /Error\(Contract,\s*#(\d+)\)/.exec(message);
  return m?.[1] ? Number(m[1]) : null;
}

export function humaniseError(
  err: unknown,
  table: Record<number, string> = VOUCHER_ERRORS,
  locale = 'en',
): string {
  const message = err instanceof Error ? err.message : String(err);
  // Token failures surface through our contracts with the token's own error
  // number (a missing trustline is #13, which in the voucher table means
  // something else entirely), so recognise them by text before looking the
  // number up.
  if (/trustline/i.test(message)) {
    if (locale === 'fr') return 'Votre portefeuille nécessite une trustline USDC pour détenir ou envoyer des USDC.';
    if (locale === 'sw') return 'Pochi yako inahitaji trustline ya USDC kabla ya kupokea au kutuma USDC.';
    return 'Your wallet needs a USDC trustline before it can hold or send USDC.';
  }
  if (/insufficient balance|balance is not sufficient|underflow/i.test(message)) {
    if (locale === 'fr') return 'Solde USDC insuffisant dans votre portefeuille.';
    if (locale === 'sw') return 'Huna USDC ya kutosha kwenye pochi yako kwa hili.';
    return 'Not enough USDC in your wallet for this.';
  }
  const code = contractErrorCode(message);
  if (code !== null) {
    let resolvedTable = table;
    if (table === VOUCHER_ERRORS && VOUCHER_ERRORS_I18N[locale]) {
      resolvedTable = VOUCHER_ERRORS_I18N[locale];
    } else if (table === REGISTRY_ERRORS && REGISTRY_ERRORS_I18N[locale]) {
      resolvedTable = REGISTRY_ERRORS_I18N[locale];
    } else if (table === FAUCET_ERRORS && FAUCET_ERRORS_I18N[locale]) {
      resolvedTable = FAUCET_ERRORS_I18N[locale];
    } else if (table === SPONSOR_ERRORS && SPONSOR_ERRORS_I18N[locale]) {
      resolvedTable = SPONSOR_ERRORS_I18N[locale];
    }
    const mapped = resolvedTable[code] ?? table[code];
    if (mapped) return mapped;
    if (locale === 'fr') return `Le contrat a rejeté cette opération (erreur #${code}).`;
    if (locale === 'sw') return `Mkataba umekataa ombi hili (hitilafu #${code}).`;
    return `Contract rejected this (error #${code}).`;
  }
  if (/account not found/i.test(message)) {
    if (config.network === 'testnet') {
      if (locale === 'fr') return "Ce compte n'existe pas encore sur le réseau. Approvisionnez-le d'abord avec Friendbot.";
      if (locale === 'sw') return 'Akaunti hii haipo kwenye mtandao bado. Iwekee fedha kwa Friendbot kwanza.';
      return 'This account does not exist on the network yet. Fund it with Friendbot first.';
    }
    if (locale === 'fr') return "Ce compte n'existe pas encore sur le réseau. Approvisionnez-le d'abord.";
    if (locale === 'sw') return 'Akaunti hii haipo kwenye mtandao bado. Iwekee fedha kwanza.';
    return 'This account does not exist on the network yet. Fund it first.';
  }
  return message;
}

/**
 * Horizon result codes for a rejected *classic* transaction (the USDC
 * changeTrust of #1 goes to Horizon, not through a contract, so these codes
 * are the only explanation the user would otherwise get).
 */
const HORIZON_TX_ERRORS: Record<string, string> = {
  tx_bad_seq:
    'Your wallet signed an outdated version of this request. Press Add USDC again.',
  tx_insufficient_fee: 'The network fee was too low. Press Add USDC again.',
  tx_failed: 'The network rejected this request. Press Add USDC again.',
  op_underfunded:
    'Not enough XLM: holding USDC locks 0.5 XLM as a reserve. Top up your ' +
    'wallet, then press Add USDC again.',
  op_line_full:
    'Your wallet already holds all the USDC this issuer allows.',
  op_no_issuer: 'USDC does not exist on this network.',
  op_no_trust:
    'Your wallet is not ready to hold USDC yet. Press Add USDC and approve ' +
    'it in your wallet.',
  op_malformed: 'The request was built incorrectly. Press Add USDC again.',
};

/**
 * Plain language for Horizon's `extras.result_codes` (`tx` plus one code
 * per operation). Unknown codes are shown verbatim rather than swallowed:
 * a recognisable code is still a starting point for a bug report.
 */
export function humaniseHorizonResult(
  status: number,
  codes?: { tx?: string; operations?: string[] } | null,
): string {
  const all = [...(codes?.operations ?? []), ...(codes?.tx ? [codes.tx] : [])];
  for (const code of all) {
    const message = HORIZON_TX_ERRORS[code];
    if (message) return message;
  }
  if (all.length > 0) {
    return `The network rejected this request (${all.join(', ')}). Try again.`;
  }
  if (status === 504) {
    return 'The network is taking longer than usual. The request may still ' +
      'go through — check your wallet balance before trying again.';
  }
  return `The Stellar network could not accept this request (HTTP ${status}). Try again.`;
}
