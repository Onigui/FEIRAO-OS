/**
 * Telefone do formulário público → formato dos leads do WhatsApp (só dígitos, com 55).
 * Aceita "(14) 99999-0000", "14999990000", "+55 14 99999-0000".
 * Devolve null se não parecer um número brasileiro com DDD.
 */
export function toLeadPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!digits.startsWith('55')) return null;
  const national = digits.slice(2);
  if (national.length !== 10 && national.length !== 11) return null;
  if (national.startsWith('0')) return null;
  // Celular com 11 dígitos começa com 9 depois do DDD.
  if (national.length === 11 && national[2] !== '9') return null;
  return digits;
}

/** Formas em que o mesmo número pode estar gravado num lead antigo. */
export function leadPhoneCandidates(leadPhone: string): string[] {
  const national = leadPhone.startsWith('55') ? leadPhone.slice(2) : leadPhone;
  return [...new Set([leadPhone, national])];
}

/** Link do WhatsApp (wa.me) com mensagem pronta. */
export function whatsappLink(phoneDigits: string, text: string): string {
  const to = toLeadPhone(phoneDigits) ?? phoneDigits.replace(/\D/g, '');
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
