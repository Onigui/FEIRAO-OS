import { leadPhoneCandidates, toLeadPhone, whatsappLink } from './phone';

describe('toLeadPhone', () => {
  it.each([
    ['(14) 99999-0000', '5514999990000'],
    ['14999990000', '5514999990000'],
    ['+55 14 99999-0000', '5514999990000'],
    ['005514999990000', '5514999990000'],
    ['(14) 3882-1234', '551438821234'],
  ])('%s → %s', (input, expected) => {
    expect(toLeadPhone(input)).toBe(expected);
  });

  it.each([
    '',
    '123',
    '99999-0000',
    '(14) 89999-0000',
    '(01) 99999-0000',
    '+1 415 555 0100',
  ])('rejeita %s', (input) => {
    expect(toLeadPhone(input)).toBeNull();
  });
});

describe('leadPhoneCandidates', () => {
  it('inclui a forma sem 55', () => {
    expect(leadPhoneCandidates('5514999990000')).toEqual([
      '5514999990000',
      '14999990000',
    ]);
  });
});

describe('whatsappLink', () => {
  it('normaliza e codifica a mensagem', () => {
    expect(whatsappLink('(14) 99999-0000', 'Olá! Gol 2021 (AB12)')).toBe(
      'https://wa.me/5514999990000?text=Ol%C3%A1!%20Gol%202021%20(AB12)',
    );
  });
});
